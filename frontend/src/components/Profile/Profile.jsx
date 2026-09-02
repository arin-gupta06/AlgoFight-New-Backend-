import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import './Profile.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBolt,
    faChartLine,
    faCheckCircle,
    faCode,
    faCoins,
    faMedal,
    faShieldHalved,
    faStar,
    faTrophy,
    faUser,
    faCrosshairs,
    faFire,
    faCheck,
    faTimes,
    faCopy,
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { fetchUserProfile } from '../../services/api';
import { connectSocket, getSocket } from '../../services/socket';
import { calculateArenaPointBreakdown, normalizeUserStats, getRankProgressByRating } from '../../utils/playerMetrics';
import RankEmblem from '../Common/RankEmblem';

function Profile() {
    const { userId } = useParams();
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();
    const { notify } = useNotification();

    const [profile, setProfile] = useState(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);
    const [profileError, setProfileError] = useState('');

    // Duel challenge states
    const [outgoingChallenge, setOutgoingChallenge] = useState(null);
    const [incomingChallenge, setIncomingChallenge] = useState(null);
    const [offlineChallengeTarget, setOfflineChallengeTarget] = useState(null);
    const [challengeTimeRemaining, setChallengeTimeRemaining] = useState(30);

    const targetUserId = userId || user?.uid;
    const isOwnProfile = !userId || userId === user?.uid;

    useEffect(() => {
        let active = true;

        const loadProfile = async () => {
            if (!targetUserId) {
                setProfile(null);
                setIsLoadingProfile(false);
                return;
            }

            setIsLoadingProfile(true);
            setProfileError('');

            try {
                const data = await fetchUserProfile(targetUserId);
                if (!active) return;
                setProfile(data || null);
            } catch (error) {
                if (!active) return;
                setProfileError('Could not sync profile data. Showing local defaults.');
                setProfile(null);
            } finally {
                if (active) setIsLoadingProfile(false);
            }
        };

        loadProfile();
        return () => {
            active = false;
        };
    }, [targetUserId]);

    // WebSocket listeners for 1v1 Battle Challenges
    useEffect(() => {
        let active = true;
        let token = null;

        const initSocket = async () => {
            if (user) {
                token = await user.getIdToken().catch(() => null);
            }
            if (!active) return;

            const currentUserId = user?.uid || user?.email || "Guest";
            const currentUsername = user?.displayName || user?.email?.split("@")[0] || "Player";
            const socket = connectSocket(token, currentUserId, currentUsername);

            socket.emit("auth", {
                userId: currentUserId,
                username: currentUsername,
                email: user?.email,
            });

            const handleChallengeReceived = (challenge) => {
                setIncomingChallenge(challenge);
                setChallengeTimeRemaining(30);
                notify({
                    type: "info",
                    title: "⚔️ Duel Challenge!",
                    message: `${challenge.fromUsername} challenged you to a 1v1 battle!`,
                    duration: 5000,
                });
            };

            const handleChallengeSent = (challenge) => {
                setOutgoingChallenge(challenge);
                setChallengeTimeRemaining(30);
                notify({
                    type: "success",
                    title: "Challenge Dispatched",
                    message: `Waiting for ${challenge.targetUsername} to accept...`,
                    duration: 4000,
                });
            };

            const handleChallengeDeclined = (data) => {
                setOutgoingChallenge(null);
                notify({
                    type: "warning",
                    title: "Duel Declined",
                    message: `${data.targetUsername || "Player"} declined the battle challenge.`,
                    duration: 4000,
                });
            };

            const handleChallengeCancelled = () => {
                setIncomingChallenge(null);
                setOutgoingChallenge(null);
                notify({
                    type: "info",
                    title: "Challenge Cancelled",
                    message: "The challenge was cancelled.",
                    duration: 3000,
                });
            };

            const handleChallengeExpired = () => {
                setIncomingChallenge(null);
                setOutgoingChallenge(null);
            };

            const handleChallengeTargetOffline = (data) => {
                setOutgoingChallenge(null);
                setOfflineChallengeTarget(data);
                notify({
                    type: "warning",
                    title: "Competitor Offline",
                    message: `${data.targetUsername || "Player"} is currently offline. You can challenge AlgoBot instead!`,
                    duration: 4000,
                });
            };

            const handleSocketError = (err) => {
                const msg = typeof err === "string" ? err : err?.message || err?.error || "Battle server notification";
                notify({
                    type: "error",
                    title: "Battle Server",
                    message: msg,
                    duration: 4000,
                });
            };

            const handleMatchFound = (matchPayload) => {
                setIncomingChallenge(null);
                setOutgoingChallenge(null);
                setOfflineChallengeTarget(null);
                notify({
                    type: "success",
                    title: "Combat Engaged!",
                    message: "Entering live battle arena...",
                    duration: 2500,
                });
                navigate("/battle/live", { state: { matchData: matchPayload } });
            };

            socket.on("challenge_received", handleChallengeReceived);
            socket.on("challenge_sent", handleChallengeSent);
            socket.on("challenge_declined", handleChallengeDeclined);
            socket.on("challenge_cancelled", handleChallengeCancelled);
            socket.on("challenge_expired", handleChallengeExpired);
            socket.on("challenge_target_offline", handleChallengeTargetOffline);
            socket.on("error", handleSocketError);
            socket.on("match_found", handleMatchFound);

            return () => {
                socket.off("challenge_received", handleChallengeReceived);
                socket.off("challenge_sent", handleChallengeSent);
                socket.off("challenge_declined", handleChallengeDeclined);
                socket.off("challenge_cancelled", handleChallengeCancelled);
                socket.off("challenge_expired", handleChallengeExpired);
                socket.off("challenge_target_offline", handleChallengeTargetOffline);
                socket.off("error", handleSocketError);
                socket.off("match_found", handleMatchFound);
            };
        };

        const cleanupPromise = initSocket();

        return () => {
            active = false;
            cleanupPromise.then((cleanup) => {
                if (typeof cleanup === "function") cleanup();
            });
        };
    }, [user, navigate, notify]);

    // Challenge Timer
    useEffect(() => {
        if (!outgoingChallenge && !incomingChallenge) return;

        const timer = setInterval(() => {
            setChallengeTimeRemaining((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    setOutgoingChallenge(null);
                    setIncomingChallenge(null);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [outgoingChallenge, incomingChallenge]);

    const displayName = profile?.username || profile?.displayName || (isOwnProfile ? (user?.displayName || user?.email) : 'Competitor');
    const email = isOwnProfile ? (profile?.email || user?.email || '') : (profile?.platformCode || profile?.email || '');
    const photoURL = profile?.photoURL || (isOwnProfile ? user?.photoURL : '');

    const {
        rating,
        matchesPlayed,
        matchesWon,
        practiceSolved,
        practiceSubmissions,
        winRate,
        practiceAccuracy,
        lossCount,
        rank,
    } = normalizeUserStats(profile || {});

    const pointBreakdown = calculateArenaPointBreakdown({
        rating,
        matchesPlayed,
        matchesWon,
        practiceSolved,
        practiceSubmissions,
    });
    const arenaPoints = pointBreakdown.total;

    const rankProgress = getRankProgressByRating(rating);
    const activityProgress = Math.min(100, Math.round(((matchesPlayed + practiceSolved) / 120) * 100));
    const practiceProgress = Math.min(100, Math.round((practiceSolved / 100) * 100));
    const consistencyProgress = Math.min(100, Math.round((winRate / 100) * 100));

    const handleSendChallenge = () => {
        let socket = getSocket();
        const currentUserId = user?.uid || user?.email || "Guest";
        const currentUsername = user?.displayName || user?.email?.split("@")[0] || "Player";

        if (!socket || !socket.connected) {
            socket = connectSocket(null, currentUserId, currentUsername);
        }

        const targetId = profile?.id || profile?.email || profile?.platformCode || profile?.username || targetUserId;

        socket.emit("send_challenge", {
            targetUserId: targetId,
            targetUsername: displayName,
            fromUsername: currentUsername,
        });
    };

    const handleAcceptChallenge = () => {
        if (!incomingChallenge) return;
        const socket = getSocket();
        socket.emit("accept_challenge", {
            challengeId: incomingChallenge.challengeId,
        });
    };

    const handleDeclineChallenge = () => {
        if (!incomingChallenge) return;
        const socket = getSocket();
        socket.emit("decline_challenge", {
            challengeId: incomingChallenge.challengeId,
        });
        setIncomingChallenge(null);
    };

    const handleCancelChallenge = () => {
        if (!outgoingChallenge) return;
        const socket = getSocket();
        socket.emit("cancel_challenge", {
            challengeId: outgoingChallenge.challengeId,
        });
        setOutgoingChallenge(null);
    };

    const handleStartBotBattle = () => {
        const socket = getSocket();
        const currentUserId = user?.uid || user?.email || "Guest";
        const currentUsername = user?.displayName || user?.email?.split("@")[0] || "Player";
        socket.emit("start_bot_battle", {
            fromUserId: currentUserId,
            fromUsername: currentUsername,
        });
        setOfflineChallengeTarget(null);
    };

    const profileStats = useMemo(
        () => [
            {
                label: 'Current Rating',
                value: rating,
                hint: `${rank} tier`,
                icon: faTrophy,
                tone: 'gold',
            },
            {
                label: 'Arena Points',
                value: arenaPoints,
                hint: 'Rating + wins + practice + participation',
                icon: faCoins,
                tone: 'cyan',
            },
            {
                label: 'Battles Played',
                value: matchesPlayed,
                hint: `${matchesWon} wins / ${lossCount} losses`,
                icon: faCode,
                tone: 'cyan',
            },
            {
                label: 'Practice Solved',
                value: practiceSolved,
                hint: `${practiceSubmissions} submissions • ${practiceAccuracy}% efficiency`,
                icon: faCheckCircle,
                tone: 'green',
            },
            {
                label: 'Win Rate',
                value: `${winRate}%`,
                hint: 'Across all matches',
                icon: faBolt,
                tone: 'green',
            },
        ],
        [rating, rank, arenaPoints, matchesPlayed, matchesWon, lossCount, winRate, practiceSolved, practiceSubmissions, practiceAccuracy]
    );

    const achievements = useMemo(
        () => [
            {
                title: 'Arena Starter',
                description: 'Play your first 10 battles.',
                unlocked: matchesPlayed >= 10,
                icon: faShieldHalved,
            },
            {
                title: 'Rapid Climber',
                description: 'Reach a 60% win rate.',
                unlocked: winRate >= 60,
                icon: faChartLine,
            },
            {
                title: 'Elite Coder',
                description: 'Cross 1500 rating.',
                unlocked: rating >= 1500,
                icon: faStar,
            },
            {
                title: 'Problem Grinder',
                description: 'Solve 25 practice problems.',
                unlocked: practiceSolved >= 25,
                icon: faCode,
            },
        ],
        [matchesPlayed, winRate, rating, practiceSolved]
    );

    if (authLoading || isLoadingProfile) {
        return (
            <div className="profile-page">
                <div className="profile-loading">Loading profile...</div>
            </div>
        );
    }

    return (
        <div className="profile-page">
            <section className="profile-overview-shell">
                <section className="profile-hero-card">
                    <div className="profile-identity-row">
                        <div className="profile-avatar-shell">
                            {photoURL ? (
                                <img src={photoURL} alt="Profile avatar" className="profile-avatar-image" />
                            ) : (
                                <FontAwesomeIcon icon={faUser} />
                            )}
                        </div>

                        <div className="profile-identity-copy">
                            <div className="profile-pre-heading">{isOwnProfile ? "PLAYER PROFILE" : "COMPETITOR PROFILE"}</div>
                            <h1>{displayName}</h1>
                            <p>{email || 'Competitor'}</p>
                            {(profile?.platformCode || user?.platformCode) && (
                                <div
                                    className="profile-code-badge"
                                    onClick={() => {
                                        const codeToCopy = profile?.platformCode || user?.platformCode;
                                        if (codeToCopy) {
                                            navigator.clipboard.writeText(codeToCopy);
                                            notify({
                                                type: "success",
                                                title: "Code Copied!",
                                                message: `Platform Code ${codeToCopy} copied to clipboard.`,
                                                duration: 2500,
                                            });
                                        }
                                    }}
                                    title="Click to copy Platform Code"
                                >
                                    <span>{profile?.platformCode || user?.platformCode}</span>
                                    <FontAwesomeIcon icon={faCopy} className="profile-code-copy-icon" />
                                </div>
                            )}
                        </div>

                        <div className="profile-header-actions">
                            {!isOwnProfile && (
                                <button
                                    className="profile-challenge-btn"
                                    onClick={handleSendChallenge}
                                    title={`Send a direct 1v1 friendly battle invite to ${displayName}`}
                                >
                                    <FontAwesomeIcon icon={faBolt} /> Invite to Friendly Battle
                                </button>
                            )}
                            <RankEmblem rank={rank} rating={rating} size={48} showBadge={true} glow={true} />
                        </div>
                    </div>

                    {profileError ? <div className="profile-warning">{profileError}</div> : null}
                </section>

                <section className="profile-stat-grid">
                    {profileStats.map((stat) => (
                        <article key={stat.label} className="profile-stat-card">
                            <div className={`profile-stat-icon tone-${stat.tone}`}>
                                <FontAwesomeIcon icon={stat.icon} />
                            </div>
                            <div className="profile-stat-content">
                                <p>{stat.label}</p>
                                <h3>{stat.value}</h3>
                                <span>{stat.hint}</span>
                            </div>
                        </article>
                    ))}
                </section>
            </section>

            <section className="profile-content-grid">
                <article className="profile-panel">
                    <div className="profile-panel-head">
                        <h2>Progress Overview</h2>
                        <span className="profile-chip">Live</span>
                    </div>

                    <div className="profile-progress-list">
                        <div className="profile-progress-item">
                            <div className="profile-progress-head">
                                <span>
                                    {rankProgress.isMaxTier 
                                        ? "Peak Tier (Supreme)" 
                                        : `${rankProgress.ratingToNextTier} rating to ${rankProgress.nextTier.name}`}
                                </span>
                                <strong>
                                    {rating} / {rankProgress.isMaxTier ? "2000+" : rankProgress.nextTier.minRating}
                                </strong>
                            </div>
                            <div className="profile-progress-track">
                                <div 
                                    className="profile-progress-fill" 
                                    style={{ 
                                        width: `${rankProgress.progressWithinTier}%`,
                                        background: rankProgress.currentTier.gradient || "linear-gradient(90deg, #38bdf8, #818cf8)"
                                    }} 
                                />
                            </div>
                        </div>

                        <div className="profile-progress-item">
                            <div className="profile-progress-head">
                                <span>Activity Level</span>
                                <strong>{matchesPlayed + practiceSolved} total actions</strong>
                            </div>
                            <div className="profile-progress-track">
                                <div className="profile-progress-fill tone-pink" style={{ width: `${activityProgress}%` }} />
                            </div>
                        </div>

                        <div className="profile-progress-item">
                            <div className="profile-progress-head">
                                <span>Practice Mastery</span>
                                <strong>{practiceSolved} solved</strong>
                            </div>
                            <div className="profile-progress-track">
                                <div className="profile-progress-fill tone-violet" style={{ width: `${practiceProgress}%` }} />
                            </div>
                        </div>

                        <div className="profile-progress-item">
                            <div className="profile-progress-head">
                                <span>Consistency</span>
                                <strong>{winRate}% win rate</strong>
                            </div>
                            <div className="profile-progress-track">
                                <div className="profile-progress-fill tone-green" style={{ width: `${consistencyProgress}%` }} />
                            </div>
                        </div>
                    </div>
                </article>

                <article className="profile-panel">
                    <div className="profile-panel-head">
                        <h2>Achievements</h2>
                        <span className="profile-chip">Milestones</span>
                    </div>

                    <ul className="profile-achievement-list">
                        {achievements.map((achievement) => (
                            <li key={achievement.title} className={achievement.unlocked ? 'is-unlocked' : ''}>
                                <div className="achievement-left">
                                    <div className="achievement-icon">
                                        <FontAwesomeIcon icon={achievement.icon} />
                                    </div>
                                    <div>
                                        <h4>{achievement.title}</h4>
                                        <p>{achievement.description}</p>
                                    </div>
                                </div>

                                <span className="achievement-status">
                                    <FontAwesomeIcon icon={achievement.unlocked ? faCheckCircle : faMedal} />
                                    {achievement.unlocked ? 'Unlocked' : 'Locked'}
                                </span>
                            </li>
                        ))}
                    </ul>
                </article>
            </section>

            {/* Outgoing Challenge Dialog */}
            <AnimatePresence>
                {outgoingChallenge && (
                    <motion.div
                        className="ap-modal-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="ap-challenge-modal"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                        >
                            <div className="ap-modal-icon-halo">
                                <FontAwesomeIcon icon={faCrosshairs} />
                            </div>
                            <h3 className="ap-modal-title">Duel Challenge Sent!</h3>
                            <p className="ap-modal-desc">
                                Waiting for <span className="ap-modal-target-name">{outgoingChallenge.targetUsername}</span> to accept your 1v1 challenge...
                            </p>

                            <div className="ap-modal-timer-bar">
                                <div
                                    className="ap-modal-timer-progress"
                                    style={{ width: `${(challengeTimeRemaining / 30) * 100}%` }}
                                />
                            </div>

                            <button className="ap-modal-btn-cancel" onClick={handleCancelChallenge}>
                                Cancel Challenge ({challengeTimeRemaining}s)
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Incoming Challenge Modal */}
            <AnimatePresence>
                {incomingChallenge && (
                    <motion.div
                        className="ap-modal-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="ap-challenge-modal ap-incoming-card"
                            initial={{ scale: 0.85, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.85, opacity: 0 }}
                        >
                            <div className="ap-modal-icon-halo ap-incoming-icon-halo">
                                <FontAwesomeIcon icon={faFire} />
                            </div>
                            <h3 className="ap-modal-title">Incoming 1v1 Challenge!</h3>
                            <p className="ap-modal-desc">
                                <span className="ap-modal-target-name">{incomingChallenge.fromUsername}</span> (Rating: {incomingChallenge.fromRating ?? 0}) has challenged you to an instant battle duel!
                            </p>

                            <div className="ap-modal-timer-bar">
                                <div
                                    className="ap-modal-timer-progress"
                                    style={{ width: `${(challengeTimeRemaining / 30) * 100}%` }}
                                />
                            </div>

                            <div className="ap-incoming-actions">
                                <button className="ap-btn-accept" onClick={handleAcceptChallenge}>
                                    <FontAwesomeIcon icon={faCheck} /> Accept Duel ({challengeTimeRemaining}s)
                                </button>
                                <button className="ap-btn-decline" onClick={handleDeclineChallenge}>
                                    <FontAwesomeIcon icon={faTimes} /> Decline
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Offline Challenge Target Modal */}
            <AnimatePresence>
                {offlineChallengeTarget && (
                    <motion.div
                        className="ap-modal-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="ap-challenge-modal"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                        >
                            <div className="ap-modal-icon-halo">
                                <FontAwesomeIcon icon={faBolt} />
                            </div>
                            <h3 className="ap-modal-title">Competitor Offline</h3>
                            <p className="ap-modal-desc">
                                <span className="ap-modal-target-name">{offlineChallengeTarget.targetUsername}</span> is not logged into the battle server right now.
                                <br />
                                Open another browser tab to test live 1v1 challenges, or battle <strong>AlgoBot</strong> right now!
                            </p>

                            <div className="ap-incoming-actions" style={{ marginTop: '16px' }}>
                                <button className="ap-btn-accept" onClick={handleStartBotBattle}>
                                    <FontAwesomeIcon icon={faBolt} /> Challenge AlgoBot 1v1
                                </button>
                                <button className="ap-btn-decline" onClick={() => setOfflineChallengeTarget(null)}>
                                    <FontAwesomeIcon icon={faTimes} /> Close
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default Profile;