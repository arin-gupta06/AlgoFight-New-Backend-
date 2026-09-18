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
        if (!token || typeof token !== "string") return null;

        const parts = token.split(".");
        if (parts.length !== 3) return null;

        const [headerB64, payloadB64, sigB64] = parts;
        let header: any;
        let payload: any;

        try {
            header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf-8"));
            payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
        } catch {
            return null;
        }

        if (header.alg !== "RS256" || !header.kid) return null;

        // Verify expiration
        const nowSec = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < nowSec) {
            return null;
        }

        // Verify issuer
        const validIssuers = ["https://accounts.google.com", "accounts.google.com"];
        if (!payload.iss || !validIssuers.includes(payload.iss)) {
            return null;
        }

        // Verify audience if configured
        const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
        if (googleClientId && payload.aud !== googleClientId) {
            return null;
        }

        const keys = await this.refreshJwks();
        const publicKey = keys.get(header.kid);
        if (!publicKey) return null;

        try {
            const verifier = crypto.createVerify("RSA-SHA256");
            verifier.update(`${headerB64}.${payloadB64}`);
            const signature = Buffer.from(sigB64, "base64url");
            const isValid = verifier.verify(publicKey, signature);
            if (!isValid) return null;

            return {
                sub: payload.sub,
                email: payload.email,
                email_verified: payload.email_verified,
                name: payload.name,
                picture: payload.picture,
                given_name: payload.given_name,
                family_name: payload.family_name,
            };
        } catch {
            return null;
        }
    }
}

export const googleTokenVerifier = new GoogleTokenVerifier();
