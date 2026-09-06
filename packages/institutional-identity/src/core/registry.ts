// packages/institutional-identity/src/core/registry.ts
import { InstituteConfig } from "./types";
import { mitsInstituteConfig } from "../institutes/mits/mits.config";

export class InstituteRegistry {
    private readonly institutesByDomain = new Map<string, InstituteConfig>();
    private readonly institutesById = new Map<string, InstituteConfig>();

    constructor() {
        // Register default initial institutes
        this.register(mitsInstituteConfig);
    }

    public register(config: InstituteConfig): void {
        const domainNormalized = config.domain.toLowerCase().trim();
        this.institutesByDomain.set(domainNormalized, config);
        this.institutesById.set(config.id, config);

        if (config.aliases && Array.isArray(config.aliases)) {
            for (const alias of config.aliases) {
                this.institutesByDomain.set(alias.toLowerCase().trim(), config);
            }
        }
    }

    public resolveByDomain(domain: string): InstituteConfig | null {
        if (!domain) return null;
        const normalized = domain.toLowerCase().trim();
        return this.institutesByDomain.get(normalized) || null;
    }

    public getById(id: string): InstituteConfig | null {
        return this.institutesById.get(id) || null;
    }

    public isSupportedDomain(domain: string): boolean {
        return this.resolveByDomain(domain) !== null;
    }

    public extractEmailParts(email: string): { localPart: string; domain: string } | null {
        if (!email || typeof email !== "string") return null;
        const parts = email.trim().toLowerCase().split("@");
        if (parts.length !== 2) return null;
        const [localPart, domain] = parts;
        if (!localPart || !domain) return null;
        return { localPart, domain };
    }

    public getAllInstitutes(): InstituteConfig[] {
        return Array.from(this.institutesById.values());
    }
}

// Global default singleton registry
export const defaultInstituteRegistry = new InstituteRegistry();
