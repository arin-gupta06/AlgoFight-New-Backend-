# AlgoFight Code Execution & Evaluation System (V2)

This plan implements the comprehensive code execution and evaluation pipeline outlined in the ALGOFIGHT V2 specification. It transitions the system from a sequential/unbounded parallel model to a robust, stage-driven pipeline with bounded parallelism and real-time streaming.

## Open Questions for Implementation
1. Do you want to use the existing `PistonAdapter` as the underlying Sandbox Executor for the bounded test workers, or should we switch to local Docker containers (`docker.executor.ts`)?
2. For streaming execution progress (Phase 10), do you prefer using Server-Sent Events (SSE) via the Fastify API, or emitting events directly through the existing Socket.io `apps/websocket` connection?

## Proposed Changes

---

### Security & Anti-Cheat (Frontend)
To enforce fair play in the Live Battle Arena, we will implement an `AntiCheatProvider` or hook:
1. **Tab Switching & Backgrounding:** Use the Page Visibility API (`document.visibilityState`) and `window.onblur` to detect when the user switches tabs or minimizes the browser. A warning will be issued, or the match can be automatically forfeited.
2. **Screenshot Prevention (Best Effort):** 
   - Intercept the `PrintScreen` key (`keydown` listener).
   - Use CSS (`user-select: none`, `print-color-adjust`) and clear the clipboard on copy attempts.
   - Blur the entire code editor when the window loses focus to prevent background screenshot tools (e.g., Snipping Tool) from capturing the code.

### `packages/application` (Judge Core & Pipeline)

This is the core of the execution system. We will refactor the existing `EvaluationService` into a staged pipeline.

#### [NEW] `src/judge/models/execute-request.ts`
Define the normalized execution request and result contracts (`ExecuteRequest`, `TestCaseResult`, `ExecutionResult`). This will include the `mode` parameter (`SAMPLE` | `SUBMIT`) and ensure hidden test cases are properly scrubbed of sensitive I/O data.

#### [NEW] `src/judge/pipeline/execution-pipeline.ts`
Implement the sequential pipeline of dependent execution stages:
1. `PrepareStage`
2. `CompileStage`
3. `SampleTestStage`
4. `HiddenTestStage`
5. `FinalizeStage`

#### [NEW] `src/judge/pipeline/worker-pool.ts`
Implement the bounded parallelism engine (Phase 6). This will replace the unbounded `Promise.all()` map currently used in `EvaluationService.ts`. It will fan out independent test case executions to the sandbox up to a configurable concurrency limit (e.g., 4) to prevent CPU/Memory exhaustion, and then fan-in the results to the Aggregator.

#### [MODIFY] `src/services/evaluation.service.ts`
Refactor to instantiate and execute the new `ExecutionPipeline`. It will accept callback hooks (e.g., `onTestCompleted`) to stream metrics (runtime, memory, stdout, stderr, exit status) in real-time.

#### [MODIFY] `src/judge/verdict/verdict-engine.ts`
Update the Aggregator logic to correctly determine the final verdict (`ACCEPTED`, `WRONG_ANSWER`, `TIME_LIMIT_EXCEEDED`, `MEMORY_LIMIT_EXCEEDED`, `RUNTIME_ERROR`) based on the fanned-in test results and peak memory calculations.

---

### `apps/worker` & `packages/queue` (Execution Manager)

#### [MODIFY] `src/services/execution.service.ts` (in `packages/application`)
Update the submission processor to handle `SAMPLE` vs `SUBMIT` execution modes, interacting with the new `EvaluationService` pipeline.

#### [MODIFY] `src/workers/submission.worker.ts` (in `packages/queue`)
Integrate real-time event streaming. As the worker progresses through the `ExecutionPipeline`, it will publish Redis Pub/Sub messages containing progress updates (`EXECUTION_STARTED`, `TEST_COMPLETED`, etc.).

---

### `apps/websocket` & `apps/api` (Streaming & Endpoints)

#### [MODIFY] `apps/api/src/controllers/submission.controllers.ts`
Update the `/test` and `/submit` endpoints to accept the new `ExecuteRequest` format and correctly queue the execution job.

#### [MODIFY] `apps/websocket/src/handlers/socket-handler.ts`
Subscribe to the Redis Pub/Sub events emitted by the `apps/worker` and relay them to the specific user's socket connection. 
Events to be streamed:
- `execution_started`
- `compilation_started` / `compilation_completed`
- `test_started` / `test_completed` (incremental updates for the UI)
- `execution_completed`

---

### `frontend` (Practice UI & Result Visualization)

The frontend will be heavily updated to match the provided Phase 16-21 mockups.

#### [MODIFY] `src/components/Battle/LiveBattle.jsx` & `src/components/Practice/PracticeWorkspace.jsx`
- Replace static loading spinners with an incremental UI.
- Render test cases dynamically as they stream in (Wait, Queued, Running, ✓, ✕).
- Implement expandable test-case UI panels showing exact input, expected output, and stdout for `SAMPLE` mode tests.
- Add verdict-specific colored components (Cyan, Green, Pink, Yellow, Blue, Purple) based on the AlgoFight visual language.
- **Live Battle UI Alignment:** Ensure the final execution panel perfectly matches the provided screenshot, including the "TEST (SAMPLE) - ALL PASSED", "WRONG ANSWER", "TIME LIMIT EXCEEDED", and "RUNTIME ERROR" layouts with precise performance metrics (Time/Memory).
- **Anti-Cheat Integration:** Wrap the LiveBattle component in the Anti-Cheat detection logic to enforce tab-lock and prevent cheating during active matches.

## Verification Plan

### Manual Verification
1. Launch local dev servers (`apps/api`, `apps/websocket`, `frontend`, `apps/worker`).
2. Submit a `SAMPLE` execution with 5 public test cases; verify bounded parallelism executes them smoothly without crashing the sandbox, and progress streams to the frontend incrementally.
3. Submit a `SUBMIT` execution; verify hidden test case inputs/outputs are NOT leaked to the frontend, but the runtime and memory metrics are collected correctly.
4. Verify peak memory is calculated as `max(test.memoryBytes)` and not summed across executions.
5. Induce a `TIME_LIMIT_EXCEEDED` and `MEMORY_LIMIT_EXCEEDED` and verify the Verdict Engine correctly catches and labels the final submission verdict.
