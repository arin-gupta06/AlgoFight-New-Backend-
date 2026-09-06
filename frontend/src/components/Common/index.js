// frontend/src/components/Common/index.js

// Routing Guards
export { default as AdminRoute } from "./routing/AdminRoute";
export { default as ProtectedRoute } from "./routing/ProtectedRoute";

// Modals & Dialogs
export { default as CompleteProfileDialog } from "./modals/CompleteProfileDialog";
export { default as DetailedAnalysisModal } from "./modals/DetailedAnalysisModal";
export { default as PublicInfoModal } from "./modals/PublicInfoModal";

// System Broadcasts & Previews
export { default as SystemBroadcastBanner } from "./broadcasts/SystemBroadcastBanner";
export { default as SystemBroadcastCard } from "./broadcasts/SystemBroadcastCard";
export { default as WhatsAppDocumentPreview } from "./broadcasts/WhatsAppDocumentPreview";

// Gamification & Badges
export { default as RankEmblem, RANK_TIERS, getRankTier, getTierColor } from "./gamification/RankEmblem";

// Problem Statement View
export { default as ProblemStatement } from "./problem/ProblemStatement";

// Icons
export * from "./icons/Icons";
