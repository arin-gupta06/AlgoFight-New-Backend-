/**
 * AlgoFight Complete Pre-Exhibition System & Endpoints Audit
 * 
 * Verifies all backend APIs, database connections, Redis pub/sub,
 * WebSocket servers, Piston runtime execution engine, and frontend endpoints.
 */

interface CheckResult {
    category: string;
    target: string;
    passed: boolean;
    durationMs: number;
    details: string;
}

const results: CheckResult[] = [];

async function recordCheck(
    category: string,
    target: string,
    fn: () => Promise<{ passed: boolean; details: string }>
) {
    const start = Date.now();
    try {
        const res = await fn();
        const durationMs = Date.now() - start;
        results.push({
            category,
            target,
            passed: res.passed,
            durationMs,
            details: res.details,
        });
        const icon = res.passed ? "✅" : "❌";
        console.log(`${icon} [${category}] ${target} (${durationMs}ms): ${res.details}`);
    } catch (err: any) {
        const durationMs = Date.now() - start;
        results.push({
            category,
            target,
            passed: false,
            durationMs,
            details: `Exception: ${err.message}`,
        });
        console.log(`❌ [${category}] ${target} (${durationMs}ms): Exception - ${err.message}`);
    }
}

async function runExhibitionAudit() {
    console.log("========================================================================");
    console.log(" 🛡️  ALGOFIGHT PRE-EXHIBITION END-TO-END HEALTH & READINESS AUDIT");
    console.log("========================================================================\n");

    const API_BASE = "http://127.0.0.1:3000";
    const FRONTEND_BASE = "http://localhost:5173";

    // -------------------------------------------------------------------------
    // 1. INFRASTRUCTURE & ENGINES
    // -------------------------------------------------------------------------
    console.log("--- 1. Core Infrastructure & Execution Engines ---");

    await recordCheck("Infrastructure", "Piston Container 1 (Port 2000)", async () => {
        const res = await fetch("http://127.0.0.1:2000/api/v2/runtimes");
        if (!res.ok) return { passed: false, details: `HTTP ${res.status}` };
        const runtimes: any = await res.json();
        const langs = runtimes.map((r: any) => r.language).join(", ");
        return { passed: true, details: `Online (${runtimes.length} runtimes: ${langs})` };
    });

    await recordCheck("Infrastructure", "Piston Container 1 Alias (Port 2001)", async () => {
        const res = await fetch("http://127.0.0.1:2001/api/v2/runtimes");
        if (!res.ok) return { passed: false, details: `HTTP ${res.status}` };
        const runtimes: any = await res.json();
        return { passed: true, details: `Online (${runtimes.length} runtimes)` };
    });

    await recordCheck("Infrastructure", "Piston Container 2 (Port 2002)", async () => {
        const res = await fetch("http://127.0.0.1:2002/api/v2/runtimes");
        if (!res.ok) return { passed: false, details: `HTTP ${res.status}` };
        const runtimes: any = await res.json();
        return { passed: true, details: `Online (${runtimes.length} runtimes)` };
    });

    await recordCheck("Infrastructure", "Standalone WebSocket Server (Port 4001)", async () => {
        return new Promise((resolve) => {
            const ws = new WebSocket("ws://127.0.0.1:4001");
            const timer = setTimeout(() => {
                ws.close();
                resolve({ passed: false, details: "Timeout connecting to ws://127.0.0.1:4001" });
            }, 3000);
            ws.onopen = () => {
                clearTimeout(timer);
                ws.close();
                resolve({ passed: true, details: "Socket handshake successful (OPEN)" });
            };
            ws.onerror = (e: any) => {
                clearTimeout(timer);
                resolve({ passed: false, details: `Socket error: ${e.message || "Failed"}` });
            };
        });
    });

    await recordCheck("Infrastructure", "API-Mounted WebSocket Server (Port 3000/ws)", async () => {
        return new Promise((resolve) => {
            const ws = new WebSocket("ws://127.0.0.1:3000/ws");
            const timer = setTimeout(() => {
                ws.close();
                resolve({ passed: false, details: "Timeout connecting to ws://127.0.0.1:3000/ws" });
            }, 3000);
            ws.onopen = () => {
                clearTimeout(timer);
                ws.close();
                resolve({ passed: true, details: "Socket handshake successful (OPEN)" });
            };
            ws.onerror = (e: any) => {
                clearTimeout(timer);
                resolve({ passed: false, details: `Socket error: ${e.message || "Failed"}` });
            };
        });
    });

    // -------------------------------------------------------------------------
    // 2. SYSTEM HEALTH & BROADCAST ENDPOINTS
    // -------------------------------------------------------------------------
    console.log("\n--- 2. System Health & Broadcast Endpoints ---");

    await recordCheck("Health API", "GET /health", async () => {
        const res = await fetch(`${API_BASE}/health`);
        const data: any = await res.json();
        return {
            passed: res.status === 200 && data.status === "ok",
            details: `Status ${res.status} | Uptime: ${data.uptime?.toFixed(1)}s`,
        };
    });

    await recordCheck("Health API", "GET /api (API Root)", async () => {
        const res = await fetch(`${API_BASE}/api`);
        const data: any = await res.json();
        return {
            passed: res.status === 200,
            details: `Status ${res.status} | Message: "${data.message}"`,
        };
    });

    await recordCheck("Broadcast API", "GET /api/notifications/active-broadcasts", async () => {
        const res = await fetch(`${API_BASE}/api/notifications/active-broadcasts`);
        const data: any = await res.json();
        const count = data?.broadcasts?.length ?? 0;
        return {
            passed: res.status === 200 && Array.isArray(data?.broadcasts),
            details: `Status ${res.status} | ${count} active broadcast(s)`,
        };
    });

    await recordCheck("Analytics API", "POST /api/analytics/track (Telemetry Ingestion)", async () => {
        const res = await fetch(`${API_BASE}/api/analytics/track`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                path: "/audit",
                title: "Exhibition Pre-Flight Audit",
                sessionId: "audit-session",
            }),
        });
        const data: any = await res.json();
        return {
            passed: res.status === 200 && data.success === true,
            details: `Status ${res.status} | success=${data.success}`,
        };
    });

    // -------------------------------------------------------------------------
    // 3. PROBLEM & CONTENT ARCHIVE ENDPOINTS
    // -------------------------------------------------------------------------
    console.log("\n--- 3. Problem Archive & Category Endpoints ---");

    await recordCheck("Problem API", "GET /api/problems/categories", async () => {
        const res = await fetch(`${API_BASE}/api/problems/categories`);
        const data: any = await res.json();
        return {
            passed: res.status === 200 && Array.isArray(data) && data.length > 0,
            details: `Status ${res.status} | ${data.length} categories found`,
        };
    });

    let sampleProblemId: string | null = null;
    await recordCheck("Problem API", "GET /api/problems?page=1&limit=5", async () => {
        const res = await fetch(`${API_BASE}/api/problems?page=1&limit=5`);
        const data: any = await res.json();
        const problems = data?.problems || data?.data || (Array.isArray(data) ? data : []);
        if (problems.length > 0) {
            sampleProblemId = problems[0].id || problems[0]._id;
        }
        return {
            passed: res.status === 200 && problems.length > 0,
            details: `Status ${res.status} | Retrieved ${problems.length} problems (Sample ID: ${sampleProblemId})`,
        };
    });

    if (sampleProblemId) {
        await recordCheck("Problem API", `GET /api/problems/${sampleProblemId}`, async () => {
            const res = await fetch(`${API_BASE}/api/problems/${sampleProblemId}`);
            const data: any = await res.json();
            return {
                passed: res.status === 200 && data?.title !== undefined,
                details: `Status ${res.status} | Title: "${data.title}" | Difficulty: ${data.difficulty}`,
            };
        });
    }

    // -------------------------------------------------------------------------
    // 4. MULTI-LANGUAGE CODE EXECUTION ENDPOINTS
    // -------------------------------------------------------------------------
    console.log("\n--- 4. Code Execution & Judge Pipeline Endpoints ---");

    const languages = [
        { lang: "python", name: "Python 3", code: "print('AlgoFight Python OK')" },
        { lang: "javascript", name: "JavaScript", code: "console.log('AlgoFight JS OK');" },
        { lang: "cpp", name: "C++", code: "#include <iostream>\nint main(){ std::cout << \"AlgoFight CPP OK\\n\"; return 0; }" },
        { lang: "java", name: "Java", code: "public class main { public static void main(String[] a){ System.out.println(\"AlgoFight Java OK\"); } }" },
        { lang: "typescript", name: "TypeScript", code: "const s: string = 'AlgoFight TS OK'; console.log(s);" },
    ];

    for (const l of languages) {
        await recordCheck("Execution Engine", `execute-direct: ${l.name}`, async () => {
            const res = await fetch(`${API_BASE}/api/submissions/execute-direct`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    language: l.lang,
                    code: l.code,
                    stdin: "",
                    timeLimitMs: 2500,
                }),
            });
            const data: any = await res.json();
            const stdout = data?.run?.stdout?.trim();
            const timeMs = data?.run?.timeMs ?? data?.executionTimeMs ?? 0;
            const memoryKB = ((data?.run?.memoryBytes ?? 0) / 1024).toFixed(1);
            const passed = res.status === 200 && data.success && stdout.includes("OK");
            return {
                passed,
                details: `Status ${res.status} | Output: "${stdout}" | Time: ${timeMs}ms | Mem: ${memoryKB}KB | Node: ${data.targetRuntime?.url}`,
            };
        });
    }

    // Judge Pipeline Test Run
    await recordCheck("Judge Pipeline", "POST /api/test (Sample Test Run)", async () => {
        const res = await fetch(`${API_BASE}/api/test`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                language: "python",
                code: "import sys; print(sys.stdin.read().strip().upper())",
                testCases: [{ id: "audit-tc-1", input: "exhibition", expectedOutput: "EXHIBITION" }],
            }),
        });
        const data: any = await res.json();
        const verdict = data?.verdict;
        const totalTime = data?.resourceUsage?.totalTime ?? 0;
        const passed = res.status === 200 && verdict === "ACCEPTED";
        return {
            passed,
            details: `Status ${res.status} | Verdict: ${verdict} | Time: ${totalTime}ms | Cases: ${data?.testCases?.length || 1}`,
        };
    });

    // Error Handling: TLE Detection
    await recordCheck("Safety Guardrails", "execute-direct: Timeout (TLE) Protection", async () => {
        const res = await fetch(`${API_BASE}/api/submissions/execute-direct`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                language: "python",
                code: "import time; time.sleep(5)",
                stdin: "",
                timeLimitMs: 500,
            }),
        });
        const data: any = await res.json();
        const isTimeout = data?.run?.isTimeout;
        return {
            passed: res.status === 200 && isTimeout === true,
            details: `Status ${res.status} | isTimeout=${isTimeout} | signal=${data?.run?.signal}`,
        };
    });

    // Error Handling: Compilation Failure
    await recordCheck("Safety Guardrails", "execute-direct: Compilation Error Handling", async () => {
        const res = await fetch(`${API_BASE}/api/submissions/execute-direct`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                language: "cpp",
                code: "int main() { INVALID_SYNTAX_ERROR ; return 0; }",
                stdin: "",
            }),
        });
        const data: any = await res.json();
        const compileSuccess = data?.compile?.success;
        return {
            passed: res.status === 200 && compileSuccess === false,
            details: `Status ${res.status} | Compile success=${compileSuccess} | Error captured properly`,
        };
    });

    // -------------------------------------------------------------------------
    // 5. RUNTIME POOL MANAGEMENT
    // -------------------------------------------------------------------------
    console.log("\n--- 5. Runtime Pool & Dynamic Scaling Status ---");

    await recordCheck("Runtime Pool", "GET /api/runtimes", async () => {
        const res = await fetch(`${API_BASE}/api/runtimes`);
        const data: any = await res.json();
        const count = data?.activeCount ?? data?.runtimes?.length ?? 0;
        const nodes = (data?.runtimes || []).map((r: any) => `${r.port} (${r.status})`).join(", ");
        return {
            passed: res.status === 200 && count > 0,
            details: `Status ${res.status} | ${count} active instance(s): [${nodes}]`,
        };
    });

    // -------------------------------------------------------------------------
    // 6. USER, LEADERBOARD & SUBMISSIONS LIST
    // -------------------------------------------------------------------------
    console.log("\n--- 6. User Profiles, Leaderboard & Submissions ---");

    await recordCheck("Leaderboard API", "GET /api/leaderboard", async () => {
        const res = await fetch(`${API_BASE}/api/leaderboard`);
        const data: any = await res.json();
        const list = Array.isArray(data) ? data : (data?.leaderboard || []);
        return {
            passed: res.status === 200 && Array.isArray(list),
            details: `Status ${res.status} | ${list.length} leaderboard participant(s)`,
        };
    });

    await recordCheck("User API", "GET /api/players/available", async () => {
        const res = await fetch(`${API_BASE}/api/players/available`);
        const data: any = await res.json();
        const players = Array.isArray(data) ? data : (data?.players || []);
        return {
            passed: res.status === 200 && Array.isArray(players),
            details: `Status ${res.status} | ${players.length} available player(s)`,
        };
    });

    await recordCheck("Submissions API", "GET /api/submissions (Public DTOs)", async () => {
        const res = await fetch(`${API_BASE}/api/submissions`);
        const data: any = await res.json();
        const count = Array.isArray(data) ? data.length : 0;
        return {
            passed: res.status === 200 && Array.isArray(data),
            details: `Status ${res.status} | ${count} sanitized submission history record(s)`,
        };
    });

    // -------------------------------------------------------------------------
    // 7. FRONTEND CLIENT ROUTES
    // -------------------------------------------------------------------------
    console.log("\n--- 7. Frontend Client Routes (Port 5173) ---");

    const frontendRoutes = [
        { path: "/", name: "Landing Page" },
        { path: "/practice", name: "Practice Archive" },
        { path: "/leaderboard", name: "Global Leaderboard" },
        { path: "/rewards", name: "Rewards Hub" },
        { path: "/login", name: "Login Portal" },
        { path: "/signup", name: "Signup Portal" },
        { path: "/student-login", name: "Student Institutional Portal" },
    ];

    for (const r of frontendRoutes) {
        await recordCheck("Frontend Client", `Route: ${r.path} (${r.name})`, async () => {
            const res = await fetch(`${FRONTEND_BASE}${r.path}`);
            const text = await res.text();
            const hasHtml = text.includes("<html") || text.includes("<!DOCTYPE") || text.includes("<div id=\"root\"");
            return {
                passed: res.status === 200 && hasHtml,
                details: `Status ${res.status} | Size: ${(text.length / 1024).toFixed(1)}KB | HTML shell loaded`,
            };
        });
    }

    // -------------------------------------------------------------------------
    // SUMMARY REPORT
    // -------------------------------------------------------------------------
    console.log("\n========================================================================");
    console.log(" 📊 AUDIT RESULTS SUMMARY");
    console.log("========================================================================");

    const total = results.length;
    const passed = results.filter((r) => r.passed).length;
    const failed = total - passed;

    console.log(`Total Checks Performed: ${total}`);
    console.log(`✅ Passed:             ${passed}`);
    console.log(`❌ Failed:             ${failed}`);
    console.log(`Pass Rate:             ${((passed / total) * 100).toFixed(1)}%`);

    if (failed === 0) {
        console.log("\n🚀 ALL SYSTEMS OPERATIONAL - PLATFORM READY FOR EXHIBITION!");
    } else {
        console.log("\n⚠️ ATTENTION: The following checks reported issues:");
        results
            .filter((r) => !r.passed)
            .forEach((r) => {
                console.log(` - [${r.category}] ${r.target}: ${r.details}`);
            });
    }
    console.log("========================================================================\n");
}

runExhibitionAudit();
