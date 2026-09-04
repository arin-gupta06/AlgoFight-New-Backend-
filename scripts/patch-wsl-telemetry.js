import fs from "fs";
import path from "path";

const WSL_ROOT = "\\\\wsl.localhost\\Ubuntu\\home\\arin\\AlgoFight_Linux";

console.log("Checking connection to WSL AlgoFight_Linux at:", WSL_ROOT);
if (!fs.existsSync(WSL_ROOT)) {
    console.error("ERROR: Cannot access WSL path:", WSL_ROOT);
    process.exit(1);
}

// -------------------------------------------------------------
// 1. PATCH app/telemetry/models.py
// -------------------------------------------------------------
const modelsPath = path.join(WSL_ROOT, "app", "telemetry", "models.py");
let modelsContent = fs.readFileSync(modelsPath, "utf-8");

if (!modelsContent.includes("RuntimePoolTelemetryPayload")) {
    const modelsAddition = `

class RuntimePoolTelemetryPayload(BaseModel):
    active_runtimes_count: int = 2
    runtimes: List[Dict[str, Any]] = Field(default_factory=list)
    scaling_state: str = "STABLE"
    cooldown_seconds_remaining: float = 0.0
    light_queue_depth: int = 0
    heavy_queue_depth: int = 0
    light_workers_busy: int = 0
    heavy_workers_busy: int = 0
    timestamp: Optional[float] = None


class QueueTelemetryPayload(BaseModel):
    light_queue_depth: int = 0
    heavy_queue_depth: int = 0
    light_workers_busy: int = 0
    heavy_workers_busy: int = 0
    timestamp: Optional[float] = None
`;
    modelsContent += modelsAddition;
    fs.writeFileSync(modelsPath, modelsContent, "utf-8");
    console.log("✅ Patched app/telemetry/models.py with RuntimePoolTelemetryPayload and QueueTelemetryPayload");
} else {
    console.log("ℹ️ app/telemetry/models.py already contains RuntimePoolTelemetryPayload");
}

// -------------------------------------------------------------
// 2. PATCH app/telemetry/engine.py
// -------------------------------------------------------------
const enginePath = path.join(WSL_ROOT, "app", "telemetry", "engine.py");
let engineContent = fs.readFileSync(enginePath, "utf-8");

