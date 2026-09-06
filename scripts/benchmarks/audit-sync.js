import fs from "fs";
import path from "path";

const WSL_ROOT = "\\\\wsl.localhost\\Ubuntu\\home\\arin\\AlgoFight_Linux";
console.log("=== ALGOFIGHT FULL SYSTEM AUDIT & SYNC VERIFICATION ===");

// 1. Check WSL main.py routes
try {
    const mainPy = fs.readFileSync(path.join(WSL_ROOT, "app", "main.py"), "utf-8");
    console.log("✅ WSL main.py is accessible.");
    const routesMatch = mainPy.match(/include_router\([^)]+\)/g);
    console.log("Mounted routers in WSL main.py:", routesMatch);
} catch (e) {
    console.error("Error reading WSL main.py:", e.message);
}

// 2. Check packages/queue constants
const queueConstants = fs.readFileSync("packages/queue/src/constants/queue.constants.ts", "utf-8");
console.log("Queue constants:\n", queueConstants);

// 3. Test HTTP connectivity to WSL server
async function testEndpoints() {
    try {
        const ping = await fetch("http://localhost:8000/health").then(r => r.json()).catch(() => null);
        console.log("WSL Service /health:", ping);
        
        const testPool = await fetch("http://localhost:8000/api/v1/telemetry/runtime-pool", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                active_runtimes_count: 2,
                runtimes: [
                    { id: "piston-1", url: "http://localhost:2001", port: 2001, status: "HEALTHY", active_jobs: 0, is_baseline: true },
                    { id: "piston-2", url: "http://localhost:2002", port: 2002, status: "HEALTHY", active_jobs: 0, is_baseline: true }
                ],
                scaling_state: "STABLE",
                cooldown_seconds_remaining: 0,
                light_queue_depth: 0,
                heavy_queue_depth: 0,
            })
        }).then(r => r.json()).catch(e => e.message);
        console.log("POST /api/v1/telemetry/runtime-pool result:", testPool);

        const testQueues = await fetch("http://localhost:8000/api/v1/telemetry/queues", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                light_queue_depth: 0,
                heavy_queue_depth: 0,
                light_workers_busy: 0,
                heavy_workers_busy: 0,
            })
        }).then(r => r.json()).catch(e => e.message);
        console.log("POST /api/v1/telemetry/queues result:", testQueues);
    } catch (err) {
        console.log("HTTP test note:", err.message);
    }
}

testEndpoints();
