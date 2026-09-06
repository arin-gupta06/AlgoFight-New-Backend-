// scripts/gateway-security-tests.mjs
import assert from "assert";
import crypto from "crypto";
import { GatewayStateMachine } from "../apps/api/src/gateway/state/gateway-state-machine.js";
import { GatewayState } from "../apps/api/src/gateway/state/gateway.state.js";
import { TrustContextSigner } from "../apps/api/src/gateway/session/trust-context.js";
import { revocationStore } from "../apps/api/src/gateway/session/revocation-store.js";
import { ipJail } from "../apps/api/src/gateway/policies/ip-jail.js";
import { gatewayRateLimiter } from "../apps/api/src/gateway/policies/rate-limiter.js";
import { UserGateway } from "../apps/api/src/gateway/implementations/user.gateway.js";
import { GatewayType } from "../apps/api/src/gateway/contracts/gateway-context.js";
import { DEFAULT_GATEWAY_POLICY } from "../apps/api/src/gateway/policies/gateway.policy.js";
import { admissionPolicyEngine, PathPrefixClassifierRule } from "../apps/api/src/gateway/admission/admission-policy.js";

async function runSecurityAndReliabilityTests() {
    console.log("============================================================");
    console.log("🛡️  AlgoFight Gateway Security & Reliability Verification Suite");
    console.log("============================================================\n");

    let passed = 0;
    let failed = 0;

    function test(name, fn) {
        try {
            fn();
            console.log(`  ✅ PASS: ${name}`);
            passed++;
        } catch (err) {
            console.error(`  ❌ FAIL: ${name}`);
            console.error(`     Error: ${err.message}`);
            failed++;
        }
    }

    async function asyncTest(name, fn) {
        try {
            await fn();
            console.log(`  ✅ PASS: ${name}`);
            passed++;
        } catch (err) {
            console.error(`  ❌ FAIL: ${name}`);
            console.error(`     Error: ${err.message}`);
            failed++;
        }
    }

    console.log("--- 1. Gateway State Machine Transitions (State Pattern) ---");

    test("1.1 Legal transition CREATED -> WARMING -> READY -> ACTIVE", () => {
        const sm = new GatewayStateMachine("test-gw-1", GatewayState.CREATED);
        assert.strictEqual(sm.getState(), GatewayState.CREATED);

        sm.transition(GatewayState.WARMING, "Start warmup");
        assert.strictEqual(sm.getState(), GatewayState.WARMING);

        sm.transition(GatewayState.READY, "Warmed up");
        assert.strictEqual(sm.getState(), GatewayState.READY);

        sm.transition(GatewayState.ACTIVE, "Serving traffic");
        assert.strictEqual(sm.getState(), GatewayState.ACTIVE);
    });

    test("1.2 Illegal transition DESTROYED -> ACTIVE must throw", () => {
        const sm = new GatewayStateMachine("test-gw-2", GatewayState.DESTROYED);
        assert.throws(() => {
            sm.transition(GatewayState.ACTIVE, "Should fail");
        }, /Illegal Gateway state transition/);
    });

    test("1.3 Failure degradation ACTIVE -> DEGRADED -> ACTIVE", () => {
        const sm = new GatewayStateMachine("test-gw-3", GatewayState.ACTIVE);
        sm.transition(GatewayState.DEGRADED, "Transient backend slowdown");
        assert.strictEqual(sm.getState(), GatewayState.DEGRADED);

        sm.transition(GatewayState.ACTIVE, "Recovered");
        assert.strictEqual(sm.getState(), GatewayState.ACTIVE);
    });

    console.log("\n--- 2. Cryptographic Trust Context & HMAC Attestation ---");

    test("2.1 Valid Trust Context passes HMAC verification", () => {
        const now = Math.floor(Date.now() / 1000);
        const context = {
            userId: "user_test_123",
            sessionId: "sess_abc",
            gatewayId: "gw-test",
            contextId: "ctx-cse-lab",
            issuedAt: now,
            expiresAt: now + 3600,
            role: "USER",
            assignedTier: "TIER_1",
        };

        const signature = TrustContextSigner.sign(context);
        const fullContext = { ...context, signature };

        assert.strictEqual(TrustContextSigner.verify(fullContext), true);
    });

    test("2.2 Tampered Trust Context (e.g. role elevated to ADMIN) fails HMAC verification", () => {
        const now = Math.floor(Date.now() / 1000);
        const context = {
            userId: "user_attacker",
            sessionId: "sess_abc",
            gatewayId: "gw-test",
            contextId: "ctx-cse-lab",
            issuedAt: now,
            expiresAt: now + 3600,
            role: "USER",
            assignedTier: "TIER_4",
        };

        const signature = TrustContextSigner.sign(context);
        // Attacker attempts to change role to ADMIN without re-signing with secret
        const tamperedContext = { ...context, role: "ADMIN", signature };

        assert.strictEqual(TrustContextSigner.verify(tamperedContext), false);
    });

    test("2.3 Expired Trust Context fails verification", () => {
        const past = Math.floor(Date.now() / 1000) - 100;
        const context = {
            userId: "user_test_123",
            sessionId: "sess_abc",
            gatewayId: "gw-test",
            contextId: "ctx-cse-lab",
            issuedAt: past - 3600,
            expiresAt: past,
            role: "USER",
            assignedTier: "TIER_1",
        };

        const signature = TrustContextSigner.sign(context);
        const expiredContext = { ...context, signature };

        assert.strictEqual(TrustContextSigner.verify(expiredContext), false);
    });

    console.log("\n--- 3. Session Revocation & Banned User Killswitch ---");

    test("3.1 Revoked token is rejected by RevocationStore", () => {
        const token = "banned.jwt.token";
        assert.strictEqual(revocationStore.isRevoked({ token }), false);

        revocationStore.revokeToken(token);
        assert.strictEqual(revocationStore.isRevoked({ token }), true);
    });

    test("3.2 Banned user session is rejected instantly", () => {
        const userId = "cheater_999";
        revocationStore.revokeUser(userId);
        assert.strictEqual(revocationStore.isRevoked({ userId, issuedAt: Math.floor(Date.now() / 1000) - 10 }), true);
    });

    console.log("\n--- 4. Anti-Abuse IP Jail & Rate Limiter ---");

    test("4.1 Repeated failed auth attempts trigger IP Jail", () => {
        const testIp = "192.168.100.50";
        ipJail.reset(testIp);
        assert.strictEqual(ipJail.isJailed(testIp), false);

        // Simulate 10 failed attempts
        for (let i = 0; i < 9; i++) {
            ipJail.recordFailedAttempt(testIp, 10, 60);
        }
        assert.strictEqual(ipJail.isJailed(testIp), false);

        // 10th attempt triggers jail
        const jailed = ipJail.recordFailedAttempt(testIp, 10, 60);
        assert.strictEqual(jailed, true);
        assert.strictEqual(ipJail.isJailed(testIp), true);
    });

    test("4.2 Multi-dimensional Token Bucket Rate Limiter throttles excessive bursts", () => {
        const key = "user:rapid_fire_user";
        const maxPerMin = 60;
        const burst = 5;

        // First 5 burst requests allowed
        for (let i = 0; i < 5; i++) {
            const res = gatewayRateLimiter.checkRateLimit(key, maxPerMin, burst);
            assert.strictEqual(res.allowed, true);
        }

        // 6th request rejected
        const overflow = gatewayRateLimiter.checkRateLimit(key, maxPerMin, burst);
        assert.strictEqual(overflow.allowed, false);
        assert.ok(overflow.retryAfterSeconds > 0);
    });

    console.log("\n--- 5. Traffic Priority & OCP-Compliant Admission Policy ---");

    test("5.1 Custom classifier rule extends engine without code modification (OCP)", () => {
        const customRule = new PathPrefixClassifierRule(["/anti-cheat", "/telemetry-stream"], "TIER_1", 50);
        admissionPolicyEngine.registerRule(customRule);

        assert.strictEqual(admissionPolicyEngine.classifyTraffic("/api/anti-cheat/check", "POST"), "TIER_1");
        assert.strictEqual(admissionPolicyEngine.classifyTraffic("/api/problems/1", "GET"), "TIER_3");
    });

    test("5.2 Load shedding protects Tier 1 while dropping Tier 4 under 95% load", () => {
        assert.strictEqual(admissionPolicyEngine.shouldAdmit("TIER_1", 0.96), true);
        assert.strictEqual(admissionPolicyEngine.shouldAdmit("TIER_4", 0.96), false);
    });

    console.log("\n--- 6. User Gateway Contract & Capacity Enforcement ---");

    await asyncTest("6.1 UserGateway rejects requests exceeding max payload size (413)", async () => {
        const gw = new UserGateway({
            gatewayId: "gw-capacity-test",
            contextId: "ctx-lab-1",
            type: GatewayType.USER,
            name: "Lab Gateway",
            capacity: 2,
            policy: DEFAULT_GATEWAY_POLICY,
        });

        await gw.initialize(gw.context);
        await gw.activate();

        const oversizedReq = {
            id: "req-1",
            ip: "127.0.0.1",
            method: "POST",
            url: "/api/test",
            path: "/api/test",
            headers: {},
            contentLength: 2000000, // 2MB (> 1MB limit)
            timestamp: Date.now(),
        };

        const decision = await gw.filter(oversizedReq);
        assert.strictEqual(decision.action, "REJECT");
        assert.strictEqual(decision.statusCode, 413);
    });

    await asyncTest("6.2 UserGateway enforces max active user capacity (503/429)", async () => {
        const gw = new UserGateway({
            gatewayId: "gw-capacity-test-2",
            contextId: "ctx-lab-2",
            type: GatewayType.USER,
            name: "Small Lab Gateway",
            capacity: 2,
            policy: DEFAULT_GATEWAY_POLICY,
        });

        await gw.initialize(gw.context);
        await gw.activate();

        const dummyReq = {
            id: "r",
            ip: "127.0.0.1",
            method: "GET",
            url: "/",
            path: "/",
            headers: {},
            timestamp: Date.now(),
        };

        // Admit user 1 & user 2
        const r1 = await gw.admit({ id: "user_1", role: "USER" }, dummyReq);
        const r2 = await gw.admit({ id: "user_2", role: "USER" }, dummyReq);
        assert.strictEqual(r1.admitted, true);
        assert.strictEqual(r2.admitted, true);

        // User 3 exceeds capacity
        const r3 = await gw.admit({ id: "user_3", role: "USER" }, dummyReq);
        assert.strictEqual(r3.admitted, false);
        assert.strictEqual(r3.statusCode, 429);
    });

    console.log("\n============================================================");
    console.log(`📊 Summary: ${passed} Passed, ${failed} Failed`);
    console.log("============================================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runSecurityAndReliabilityTests().catch((err) => {
    console.error("FATAL test runner error:", err);
    process.exit(1);
});