if (!engineContent.includes("RuntimePoolTelemetryPayload")) {
    // Add models import
    engineContent = engineContent.replace(
        "from app.telemetry.models import (\n    BattleIngestPayload,\n    ExecutionIngestPayload,\n    SystemVitals,\n)",
        "from app.telemetry.models import (\n    BattleIngestPayload,\n    ExecutionIngestPayload,\n    SystemVitals,\n    RuntimePoolTelemetryPayload,\n    QueueTelemetryPayload,\n)"
    );

    // Initialize state in __init__
    const initTarget = "self.cache = cache_service or get_cache_service()";
    const stateInit = `self.cache = cache_service or get_cache_service()
        self.latest_runtime_pool = {
            "active_runtimes_count": 2,
            "runtimes": [
                {"url": "http://localhost:2001", "port": 2001, "status": "HEALTHY", "active_jobs": 0},
                {"url": "http://localhost:2002", "port": 2002, "status": "HEALTHY", "active_jobs": 0},
            ],
            "scaling_state": "STABLE",
            "cooldown_seconds_remaining": 0.0,
        }
        self.latest_queue_vitals = {
            "light_depth": 0,
            "heavy_depth": 0,
            "light_workers": 0,
            "heavy_workers": 0,
        }`;
    engineContent = engineContent.replace(initTarget, stateInit);

    // Add ingest methods and update get_system_vitals
    const vitalsTarget = `    def get_system_vitals(self) -> SystemVitals:
        raw_summary = self.cache.raw_store.get_summary()
        battle_summary = self.cache.battle_store.get_summary()
        return SystemCollector.get_vitals(
            active_workers=raw_summary.get("current_workers", 0),
            throughput_rps=raw_summary.get("current_throughput", 0.0),
            active_battles=battle_summary.get("active_battles", 0),
        )`;

    const updatedVitals = `    def ingest_runtime_pool(self, payload: RuntimePoolTelemetryPayload) -> Dict[str, Any]:
        self.latest_runtime_pool = {
            "active_runtimes_count": payload.active_runtimes_count,
            "runtimes": payload.runtimes or [
                {"url": "http://localhost:2001", "port": 2001, "status": "HEALTHY", "active_jobs": 0},
                {"url": "http://localhost:2002", "port": 2002, "status": "HEALTHY", "active_jobs": 0}
            ],
            "scaling_state": payload.scaling_state,
            "cooldown_seconds_remaining": payload.cooldown_seconds_remaining,
        }
        if payload.light_queue_depth or payload.heavy_queue_depth:
            self.latest_queue_vitals["light_depth"] = payload.light_queue_depth
            self.latest_queue_vitals["heavy_depth"] = payload.heavy_queue_depth
        if payload.light_workers_busy or payload.heavy_workers_busy:
            self.latest_queue_vitals["light_workers"] = payload.light_workers_busy
            self.latest_queue_vitals["heavy_workers"] = payload.heavy_workers_busy
        return {"status": "ok", "active_runtimes": payload.active_runtimes_count}

    def ingest_queue_vitals(self, payload: QueueTelemetryPayload) -> Dict[str, Any]:
        self.latest_queue_vitals["light_depth"] = payload.light_queue_depth
        self.latest_queue_vitals["heavy_depth"] = payload.heavy_queue_depth
        self.latest_queue_vitals["light_workers"] = payload.light_workers_busy
        self.latest_queue_vitals["heavy_workers"] = payload.heavy_workers_busy
        return {"status": "ok"}

    def get_system_vitals(self) -> SystemVitals:
        raw_summary = self.cache.raw_store.get_summary()
        battle_summary = self.cache.battle_store.get_summary()
        total_workers = (
            self.latest_queue_vitals["light_workers"] + self.latest_queue_vitals["heavy_workers"]
            or raw_summary.get("current_workers", 0)
        )
        return SystemCollector.get_vitals(
            active_workers=total_workers,
            light_depth=self.latest_queue_vitals["light_depth"],
            heavy_depth=self.latest_queue_vitals["heavy_depth"],
            throughput_rps=raw_summary.get("current_throughput", 0.0),
            active_battles=battle_summary.get("active_battles", 0),
        )`;

    engineContent = engineContent.replace(vitalsTarget, updatedVitals);
    fs.writeFileSync(enginePath, engineContent, "utf-8");
    console.log("✅ Patched app/telemetry/engine.py with runtime pool and queue ingestion methods");
} else {
    console.log("ℹ️ app/telemetry/engine.py already patched");
}

// -------------------------------------------------------------
// 3. PATCH app/api/telemetry_routes.py
// -------------------------------------------------------------
const telemetryRoutesPath = path.join(WSL_ROOT, "app", "api", "telemetry_routes.py");
let telemetryRoutesContent = fs.readFileSync(telemetryRoutesPath, "utf-8");

if (!telemetryRoutesContent.includes("/runtime-pool")) {
    telemetryRoutesContent = telemetryRoutesContent.replace(
        "from app.telemetry.models import (\n    BattleIngestPayload,\n    ExecutionIngestPayload,\n)",
        "from app.telemetry.models import (\n    BattleIngestPayload,\n    ExecutionIngestPayload,\n    RuntimePoolTelemetryPayload,\n    QueueTelemetryPayload,\n)"
    );

    const endpointsToAdd = `

@router.post("/runtime-pool")
def ingest_runtime_pool_telemetry(payload: RuntimePoolTelemetryPayload):
    """Ingest real-time multi-runtime container fleet & autoscaling status."""
    engine = get_telemetry_engine()
    return engine.ingest_runtime_pool(payload)


@router.post("/queues")
def ingest_queue_telemetry(payload: QueueTelemetryPayload):
    """Ingest real-time segregated Light/Heavy queue depths and worker loads."""
    engine = get_telemetry_engine()
    return engine.ingest_queue_vitals(payload)
`;
    telemetryRoutesContent += endpointsToAdd;
    fs.writeFileSync(telemetryRoutesPath, telemetryRoutesContent, "utf-8");
    console.log("✅ Patched app/api/telemetry_routes.py with /runtime-pool and /queues endpoints");
} else {
    console.log("ℹ️ app/api/telemetry_routes.py already patched");
}

