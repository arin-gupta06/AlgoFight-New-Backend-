import "./setup";
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@algofight/database";
import { GatewayTelemetryCollector } from "@algofight/telemetry/src/gateway-metrics";
import { ConnectionManager } from "../src/websocket/connection-manager";
import { AuditService } from "../src/services/audit.service";
import { LinuxTelemetryBridgeService } from "../src/services/linux-telemetry-bridge.service";

test("Admin Observability: GatewayTelemetryCollector window calculations", () => {
    const collector = new GatewayTelemetryCollector();

    // Initially 0 requests
    assert.equal(collector.getRequestRate(60000), 0);
    assert.equal(collector.getRequestsInWindow(60000), 0);

    // Record 60 requests
    for (let i = 0; i < 60; i++) {
        collector.recordRequest("gw_test", "ctx_test", "GET", 200);
        collector.recordLatency("gw_test", 10 + (i % 20)); // 10ms to 29ms
        if (i < 55) {
            collector.recordAdmission("gw_test", "ctx_test", "STANDARD");
        } else {
            collector.recordRejection("gw_test", "ctx_test", "RATE_LIMIT");
        }
    }

    assert.equal(collector.getRequestsInWindow(60000), 60);
    assert.equal(collector.getRequestRate(60000), 1.0); // 60 req / 60s = 1.0 req/s

    const latency = collector.getLatencyDistribution(60000);
    assert.equal(latency.sampleCount, 60);
    assert.ok(latency.avgMs >= 10 && latency.avgMs <= 30);
    assert.ok(latency.p95Ms >= latency.avgMs);

    const admission = collector.getAdmissionStats(60000);
    assert.equal(admission.total, 60);
    assert.equal(admission.admitted, 55);
    assert.equal(admission.rejected, 5);
    assert.equal(admission.admissionRate, 91.7);
});

test("Admin Observability: ConnectionManager real broadcast fan-out metrics", () => {
    const manager = new ConnectionManager();

    // Initially 0 fan-out
    assert.equal(manager.getFanOutRate(60000), 0);
    assert.equal(manager.totalBroadcastEvents, 0);

    // Record broadcasts via sendToUser and broadcastToAll
    const mockWs = {
        readyState: 1, // WebSocket.OPEN
        send: () => {},
    } as any;

    manager.userSockets.set("user_1", mockWs);
    manager.userSockets.set("user_2", mockWs);

    manager.sendToUser("user_1", "test_event", { msg: "hello" });
    assert.equal(manager.totalBroadcastEvents, 1);

    manager.broadcastToAll("global_event", { msg: "world" });
    assert.equal(manager.totalBroadcastEvents, 3); // 1 + 2 users

    const fanOutRate = manager.getFanOutRate(60000);
    assert.ok(fanOutRate > 0);
    assert.equal(manager.getActiveSocketCount(), 2);
});

test("Admin Observability: AuditService event stream and filtering", async () => {
    const audit = AuditService.getInstance();

    const entry = audit.recordEvent({
        category: "SECURITY",
        severity: "WARN",
        action: "SUSPICIOUS_TOKEN_DETECTED",
        actor: "192.168.1.100",
        details: "Malformed JWT token in authorization header",
        metadata: { headerLength: 12 },
    });

    assert.ok(entry.id.startsWith("aud_"));
    assert.equal(entry.category, "SECURITY");
    assert.equal(entry.severity, "WARN");

    const searchResults = await audit.getLogs({
        category: "SECURITY",
        search: "SUSPICIOUS",
        includeLinuxLogs: false,
    });

    assert.ok(searchResults.logs.length >= 1);
    assert.equal(searchResults.logs[0].action, "SUSPICIOUS_TOKEN_DETECTED");
});

test("Admin Observability: LinuxTelemetryBridgeService health probe fallback", async () => {
    const bridge = LinuxTelemetryBridgeService.getInstance();
    const health = await bridge.checkHealth();

    assert.ok("online" in health);
    assert.ok("status" in health);
    assert.ok("endpoint" in health);
});

after(async () => {
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
});


