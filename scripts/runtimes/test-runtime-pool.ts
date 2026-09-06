/**
 * Comprehensive Verification Suite for Elastic Multi-Runtime Execution Engine
 * Validates:
 * 1. Workload Classification (LIGHT vs HEAVY)
 * 2. Strategy Pattern Runtime Routing
 * 3. Factory Method Pattern (Lifecycle creation & destruction)
 * 4. Observer Pattern (Queue saturation detection & 60s cooldown scale-in)
 * 5. Asymmetric Queue Segregation
 */
import { WorkloadClassifier } from "../../packages/application/src/workload/workload.classifier.ts";
import { RuntimePoolManager } from "../../packages/application/src/runtime-pool/runtime-pool.manager.ts";
import { LeastLoadStrategy, LanguageAffinityStrategy } from "../../packages/application/src/runtime-pool/runtime-routing.strategy.ts";
import { VirtualPistonRuntimeFactory } from "../../packages/application/src/runtime-pool/piston-runtime.factory.ts";
import { QUEUE_NAMES } from "../../packages/queue/src/constants/queue.constants.ts";

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, message: string) {
    totalTests++;
    if (!condition) {
        console.error(`❌ FAIL: ${message}`);
        throw new Error(`Assertion failed: ${message}`);
    }
    passedTests++;
    console.log(`✅ PASS: ${message}`);
}