// -------------------------------------------------------------
// 4. PATCH app/api/stats_routes.py
// -------------------------------------------------------------
const statsRoutesPath = path.join(WSL_ROOT, "app", "api", "stats_routes.py");
let statsRoutesContent = fs.readFileSync(statsRoutesPath, "utf-8");

if (!statsRoutesContent.includes('"runtime_pool":')) {
    statsRoutesContent = statsRoutesContent.replace(
        '"vitals": vitals.model_dump(),',
        '"vitals": vitals.model_dump(),\n                    "runtime_pool": getattr(engine, "latest_runtime_pool", {}),'
    );
    fs.writeFileSync(statsRoutesPath, statsRoutesContent, "utf-8");
    console.log("✅ Patched app/api/stats_routes.py to stream runtime_pool via SSE /stream");
} else {
    console.log("ℹ️ app/api/stats_routes.py already contains runtime_pool in SSE stream");
}

// -------------------------------------------------------------
// 5. PATCH app/ui/templates/dashboard.html
// -------------------------------------------------------------
const dashboardPath = path.join(WSL_ROOT, "app", "ui", "templates", "dashboard.html");
let dashboardContent = fs.readFileSync(dashboardPath, "utf-8");

if (!dashboardContent.includes('id="runtime-pool-container"')) {
    const runtimeCard = `
            <!-- Dynamic Runtime Pool Cluster Status -->
            <div class="glass-card" id="runtime-pool-card" style="margin-bottom: 24px; padding: 18px 24px; border: 1px solid rgba(139, 92, 246, 0.25); border-radius: 12px; background: rgba(17, 24, 39, 0.7); backdrop-filter: blur(12px);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 1.1rem; font-weight: 700; color: #a78bfa; letter-spacing: 0.5px;">⚡ ELASTIC RUNTIME POOL (PISTON FLEET)</span>
                        <span id="scaling-state-badge" style="padding: 2px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);">STABLE</span>
                    </div>
                    <div style="font-size: 0.85rem; color: #9ca3af;">
                        Active Containers: <strong id="active-runtimes-count" style="color: #60a5fa;">2</strong> / 4 Max
                        <span style="margin: 0 8px;">•</span>
                        Cooldown: <strong id="cooldown-timer" style="color: #f59e0b;">60s</strong>
                    </div>
                </div>
                <div id="runtime-pool-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px;">
                    <div class="runtime-instance-box" style="padding: 10px 14px; border-radius: 8px; background: rgba(31, 41, 55, 0.6); border: 1px solid rgba(75, 85, 99, 0.4);">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                            <strong style="color: #e5e7eb; font-size: 0.85rem;">Piston-1 (Port 2001)</strong>
                            <span style="color: #10b981; font-size: 0.75rem;">HEALTHY</span>
                        </div>
                        <div style="font-size: 0.75rem; color: #9ca3af;">Role: Baseline (High-spec compiler)</div>
                        <div style="font-size: 0.75rem; color: #a78bfa; margin-top: 4px;">In-flight Jobs: 0</div>
                    </div>
                    <div class="runtime-instance-box" style="padding: 10px 14px; border-radius: 8px; background: rgba(31, 41, 55, 0.6); border: 1px solid rgba(75, 85, 99, 0.4);">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                            <strong style="color: #e5e7eb; font-size: 0.85rem;">Piston-2 (Port 2002)</strong>
                            <span style="color: #10b981; font-size: 0.75rem;">HEALTHY</span>
                        </div>
                        <div style="font-size: 0.75rem; color: #9ca3af;">Role: Baseline (Lightweight scripts)</div>
                        <div style="font-size: 0.75rem; color: #a78bfa; margin-top: 4px;">In-flight Jobs: 0</div>
                    </div>
                </div>
            </div>
`;
    dashboardContent = dashboardContent.replace(
        '<div class="service-banner glass-card">',
        runtimeCard + '\n            <div class="service-banner glass-card">'
    );
    fs.writeFileSync(dashboardPath, dashboardContent, "utf-8");
    console.log("✅ Patched app/ui/templates/dashboard.html with Elastic Runtime Pool Card");
} else {
    console.log("ℹ️ app/ui/templates/dashboard.html already patched");
}

