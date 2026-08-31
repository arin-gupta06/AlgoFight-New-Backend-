// apps/api/src/gateway/policies/gateway.policy.ts

export interface RateLimitPolicy {
    readonly maxRequestsPerMinute: number;
    readonly burstLimit: number;
}

export interface GatewayPolicy {
    readonly maxRequestBodySizeBytes: number; // e.g. 1048576 (1MB)
    readonly allowedMethods: string[]; // ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    readonly allowedOrigins?: string[] | boolean;
    readonly ipRateLimit: RateLimitPolicy;
    readonly userRateLimit: RateLimitPolicy;
    readonly maxActiveConnections: number;
    readonly maxActiveUsers: number;
    readonly enableIpJail: boolean;
    readonly maxFailedAuthBeforeJail: number; // e.g. 10 attempts
    readonly jailDurationSeconds: number; // e.g. 60 seconds
    readonly sessionTtlSeconds?: number;
}

export const DEFAULT_GATEWAY_POLICY: GatewayPolicy = {
    maxRequestBodySizeBytes: 1048576, // 1MB
    allowedMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedOrigins: true,
    ipRateLimit: {
        maxRequestsPerMinute: 3600, // Accommodates 50-100+ concurrent students sharing a single college lab/campus NAT IP
        burstLimit: 600,
    },
    userRateLimit: {
        maxRequestsPerMinute: 240, // Generous per-user rate limit (4 req/sec per individual student)
        burstLimit: 60,
    },
    maxActiveConnections: 2500,
    maxActiveUsers: 2000,
    enableIpJail: true,
    maxFailedAuthBeforeJail: 50, // Prevents a few bad student passwords from jailing the entire lab router IP
    jailDurationSeconds: 60,
    sessionTtlSeconds: 300,
};
