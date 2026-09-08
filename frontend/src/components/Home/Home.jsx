// frontend/src/components/Home/Home.jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import './Home.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faPlay,
    faArrowRight,
    faBolt,
    faUsers,
    faTrophy,
    faBrain,
    faClock,
    faShieldHalved,
    faCalendar,
    faCircle,
    faCodeBranch,
    faBuildingColumns,
    faMicrochip,
    faLock,
    faFire,
    faCheckCircle
} from "@fortawesome/free-solid-svg-icons";
import { useNavigate } from 'react-router-dom';
import BackgroundPaths from '../BackgroundPaths/BackgroundPaths';
import '../BackgroundPaths/BackgroundPaths.css';
import { fetchPracticeProblems } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import Footer from '../Common/Footer/Footer';
import HeroCodeEditor from '../LandingPage/HeroCodeEditor';

const featureCards = [
    {
        title: 'Real-Time 1v1 Duels',
        copy: 'Head-to-head algorithmic combat with synchronized room lifecycles, live opponent progress, and dynamic Elo ratings.',
        icon: faBolt,
        tone: 'tone-cyan',
    },
    {
        title: 'Multiplayer Lobbies',
        copy: 'Host private arenas for up to 100 players with configurable problem sets, dynamic difficulty, and live scoreboards.',
        icon: faBuildingColumns,
        tone: 'tone-purple',
    },
    {
        title: 'Anti-Cheat Integrity',
        copy: 'Strict competitive integrity with automated plagiarism detection, sealed judge test suites, and fair-play enforcement.',
        icon: faLock,
        tone: 'tone-pink',
    },
    {
        title: 'Execution Sandboxes',
        copy: 'Hardware-isolated execution environments supporting C++, Python, Java, and JavaScript with sub-second feedback.',
        icon: faMicrochip,
        tone: 'tone-green',
    },
    {
        title: 'Combatant Badges',
        copy: 'Showcase your achievements, custom title banners, verified match credentials, and seasonal victory emblems.',
        icon: faShieldHalved,
        tone: 'tone-gold',
    },
    {
        title: 'Global Leaderboards',
        copy: 'Climb through official competitive tiers from Rookie to Grandmaster with live match analytics and Hall of Fame standings.',
        icon: faTrophy,
        tone: 'tone-yellow',
    },
];

