import crypto from "crypto";
import { logger } from "@algofight/logger";

interface GoogleJwk {
    kid: string;
    alg: string;
    kty: string;
    use: string;
    n: string;
    e: string;
}

interface GoogleJwksResponse {
    keys: GoogleJwk[];
}

export interface GoogleUserPayload {
    sub: string;
    email: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
    given_name?: string;
    family_name?: string;
}

class GoogleTokenVerifier {
    private cachedKeys: Map<string, crypto.KeyObject> = new Map();
    private keysExpiry: number = 0;

    private async refreshJwks(): Promise<Map<string, crypto.KeyObject>> {
        const now = Date.now();
        if (now < this.keysExpiry && this.cachedKeys.size > 0) {
            return this.cachedKeys;
        }

        try {
            const res = await fetch("https://www.googleapis.com/oauth2/v3/certs", {
                signal: AbortSignal.timeout(5000),
            });
            if (res.ok) {
                const data = (await res.json()) as GoogleJwksResponse;
                const newMap = new Map<string, crypto.KeyObject>();
                for (const jwk of data.keys) {
                    if (jwk.kty === "RSA" && jwk.n && jwk.e) {
                        try {
                            const keyObj = crypto.createPublicKey({
                                key: {
                                    kty: "RSA",
                                    n: jwk.n,
                                    e: jwk.e,
                                    alg: "RS256",
                                },
                                format: "jwk",
                            });
                            newMap.set(jwk.kid, keyObj);
                        } catch (kErr: any) {
                            logger.warn({ kid: jwk.kid, err: kErr.message }, "Could not construct key from JWK");
                        }
                    }
                }
                if (newMap.size > 0) {
                    this.cachedKeys = newMap;
                    this.keysExpiry = now + 6 * 60 * 60 * 1000; // 6 hours TTL
                }
            }
        } catch (err: any) {
            logger.warn({ error: err.message }, "Failed to fetch Google OAuth2 public certs");
        }

        return this.cachedKeys;
    }

    public async verifyIdToken(token: string): Promise<GoogleUserPayload | null> {
        if (!token || typeof token !== "string") {
            logger.warn("verifyIdToken called with empty or invalid token parameter");
            return null;
        }

        const googleClientId = (process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "").trim();

        const parts = token.split(".");
        if (parts.length !== 3) {
            logger.warn("verifyIdToken: token does not have 3 parts");
            return this.verifyWithTokeninfo(token, googleClientId);
        }

        const [headerB64, payloadB64, sigB64] = parts;
        let header: any;
        let payload: any;

        try {
            header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf-8"));
            payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
        } catch (parseErr: any) {
            logger.warn({ err: parseErr.message }, "verifyIdToken: failed to base64url decode parts");
            return this.verifyWithTokeninfo(token, googleClientId);
        }

        if (header.alg !== "RS256" || !header.kid) {
            logger.warn({ alg: header.alg, kid: header.kid }, "verifyIdToken: unexpected header alg or missing kid");
            return this.verifyWithTokeninfo(token, googleClientId);
        }

        // Verify expiration
        const nowSec = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < nowSec - 30) {
            logger.warn({ exp: payload.exp, now: nowSec }, "verifyIdToken: token expired");
            return null;
        }

        // Verify issuer
        const validIssuers = ["https://accounts.google.com", "accounts.google.com"];
        if (!payload.iss || !validIssuers.includes(payload.iss)) {
            logger.warn({ iss: payload.iss }, "verifyIdToken: invalid issuer");
            return this.verifyWithTokeninfo(token, googleClientId);
        }

        // Verify audience if configured
        if (googleClientId && payload.aud !== googleClientId && payload.azp !== googleClientId) {
            logger.warn({ aud: payload.aud, azp: payload.azp, expected: googleClientId }, "verifyIdToken: audience mismatch");
            return this.verifyWithTokeninfo(token, googleClientId);
        }

        const keys = await this.refreshJwks();
        const publicKey = keys.get(header.kid);
        if (!publicKey) {
            logger.info({ kid: header.kid }, "PublicKey kid not in local cache, falling back to Google tokeninfo");
            return this.verifyWithTokeninfo(token, googleClientId);
        }

        try {
            const verifier = crypto.createVerify("RSA-SHA256");
            verifier.update(`${headerB64}.${payloadB64}`);
            const signature = Buffer.from(sigB64, "base64url");
            const isValid = verifier.verify(publicKey, signature);
            if (!isValid) {
                logger.warn("Local crypto RS256 signature mismatch, trying Google tokeninfo endpoint");
                return this.verifyWithTokeninfo(token, googleClientId);
            }

            return {
                sub: payload.sub,
                email: payload.email,
                email_verified: payload.email_verified,
                name: payload.name,
                picture: payload.picture,
                given_name: payload.given_name,
                family_name: payload.family_name,
            };
        } catch (verifyErr: any) {
            logger.warn({ err: verifyErr.message }, "Error during local crypto verify, trying tokeninfo");
            return this.verifyWithTokeninfo(token, googleClientId);
        }
    }

    private async verifyWithTokeninfo(token: string, googleClientId?: string): Promise<GoogleUserPayload | null> {
        try {
            logger.info("Calling Google oauth2 tokeninfo endpoint to verify token");
            const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`, {
                signal: AbortSignal.timeout(6000),
            });
            if (!res.ok) {
                const errText = await res.text().catch(() => "");
                logger.warn({ status: res.status, errText }, "Google tokeninfo endpoint rejected token");
                return null;
            }
            const data: any = await res.json();
            if (googleClientId && data.aud !== googleClientId && data.azp !== googleClientId) {
                logger.warn({ tokenAud: data.aud, tokenAzp: data.azp, expected: googleClientId }, "Tokeninfo audience mismatch");
                return null;
            }
            return {
                sub: data.sub,
                email: data.email,
                email_verified: data.email_verified === true || data.email_verified === "true",
                name: data.name,
                picture: data.picture,
                given_name: data.given_name,
                family_name: data.family_name,
            };
        } catch (err: any) {
            logger.error({ error: err.message }, "Error verifying token with Google tokeninfo");
            return null;
        }
    }
}

export const googleTokenVerifier = new GoogleTokenVerifier();
