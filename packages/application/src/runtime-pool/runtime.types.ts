export type RuntimeStatus = "HEALTHY" | "DRAINING" | "OFFLINE" | "SCALING_UP";

export interface RuntimeInstance {
    id: string;
    url: string;
    port: number;
    status: RuntimeStatus;
    activeJobs: number;
    capabilities?: string[];
    isBaseline: boolean;
    createdAt: number;
    lastHeartbeat: number;
}

export interface RuntimeSpec {
    id?: string;
    port: number;
    memoryLimitBytes?: number;
    cpuShares?: number;
    type?: "HEAVY_COMPILER" | "LIGHTWEIGHT_INTERPRETER" | "GENERAL";
}

export interface SubmissionRoutingContext {
    submissionId: string;
    language: string;
    sourceCode?: string;
    workload: "LIGHT" | "HEAVY";
    priority?: "HIGH" | "NORMAL";
    isLiveBattle?: boolean;
    matchId?: string;
    targetRuntimeUrl?: string;
    targetPort?: number;
}