// -------------------------------------------------------------
// 6. PATCH app/ui/static/app.js
// -------------------------------------------------------------
const appJsPath = path.join(WSL_ROOT, "app", "ui", "static", "app.js");
let appJsContent = fs.readFileSync(appJsPath, "utf-8");

if (!appJsContent.includes("updateRuntimePoolUI")) {
    const sseUpdateHook = `
                // Update Runtime Pool Cluster UI
                if (data.runtime_pool) {
                    updateRuntimePoolUI(data.runtime_pool);
                }
`;
    appJsContent = appJsContent.replace(
        'document.getElementById("heavy-q-depth").innerText = vitals.heavy_queue_depth || 0;',
        'document.getElementById("heavy-q-depth").innerText = vitals.heavy_queue_depth || 0;' + sseUpdateHook
    );

    const runtimePoolHelper = `

function updateRuntimePoolUI(pool) {
    const countEl = document.getElementById("active-runtimes-count");
    if (countEl) countEl.innerText = pool.active_runtimes_count || 2;

    const cooldownEl = document.getElementById("cooldown-timer");
    if (cooldownEl) {
        cooldownEl.innerText = (pool.cooldown_seconds_remaining ? Math.floor(pool.cooldown_seconds_remaining) : 60) + "s";
    }

    const badgeEl = document.getElementById("scaling-state-badge");
    if (badgeEl && pool.scaling_state) {
        badgeEl.innerText = pool.scaling_state;
        if (pool.scaling_state === "SCALING_OUT") {
            badgeEl.style.color = "#f59e0b";
            badgeEl.style.background = "rgba(245, 158, 11, 0.15)";
            badgeEl.style.borderColor = "rgba(245, 158, 11, 0.3)";
        } else if (pool.scaling_state === "COOLDOWN_DRAIN") {
            badgeEl.style.color = "#3b82f6";
            badgeEl.style.background = "rgba(59, 130, 246, 0.15)";
            badgeEl.style.borderColor = "rgba(59, 130, 246, 0.3)";
        } else {
            badgeEl.style.color = "#10b981";
            badgeEl.style.background = "rgba(16, 185, 129, 0.15)";
            badgeEl.style.borderColor = "rgba(16, 185, 129, 0.3)";
        }
    }

    const gridEl = document.getElementById("runtime-pool-grid");
    if (gridEl && Array.isArray(pool.runtimes) && pool.runtimes.length > 0) {
        gridEl.innerHTML = pool.runtimes.map((r, i) => {
            const isBaseline = r.port === 2001 || r.port === 2002;
            const role = isBaseline ? (r.port === 2001 ? "Baseline (Compiler)" : "Baseline (Scripts)") : "Dynamic Elastic";
            const statusColor = r.status === "DRAINING" ? "#f59e0b" : "#10b981";
            return \`
                <div class="runtime-instance-box" style="padding: 10px 14px; border-radius: 8px; background: rgba(31, 41, 55, 0.6); border: 1px solid rgba(75, 85, 99, 0.4);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <strong style="color: #e5e7eb; font-size: 0.85rem;">Piston-\${i + 1} (:\${r.port})</strong>
                        <span style="color: \${statusColor}; font-size: 0.75rem; font-weight: 600;">\${r.status || 'HEALTHY'}</span>
                    </div>
                    <div style="font-size: 0.75rem; color: #9ca3af;">Role: \${role}</div>
                    <div style="font-size: 0.75rem; color: #a78bfa; margin-top: 4px;">In-flight Jobs: \${r.active_jobs || 0}</div>
                </div>
            \`;
        }).join("");
    }
}
`;
    appJsContent += runtimePoolHelper;
    fs.writeFileSync(appJsPath, appJsContent, "utf-8");
    console.log("✅ Patched app/ui/static/app.js to render live Runtime Pool updates");
} else {
    console.log("ℹ️ app/ui/static/app.js already patched");
}

console.log("\n🎉 ALL WSL TELEMETRY SERVICE FILES SUCCESSFULLY PATCHED AND INTEGRATED!\n");
