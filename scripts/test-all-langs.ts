async function runTests() {
    console.log("=================================================");
    console.log(" 🧪 AlgoFight Comprehensive Language & Engine Test");
    console.log("=================================================");

    const directLanguages = [
        {
            name: "Python 3",
            lang: "python",
            code: "import sys\nx = sys.stdin.read().strip()\nprint(f'Echo: {x}')",
            stdin: "World",
            expectedOutput: "Echo: World",
        },
        {
            name: "JavaScript (Node)",
            lang: "javascript",
            code: "const fs = require('fs');\nconst x = fs.readFileSync(0, 'utf-8').trim();\nconsole.log(`Echo: ${x}`);",
            stdin: "World",
            expectedOutput: "Echo: World",
        },
        {
            name: "C++",
            lang: "cpp",
            code: "#include <iostream>\n#include <string>\nusing namespace std;\nint main() {\n    string s;\n    if (cin >> s) cout << \"Echo: \" << s << endl;\n    return 0;\n}",
            stdin: "World",
            expectedOutput: "Echo: World",
        },
        {
            name: "Java",
            lang: "java",
            code: "import java.util.Scanner;\npublic class main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (sc.hasNext()) System.out.println(\"Echo: \" + sc.next());\n    }\n}",
            stdin: "World",
            expectedOutput: "Echo: World",
        },
        {
            name: "TypeScript",
            lang: "typescript",
            code: "const greeting: string = 'Echo: World';\nconsole.log(greeting);",
            stdin: "",
            expectedOutput: "Echo: World",
        },
    ];

    console.log("\n--- Part 1: Testing POST /api/submissions/execute-direct ---");
    let allDirectPassed = true;
    for (const test of directLanguages) {
        try {
            const res = await fetch("http://localhost:3000/api/submissions/execute-direct", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    language: test.lang,
                    code: test.code,
                    stdin: test.stdin,
                    timeLimitMs: 4000,
                }),
            });
            const data: any = await res.json();
            const stdout = data?.run?.stdout?.trim();
            const timeMs = data?.run?.timeMs ?? data?.executionTimeMs ?? 0;
            const memoryBytes = data?.run?.memoryBytes ?? 0;
            const ok = res.status === 200 && data.success && stdout === test.expectedOutput;

            if (ok) {
                console.log(`✅ [execute-direct: ${test.name}] PASSED | stdout="${stdout}" | time=${timeMs}ms | mem=${(memoryBytes / 1024).toFixed(1)}KB | runtime=${data.targetRuntime?.url}`);
            } else {
                allDirectPassed = false;
                console.error(`❌ [execute-direct: ${test.name}] FAILED (status ${res.status}):`, JSON.stringify(data, null, 2));
            }
        } catch (e: any) {
            allDirectPassed = false;
            console.error(`❌ [execute-direct: ${test.name}] EXCEPTION:`, e.message);
        }
    }

    console.log("\n--- Part 2: Testing POST /api/test (Judge Pipeline Evaluation) ---");
    const testCasesPipeline = [
        {
            name: "Python 3",
            lang: "python",
            code: "import sys\nx = sys.stdin.read().strip()\nprint(x.upper())",
            testCases: [{ id: "tc1", input: "hello", expectedOutput: "HELLO" }],
        },
        {
            name: "JavaScript",
            lang: "javascript",
            code: "const fs = require('fs');\nconst x = fs.readFileSync(0, 'utf-8').trim();\nconsole.log(x.toUpperCase());",
            testCases: [{ id: "tc1", input: "hello", expectedOutput: "HELLO" }],
        },
        {
            name: "C++",
            lang: "cpp",
            code: "#include <iostream>\n#include <string>\n#include <algorithm>\nusing namespace std;\nint main() {\n    string s;\n    if (cin >> s) {\n        for (auto &c : s) c = toupper(c);\n        cout << s << endl;\n    }\n    return 0;\n}",
            testCases: [{ id: "tc1", input: "hello", expectedOutput: "HELLO" }],
        },
        {
            name: "Java",
            lang: "java",
            code: "import java.util.Scanner;\npublic class main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (sc.hasNext()) System.out.println(sc.next().toUpperCase());\n    }\n}",
            testCases: [{ id: "tc1", input: "hello", expectedOutput: "HELLO" }],
        },
    ];

    let allPipelinePassed = true;
    for (const test of testCasesPipeline) {
        try {
            const res = await fetch("http://localhost:3000/api/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    language: test.lang,
                    code: test.code,
                    testCases: test.testCases,
                }),
            });
            const data: any = await res.json();
            const verdict = data?.verdict;
            const totalTime = data?.resourceUsage?.totalTime;
            const maxMem = data?.resourceUsage?.maxMemory;
            const ok = res.status === 200 && verdict === "ACCEPTED" && totalTime > 0;

            if (ok) {
                console.log(`✅ [api/test: ${test.name}] VERDICT: ${verdict} | totalTime=${totalTime}ms | maxMem=${(maxMem / 1024).toFixed(1)}KB`);
            } else {
                allPipelinePassed = false;
                console.error(`❌ [api/test: ${test.name}] FAILED (status ${res.status}):`, JSON.stringify(data, null, 2));
            }
        } catch (e: any) {
            allPipelinePassed = false;
            console.error(`❌ [api/test: ${test.name}] EXCEPTION:`, e.message);
        }
    }

    console.log("\n--- Part 3: Testing Timeout Detection (TLE) ---");
    try {
        const res = await fetch("http://localhost:3000/api/submissions/execute-direct", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                language: "python",
                code: "import time\ntime.sleep(5)",
                stdin: "",
                timeLimitMs: 1000,
            }),
        });
        const data: any = await res.json();
        const isTimeout = data?.run?.isTimeout;
        if (isTimeout) {
            console.log(`✅ [TLE Detection] PASSED | isTimeout=${isTimeout} | signal=${data?.run?.signal}`);
        } else {
            console.error(`❌ [TLE Detection] FAILED:`, JSON.stringify(data, null, 2));
        }
    } catch (e: any) {
        console.error(`❌ [TLE Detection] EXCEPTION:`, e.message);
    }

    console.log("\n=================================================");
    if (allDirectPassed && allPipelinePassed) {
        console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
    } else {
        console.log("⚠️ SOME TESTS FAILED - CHECK LOGS ABOVE");
    }
    console.log("=================================================");
}

runTests();
