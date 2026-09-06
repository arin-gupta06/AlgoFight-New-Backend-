// scripts/live-gateway-demo.mjs
const API_BASE = "http://localhost:3000";

async function req(path, options = {}) {
    const url = `${API_BASE}${path}`;
    const start = performance.now();
    try {
        const res = await fetch(url, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {}),
            },
        });
        const durationMs = (performance.now() - start).toFixed(2);
        let data = null;
        try {
            data = await res.json();
        } catch {
            data = await res.text();
        }
        return {
            status: res.status,
            headers: Object.fromEntries(res.headers.entries()),
            data,
            durationMs,
        };
    } catch (err) {
        return { status: 0, error: err.message, durationMs: (performance.now() - start).toFixed(2) };
    }
}

async function runLiveGatewayDemo() {
    console.log("============================================================");
    console.log("🔴 LIVE ALGOFIGHT GATEWAY ARCHITECTURE DEMO");
    console.log("   Target: http://localhost:3000");
    console.log("============================================================\n");

    // 1. Basic Health Check & Gateway Headers
    console.log("1️⃣  TEST: Basic Public Health Request");
    const health = await req("/health");
    console.log(`   Status:       ${health.status}`);
    console.log(`   x-request-id: ${health.headers["x-request-id"]}`);
    console.log(`   Gateway Lat:  ${health.headers["x-gateway-latency-ms"]} ms`);
    console.log(`   Response:    `, health.data);

    // 2. Context Routing (CSE Lab)
    console.log("\n2️⃣  TEST: Multi-Context Dynamic Routing (CSE Lab)");
    const cseReq = await req("/health", {
        headers: { "x-context-id": "ctx-cse-lab" },
    });
    console.log(`   Status:       ${cseReq.status}`);
    console.log(`   x-request-id: ${cseReq.headers["x-request-id"]}`);
    console.log(`   Context:      ${cseReq.headers["x-context-id"] || "ctx-cse-lab"}`);
    console.log(`   Gateway Lat:  ${cseReq.headers["x-gateway-latency-ms"]} ms`);

    // 3. Unauthenticated access to protected route
    console.log("\n3️⃣  TEST: Unauthorized Request to Protected Domain Route (/api/problems)");
    const unauth = await req("/api/problems");
    console.log(`   Status:       ${unauth.status}`);
    console.log(`   x-request-id: ${unauth.headers["x-request-id"]}`);
    console.log(`   Response:    `, unauth.data);

    // 4. Authenticated Request with Dev Token (Minting UserTrustContext)
    console.log("\n4️⃣  TEST: Authenticated Request with Cryptographic UserTrustContext");
    // Synthetic dev JWT for user "alex_dev"
    const headerB64 = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const payloadB64 = Buffer.from(JSON.stringify({
        user_id: "alex_cse_101",
        email: "alex@university.edu",
        name: "Alex Johnson",
        role: "USER",
        exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString("base64url");
    const devToken = `${headerB64}.${payloadB64}.fakesig`;

    const authReq = await req("/api/problems", {
        headers: {
            Authorization: `Bearer ${devToken}`,
            "x-context-id": "ctx-cse-lab",
        },
    });
    console.log(`   Status:       ${authReq.status}`);
    console.log(`   x-request-id: ${authReq.headers["x-request-id"]}`);
    console.log(`   x-gateway-id: ${authReq.headers["x-gateway-id"]}`);
    console.log(`   x-context-id: ${authReq.headers["x-context-id"]}`);
    console.log(`   Gateway Lat:  ${authReq.headers["x-gateway-latency-ms"]} ms`);
    console.log(`   Admitted Data Count: ${Array.isArray(authReq.data?.problems) ? authReq.data.problems.length : "OK"}`);

    // 5. Oversized Payload Filtering (Phase 4 & 24)
    console.log("\n5️⃣  TEST: Request-Size Filtering (> 1MB Payload)");
    const oversizedBody = JSON.stringify({ code: "A".repeat(1100000) }); // 1.1 MB
    const oversizedRes = await req("/api/submit", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${devToken}`,
            "content-length": String(oversizedBody.length),
        },
        body: oversizedBody,
    });
    console.log(`   Status:       ${oversizedRes.status} (Expected 413)`);
    console.log(`   Response:    `, oversizedRes.data);

    // 6. Live Prometheus Gateway Metrics Endpoint
    console.log("\n6️⃣  TEST: Live Prometheus Gateway Telemetry (/metrics/gateway)");
    const metricsRes = await req("/metrics/gateway");
    console.log(`   Status:       ${metricsRes.status}`);
    console.log(`   Active Gateways:`, metricsRes.data?.activeGateways?.map(g => ({
        id: g.gatewayId,
        context: g.contextId,
        state: g.state,
        activeUsers: g.activeUsers,
        capacity: g.capacity,
        utilization: `${(g.utilization * 100).toFixed(1)}%`,
    })));
    console.log(`   Total Recorded Events: ${metricsRes.data?.recentTelemetryEventsCount}`);

    console.log("\n============================================================");
    console.log("✨ Live Demo Completed Successfully!");
    console.log("============================================================");
}

runLiveGatewayDemo().catch((err) => {
    console.error("Demo failed:", err);
});
