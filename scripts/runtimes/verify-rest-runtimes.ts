/**
 * Verification Script: Validates that all Piston instances (both prewarmed baseline & extended)
 * are callable through the public and admin REST APIs.
 */

const API_BASE = "http://localhost:3000/api";
const ADMIN_KEY = "7BCG2H";

let passed = 0;
let total = 0;

function assert(condition: boolean, msg: string) {
    total++;
    if (!condition) {
        console.error(`❌ FAIL: ${msg}`);
        throw new Error(`Assertion failed: ${msg}`);
    }
    passed++;
    console.log(`✅ PASS: ${msg}`);
}

async function run() {
    console.log("\n=======================================================");
    console.log("🚀 TESTING PISTON PREWARMED & EXTENDED REST API CALLABILITY");
    console.log("=======================================================\n");

    // 1. Discover Active Runtimes
    console.log("--- Step 1: Discover Active Runtimes via GET /api/runtimes ---");
    const runtimesRes = await fetch(`${API_BASE}/runtimes`);
    assert(runtimesRes.status === 200, "GET /api/runtimes returned HTTP 200");
    const runtimesData = await runtimesRes.json() as any;
    console.log("Discovered Runtimes:", runtimesData.runtimes.map((r: any) => `${r.id} (${r.url}) [${r.type}] Reachable: ${r.reachable}`));
    assert(runtimesData.runtimes.length >= 2, "Found at least 2 baseline runtimes");
    assert(runtimesData.runtimes.some((r: any) => r.port === 2001 && r.reachable), "Port 2001 is baseline prewarmed and reachable");
    assert(runtimesData.runtimes.some((r: any) => r.port === 2002 && r.reachable), "Port 2002 is baseline prewarmed and reachable");

    // 2. Call Prewarmed Runtime 2001 directly via REST API
    console.log("\n--- Step 2: Call Prewarmed Instance (Port 2001) via POST /api/submissions/execute-direct ---");
    const exec2001Res = await fetch(`${API_BASE}/submissions/execute-direct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            language: "python",
            code: "print('PREWARMED_2001_VERIFIED')",
            runtimePort: 2001,
        }),
    });
    assert(exec2001Res.status === 200, "Direct execution on Port 2001 returned HTTP 200");
    const exec2001Data = await exec2001Res.json() as any;
    console.log("Port 2001 Output:", exec2001Data.run.stdout.trim());
    assert(exec2001Data.targetRuntime.port === 2001, "Target runtime confirmed as Port 2001");
    assert(exec2001Data.run.stdout.includes("PREWARMED_2001_VERIFIED"), "Execution stdout matches expected output on 2001");

    // 3. Call Prewarmed Runtime 2002 directly via REST API
    console.log("\n--- Step 3: Call Prewarmed Instance (Port 2002) via POST /api/submissions/execute-direct ---");
    const exec2002Res = await fetch(`${API_BASE}/submissions/execute-direct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            language: "cpp",
            code: '#include <iostream>\nint main() { std::cout << "PREWARMED_2002_VERIFIED\\n"; return 0; }',
            targetRuntimeUrl: "http://localhost:2002",
        }),
    });
    assert(exec2002Res.status === 200, "Direct execution on Port 2002 returned HTTP 200");
    const exec2002Data = await exec2002Res.json() as any;
    console.log("Port 2002 Output:", exec2002Data.run.stdout.trim());
    assert(exec2002Data.targetRuntime.port === 2002, "Target runtime confirmed as Port 2002");
    assert(exec2002Data.run.stdout.includes("PREWARMED_2002_VERIFIED"), "Execution stdout matches expected output on 2002");

    // 4. Elastic Scale-Out: Spawn Extended Container (Port 2003) via Admin REST API
    console.log("\n--- Step 4: Scale Out Extended Container via POST /api/admin/runtime-pool/scale-out ---");
    const scaleOutRes = await fetch(`${API_BASE}/admin/runtime-pool/scale-out`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-admin-key": ADMIN_KEY,
        },
        body: JSON.stringify({ reason: "Verification Test: Scale-out extended container" }),
    });
    assert(scaleOutRes.status === 200, "Scale-out endpoint returned HTTP 200");
    const scaleOutData = await scaleOutRes.json() as any;
    console.log("Scale-out Result:", scaleOutData.instance);
    assert(scaleOutData.success === true, "Scale-out succeeded");
    assert(scaleOutData.instance.port === 2003, "New extended container created on port 2003");

    // 5. Verify Pool Snapshot Now Shows 3 Active Runtimes Including Extended
    console.log("\n--- Step 5: Verify Pool Discovery Shows Extended Instance (Port 2003) ---");
    const poolRes2 = await fetch(`${API_BASE}/runtimes`);
    const poolData2 = await poolRes2.json() as any;
    console.log("Updated Runtimes in Pool:", poolData2.runtimes.map((r: any) => `${r.id} (${r.url}) [${r.type}] Reachable: ${r.reachable}`));
    assert(poolData2.runtimes.some((r: any) => r.port === 2003), "Extended container on port 2003 is listed in pool");

    // 6. Call Extended Container (Port 2003) directly via REST API
    console.log("\n--- Step 6: Call Extended Instance (Port 2003) via POST /api/submissions/execute-direct ---");
    const execExtendedRes = await fetch(`${API_BASE}/submissions/execute-direct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            language: "python",
            code: "print('EXTENDED_2003_CONTAINER_SUCCESSFULLY_CALLED_VIA_REST_API')",
            runtimePort: 2003,
        }),
    });
    assert(execExtendedRes.status === 200, "Direct execution on Extended Port 2003 returned HTTP 200");
    const execExtendedData = await execExtendedRes.json() as any;
    console.log("Extended Port 2003 Output:", execExtendedData.run.stdout.trim());
    assert(execExtendedData.targetRuntime.port === 2003, "Target runtime confirmed as Port 2003");
    assert(execExtendedData.targetRuntime.type === "EXTENDED_EPHEMERAL", "Target runtime is confirmed as EXTENDED_EPHEMERAL");
    assert(execExtendedData.run.stdout.includes("EXTENDED_2003_CONTAINER_SUCCESSFULLY_CALLED_VIA_REST_API"), "Extended container execution matches expected output");

    // 7. Broadcast Probe All Active Runtimes (Prewarmed + Extended)
    console.log("\n--- Step 7: Probe All Active Runtimes via POST /api/admin/runtime-pool/probe-all ---");
    const probeRes = await fetch(`${API_BASE}/admin/runtime-pool/probe-all`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-admin-key": ADMIN_KEY,
        },
        body: JSON.stringify({
            language: "python",
            code: "print('MULTI_RUNTIME_BROADCAST_OK')",
        }),
    });
    assert(probeRes.status === 200, "Probe-all endpoint returned HTTP 200");
    const probeData = await probeRes.json() as any;
    console.log("Probe Results across all instances:", probeData.results.map((r: any) => `${r.id} (${r.url}): ${r.status} (${r.latencyMs}ms)`));
    assert(probeData.results.every((r: any) => r.status === "HEALTHY" && r.reachable), "All active runtimes (prewarmed & extended) passed live probe");

    // 8. Scale-In: Gracefully Drain and Destroy Extended Container
    console.log("\n--- Step 8: Scale In Extended Container via POST /api/admin/runtime-pool/scale-in ---");
    const scaleInRes = await fetch(`${API_BASE}/admin/runtime-pool/scale-in`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-admin-key": ADMIN_KEY,
        },
        body: JSON.stringify({}),
    });
    if (scaleInRes.status !== 200) {
        console.error("Scale-in failed:", scaleInRes.status, await scaleInRes.text());
    }
    assert(scaleInRes.status === 200, "Scale-in endpoint returned HTTP 200");
    const scaleInData = await scaleInRes.json() as any;
    console.log("Scale-in Result:", scaleInData);
    assert(scaleInData.success === true, "Scale-in successfully drained extended container");

    // 9. Final Verification of Stable Baseline Pool
    console.log("\n--- Step 9: Final Verification of Pool State ---");
    const finalRes = await fetch(`${API_BASE}/runtimes`);
    const finalData = await finalRes.json() as any;
    assert(finalData.runtimes.length === 2, "Pool returned to baseline count of 2");
    assert(!finalData.runtimes.some((r: any) => r.port === 2003), "Extended container port 2003 successfully removed");

    console.log("\n=======================================================");
    console.log(`🎉 ALL ${passed}/${total} REST RUNTIME VERIFICATION TESTS PASSED!`);
    console.log("=======================================================\n");
}

run().catch((err) => {
    console.error("Verification script failed:", err);
    process.exit(1);
});