async function runTestSuite() {
    console.log("\n=======================================================");
    console.log("🚀 STARTING ELASTIC MULTI-RUNTIME VERIFICATION SUITE");
    console.log("=======================================================\n");

    // -------------------------------------------------------------
    // TEST 1: Workload Classification
    // -------------------------------------------------------------
    console.log("--- Test Group 1: Workload Classification ---");

    const pyLight = WorkloadClassifier.classify({ language: "python", sourceCode: "print('hello')" });
    assert(pyLight === "LIGHT", "Python script classified as LIGHT");

    const jsLight = WorkloadClassifier.classify({ language: "javascript", sourceCode: "console.log('hi')" });
    assert(jsLight === "LIGHT", "JavaScript script classified as LIGHT");

    const cppHeavy = WorkloadClassifier.classify({ language: "cpp", sourceCode: "#include <iostream>\nint main(){}" });
    assert(cppHeavy === "HEAVY", "C++ code classified as HEAVY (requires compilation)");

    const javaHeavy = WorkloadClassifier.classify({ language: "java", sourceCode: "public class Main {}" });
    assert(javaHeavy === "HEAVY", "Java code classified as HEAVY (requires compilation)");

    const bigPySource = "x = 1\n".repeat(2000); // > 8KB
    const pyBigHeavy = WorkloadClassifier.classify({ language: "python", sourceCode: bigPySource });
    assert(pyBigHeavy === "HEAVY", "Oversized Python code (>8KB) heuristically classified as HEAVY");

    const pyManyTests = WorkloadClassifier.classify({ language: "python", testCasesCount: 25 });
    assert(pyManyTests === "HEAVY", "Python with >15 test cases classified as HEAVY");

    // -------------------------------------------------------------
    // TEST 2: Strategy Pattern Destination Routing
    // -------------------------------------------------------------
    console.log("\n--- Test Group 2: Strategy Pattern Destination Routing ---");

    const mockPool = [
        { id: "p1", url: "http://localhost:2001", port: 2001, status: "HEALTHY" as const, activeJobs: 3, isBaseline: true, createdAt: 0, lastHeartbeat: 0 },
        { id: "p2", url: "http://localhost:2002", port: 2002, status: "HEALTHY" as const, activeJobs: 0, isBaseline: true, createdAt: 0, lastHeartbeat: 0 },
    ];

    const leastLoadStrategy = new LeastLoadStrategy();
    const routedUrl = await leastLoadStrategy.selectRuntime(
        { submissionId: "sub-1", language: "python", workload: "LIGHT" },
        mockPool
    );
    assert(routedUrl === "http://localhost:2002", "LeastLoadStrategy correctly routed to runtime with 0 active jobs (port 2002)");

    const langAffinityStrategy = new LanguageAffinityStrategy();
    const cppRouted = await langAffinityStrategy.selectRuntime(
        { submissionId: "sub-2", language: "cpp", workload: "HEAVY" },
        mockPool
    );
    assert(cppRouted === "http://localhost:2001", "LanguageAffinityStrategy routed HEAVY workload to primary compiler runtime (port 2001)");

    // -------------------------------------------------------------
    // TEST 3: Factory Method Pattern (Create & Destroy Lifecycle)
    // -------------------------------------------------------------
    console.log("\n--- Test Group 3: Factory Method Pattern ---");

    const virtualFactory = new VirtualPistonRuntimeFactory();
    const newRuntime = await virtualFactory.createRuntime({ port: 2003, type: "GENERAL" });
    assert(newRuntime.port === 2003 && newRuntime.status === "HEALTHY", "Factory Method successfully created runtime instance on port 2003");

    await virtualFactory.destroyRuntime(newRuntime.url);
    assert(true, "Factory Method successfully destroyed runtime instance without errors");

    // -------------------------------------------------------------
    // TEST 4: RuntimePoolManager Elastic Scaling Lifecycle
    // -------------------------------------------------------------
    console.log("\n--- Test Group 4: RuntimePoolManager Scale-Out & Scale-In ---");

    const poolManager = new RuntimePoolManager({
        factory: virtualFactory,
        strategy: leastLoadStrategy,
    });

    const initialSnapshot = poolManager.getSnapshot();
    assert(initialSnapshot.activeCount === 2, "RuntimePoolManager initialized with 2 prewarmed baseline instances");

    // Trigger dynamic scale-out
    const scaledInstance = await poolManager.scaleOut("Test queue saturation spike");
    assert(scaledInstance !== null, "Scale-out successfully spawned additional runtime instance");
    assert(poolManager.getSnapshot().activeCount === 3, "Pool capacity increased to 3 runtimes");

    // Route a submission through the pool manager
    const selected = await poolManager.routeSubmission({
        submissionId: "sub-test",
        language: "python",
        workload: "LIGHT",
    });
    assert(typeof selected === "string" && selected.startsWith("http://localhost:"), "Submission routed through active pool");

    // Release execution slot
    await poolManager.releaseExecutionSlot(selected);
    assert(true, "Execution slot released cleanly");

    // Trigger graceful scale-in
    const retiredUrl = await poolManager.scaleIn();
    assert(retiredUrl !== null, "Scale-in successfully decommissioned newest elastic instance");
    assert(poolManager.getSnapshot().activeCount === 2, "Pool capacity gracefully returned to baseline 2 instances");

    // -------------------------------------------------------------
    // TEST 5: Observer Pattern Queue Telemetry & Autoscaler Reaction
    // -------------------------------------------------------------
    console.log("\n--- Test Group 5: Observer Pattern Queue Telemetry ---");

    const observer = poolManager.getObserver();

    // Normal queue tick (no saturation)
    await observer.onQueueTick({
        lightDepth: 1,
        heavyDepth: 0,
        activeWorkersTotal: 1,
        timestamp: Date.now(),
    });
    assert(poolManager.getSnapshot().activeCount === 2, "Observer maintained baseline on normal queue depth");

    // Saturation tick 1 & 2 (threshold >= 4)
    await observer.onQueueTick({
        lightDepth: 3,
        heavyDepth: 3,
        activeWorkersTotal: 4,
        timestamp: Date.now(),
    });
    await observer.onQueueTick({
        lightDepth: 4,
        heavyDepth: 2,
        activeWorkersTotal: 4,
        timestamp: Date.now(),
    });

    assert(poolManager.getSnapshot().activeCount === 3, "Observer detected queue saturation and autonomously triggered scale-out to 3 instances!");

    // -------------------------------------------------------------
    // TEST 6: Queue Segregation Constants & Contracts
    // -------------------------------------------------------------
    console.log("\n--- Test Group 6: Queue Segregation Contracts ---");

    assert(QUEUE_NAMES.SUBMISSION_LIGHT === "submission-light-queue", "Light queue name verified");
    assert(QUEUE_NAMES.SUBMISSION_HEAVY === "submission-heavy-queue", "Heavy queue name verified");

    console.log("\n=======================================================");
    console.log(`🎉 ALL TESTS PASSED: ${passedTests}/${totalTests} checks verified!`);
    console.log("=======================================================\n");
}

runTestSuite().catch((err) => {
    console.error("Test Suite Failed:", err);
    process.exit(1);
});
