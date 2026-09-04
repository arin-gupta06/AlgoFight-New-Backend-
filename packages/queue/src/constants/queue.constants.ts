export const QUEUE_NAMES = {
    SUBMISSION: "submission-queue",
    SUBMISSION_LIGHT: "submission-light-queue",
    SUBMISSION_HEAVY: "submission-heavy-queue",
    BATTLE_TIMER: "battle-timer-queue",
} as const;

export const JOB_NAMES = {
    SUBMISSION: "submission-job",
    SUBMISSION_LIGHT: "submission-job-light",
    SUBMISSION_HEAVY: "submission-job-heavy",
    BATTLE_TIMER: "battle-timer-job",
} as const;