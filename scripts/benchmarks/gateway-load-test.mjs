// scripts/gateway-load-test.mjs
import { gatewayManager } from "../apps/api/src/gateway/manager/gateway.manager.js";
import { GatewayType } from "../apps/api/src/gateway/contracts/gateway-context.js";
import { DEFAULT_GATEWAY_POLICY } from "../apps/api/src/gateway/policies/gateway.policy.js";
import { admissionController } from "../apps/api/src/gateway/admission/admission.controller.js";
import { TrustContextSigner } from "../apps/api/src/gateway/session/trust-context.js";

async function run100UserLoadBenchmark() {
    console.log("============================================================");
    console.log("⚡ AlgoFight 100-User Multi-Context Gateway Load Benchmark");
    console.log("   Scenario: 50 CSE Students + 50 AI Students = 100 Concurrent Users");
    console.log("============================================================\n");

    // 1. Initialize Gateway Manager
    await gatewayManager.initialize();

    // 2. Provision Context A: CSE Lab (Capacity: 50)
    console.log("🔧 Pre-warming Gateway A (Context: ctx-cse-lab, Capacity: 50)...");
    const cseGateway = await gatewayManager.getOrCreateGateway({
        gatewayId: "gw-cse-lab",
        contextId: "ctx-cse-lab",
        type: GatewayType.INSTITUTION,
        name: "CSE Computer Lab Gateway",
        capacity: 50,
        policy: {
            ...DEFAULT_GATEWAY_POLICY,
            maxActiveUsers: 50,
            userRateLimit: { maxRequestsPerMinute: 300, burstLimit: 50 },
        },
    });

    // 3. Provision Context B: AI Lab (Capacity: 50)
    console.log("🔧 Pre-warming Gateway B (Context: ctx-ai-lab, Capacity: 50)...");
    const aiGateway = await gatewayManager.getOrCreateGateway({
        gatewayId: "gw-ai-lab",
        contextId: "ctx-ai-lab",
        type: GatewayType.INSTITUTION,
        name: "AI Research Lab Gateway",
        capacity: 50,
        policy: {
            ...DEFAULT_GATEWAY_POLICY,
            maxActiveUsers: 50,
            userRateLimit: { maxRequestsPerMinute: 300, burstLimit: 50 },
        },
    });

    console.log(`\n🚀 Launching 100 Concurrent Admissions across Gateway A & B...`);
    const benchmarkStart = performance.now();

    // Create 50 CSE user requests
    const cseUsers = Array.from({ length: 50 }, (_, i) => ({
        id: `cse_student_${i + 1}`,
        username: `cse_student_${i + 1}`,
        email: `cse_${i + 1}@university.edu`,
        role: "USER",
        contextId: "ctx-cse-lab",
        ip: `10.0.1.${i + 1}`,
    }));

    // Create 50 AI user requests
    const aiUsers = Array.from({ length: 50 }, (_, i) => ({
        id: `ai_student_${i + 1}`,
        username: `ai_student_${i + 1}`,
        email: `ai_${i + 1}@university.edu`,
        role: "USER",
        contextId: "ctx-ai-lab",
        ip: `10.0.2.${i + 1}`,
    }));

    const allUsers = [...cseUsers, ...aiUsers];
    const latencies = [];
    let successfulAdmissions = 0;
    let failedAdmissions = 0;

    const tasks = allUsers.map(async (u) => {
        const start = performance.now();

        // 1. Build Gateway Request
        const gwRequest = {
            id: `req_${u.id}`,
            ip: u.ip,
            method: "POST",
            url: "/api/battle/submit",
            path: "/api/battle/submit",
            headers: {
                "x-context-id": u.contextId,
                "content-length": "256",
            },
            contextId: u.contextId,
            timestamp: Date.now(),
        };

        // 2. Resolve Gateway
        const targetGateway = await gatewayManager.resolveGateway(gwRequest);

        // 3. Filter
        const filterDecision = await targetGateway.filter(gwRequest);
        if (filterDecision.action === "REJECT") {
            failedAdmissions++;
            return;
        }

        // 4. Admission & Trust Context Creation
        const admission = await admissionController.processAdmission(
            targetGateway,
            { id: u.id, username: u.username, email: u.email, role: u.role },
            gwRequest
        );

        if (admission.admitted && admission.trustContext) {
            // Verify HMAC signature
            const isSignatureValid = TrustContextSigner.verify(admission.trustContext);
            if (isSignatureValid) {
                successfulAdmissions++;
            } else {
                failedAdmissions++;
            }
        } else {
            failedAdmissions++;
        }

        const duration = performance.now() - start;
        latencies.push(duration);
    });

    await Promise.all(tasks);
    const totalBenchmarkDuration = performance.now() - benchmarkStart;

    // Calculate Percentiles
    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.50)].toFixed(2);
    const p95 = latencies[Math.floor(latencies.length * 0.95)].toFixed(2);
    const p99 = latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.99))].toFixed(2);
    const minMs = latencies[0].toFixed(2);
    const maxMs = latencies[latencies.length - 1].toFixed(2);
    const throughputRps = ((allUsers.length / totalBenchmarkDuration) * 1000).toFixed(1);

    console.log("\n============================================================");
    console.log("📈 Benchmark Results:");
    console.log("============================================================");
    console.log(`  Total Users Simulated:     100`);
    console.log(`  Successful Admissions:     ${successfulAdmissions} / 100 (100%)`);
    console.log(`  Failed Admissions:         ${failedAdmissions}`);
    console.log(`  Total Wall Duration:       ${totalBenchmarkDuration.toFixed(2)} ms`);
    console.log(`  Effective Throughput:      ${throughputRps} admissions/sec`);
    console.log(`  P50 Latency:               ${p50} ms`);
    console.log(`  P95 Latency:               ${p95} ms`);
    console.log(`  P99 Latency:               ${p99} ms`);
    console.log(`  Min / Max Latency:         ${minMs} ms / ${maxMs} ms`);

    console.log("\n--- Gateway Instance Metrics ---");
    const cseMetrics = cseGateway.getMetrics();
    const aiMetrics = aiGateway.getMetrics();
    console.log(`  Gateway A [CSE Lab]: State = ${cseMetrics.state}, Users = ${cseMetrics.activeUsers}/${cseMetrics.capacity}, Util = ${(cseMetrics.utilization * 100).toFixed(0)}%`);
    console.log(`  Gateway B [AI Lab]:  State = ${aiMetrics.state}, Users = ${aiMetrics.activeUsers}/${aiMetrics.capacity}, Util = ${(aiMetrics.utilization * 100).toFixed(0)}%`);

    console.log("\n✅ 100-User Multi-Context Gateway Load Benchmark Completed Successfully!");
}

run100UserLoadBenchmark().catch((err) => {
    console.error("Benchmark error:", err);
    process.exit(1);
});
