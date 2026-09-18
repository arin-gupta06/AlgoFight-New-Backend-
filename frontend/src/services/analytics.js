// frontend/src/services/analytics.js
/**
 * Unified Analytics Service for AlgoFight
 * Wraps canonical event pipeline, client-side buffering, and telemetry transmission.
 */
import { unifiedAnalytics } from "./analytics/core.js";
export { unifiedAnalytics } from "./analytics/core.js";
export { AnalyticsPriority, EventCategory, createCanonicalEvent } from "./analytics/canonicalEvent.js";

// Backward-compatibility alias for legacy imports
export const surfingTracker = unifiedAnalytics;

export default unifiedAnalytics;