function Home() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [featuredProblems, setFeaturedProblems] = useState([]);
    const [loadingProblems, setLoadingProblems] = useState(true);

    useEffect(() => {
        const getProblems = async () => {
            try {
                setLoadingProblems(true);
                const data = await fetchPracticeProblems({ limit: 50, mode: 'practice' });
                const problemsList = data?.problems || [];
                const shuffled = [...problemsList].sort(() => 0.5 - Math.random());
                setFeaturedProblems(shuffled.slice(0, 3));
            } catch (err) {
                console.error("Error fetching featured problems:", err);
            } finally {
                setLoadingProblems(false);
            }
        };
        getProblems();
    }, []);

    return (
        <BackgroundPaths>
            <div className="home-container">
                {/* Hero Section */}
                <motion.div
                    className="hero-section"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <div className="hero-left">
                        <div className="hero-badge">
                            <span className="badge-pulse-dot" />
                            <span>COMPETITIVE PROGRAMMING ARENA</span>
                        </div>
                        <h1 className="hero-heading">
                            <span className="text-white">CODE</span>
                            <span className="text-purple">BATTLE</span>
                            <span className="text-white">DOMINATE</span>
                        </h1>
                        <p className="hero-description">
                            Join 50,000+ developers competing in real-time algorithmic battles. Sub-second judging, cryptographic anti-cheat, and live multiplayer duels.
                        </p>
                        <div className="hero-buttons">
                            <button className="btn-primary-glow" onClick={() => navigate("/battle")}>
                                Start Competing <FontAwesomeIcon icon={faArrowRight} className="btn-icon" />
                            </button>
                            <button className="btn-secondary-glass" onClick={() => navigate("/about")}>
                                <FontAwesomeIcon icon={faUsers} className="btn-icon-left" /> About System
                            </button>
                        </div>
                    </div>

                    <div className="hero-right">
                        <HeroCodeEditor />
                    </div>
                </motion.div>

                {/* Featured Problems Section */}
                <motion.section
                    className="competitions-section home-panel"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="comp-header-row">
                        <div>
                            <div className="pre-heading">HANDPICKED CHALLENGES</div>
                            <h2 className="home-section-title">Prove Your <span className="text-yellow-gradient">Skills</span></h2>
                        </div>
                        <button className="btn-dark btn-view-all" onClick={() => navigate('/practice')}>
                            <FontAwesomeIcon icon={faCodeBranch} /> View All Problems
                        </button>
                    </div>

                    <div className="comp-grid">
                        {!loadingProblems && featuredProblems.length > 0 ? featuredProblems.map((problem) => {
                            const problemId = problem.id || problem._id;
                            const diff = (problem.difficulty || "Medium").toLowerCase();
                            return (
                                <motion.article
                                    key={problemId}
                                    className="comp-card"
                                    whileHover={{ y: -5 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <div className="comp-card-top">
                                        <h3 className="comp-title">{problem.title}</h3>
                                        <span className={`comp-tag diff-${diff}`}>
                                            {problem.difficulty || "Medium"}
                                        </span>
                                    </div>

                                    <p className="comp-snippet">
                                        {problem.statement || problem.description 
                                            ? (problem.statement || problem.description).substring(0, 110) + '...'
                                            : 'Challenge your algorithmic thinking with this classic problem designed to test speed and accuracy.'}
                                    </p>

                                    <button
                                        className="btn-card-action"
                                        onClick={() => navigate('/practice/' + problemId)}
                                    >
                                        <span>Solve Problem</span>
                                        <FontAwesomeIcon icon={faArrowRight} />
                                    </button>
                                </motion.article>
                            );
                        }) : (
                            <div className="problems-loading-box">
                                <div className="loader-ring" />
                                <p>Scanning battle archives for challenges...</p>
                            </div>
                        )}
                    </div>
                </motion.section>

                {/* Features Section */}
                <motion.section
                    className="features-section home-panel"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="pre-heading">PLATFORM CAPABILITIES</div>
                    <h2 className="home-section-title">Engineered For <span className="text-cyan-gradient">Champions</span></h2>

                    <div className="features-grid">
                        {featureCards.map((feature, idx) => (
                            <motion.article
                                key={feature.title}
                                className="feature-card"
                                whileHover={{ y: -5 }}
                                transition={{ duration: 0.2 }}
                            >
                                <div className={`feature-icon ${feature.tone}`}>
                                    <FontAwesomeIcon icon={feature.icon} />
                                </div>
                                <h3>{feature.title}</h3>
                                <p>{feature.copy}</p>
                            </motion.article>
                        ))}
                    </div>
                </motion.section>

                {/* CTA Section */}
                <motion.section
                    className="cta-section"
                    initial={{ opacity: 0, scale: 0.98 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="cta-glass">
                        <div className="cta-glow-bg" />
                        <h2 className="cta-heading">Ready to <span className="text-purple">Level Up?</span></h2>
                        <p className="cta-description">Join thousands of developers sharpening their algorithmic instincts and climbing global leaderboards in real time.</p>
                        <div className="cta-buttons">
                            {user ? (
                                <button className="btn-primary-glow" onClick={() => navigate('/developer')}>
                                    Meet Our Developers <FontAwesomeIcon icon={faArrowRight} />
                                </button>
                            ) : (
                                <button className="btn-primary-glow" onClick={() => navigate('/signup')}>
                                    Create Free Account <FontAwesomeIcon icon={faArrowRight} />
                                </button>
                            )}
                            <button className="btn-secondary-glass" onClick={() => navigate('/practice')}>
                                Explore Problems
                            </button>
                        </div>
                        <p className="cta-subtext">⚡ Instant access. Start dueling in seconds.</p>
                    </div>
                </motion.section>

            </div>

            {/* Shared Unified Footer */}
            <Footer />
        </BackgroundPaths>
    );
}

export default Home;
