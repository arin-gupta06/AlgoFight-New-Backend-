// frontend/src/components/Home/Home.jsx
import React, { useState, useEffect } from 'react';
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
    faLock
} from "@fortawesome/free-solid-svg-icons";
import { useNavigate } from 'react-router-dom';
import BackgroundPaths from '../BackgroundPaths/BackgroundPaths';
import '../BackgroundPaths/BackgroundPaths.css';
import { fetchPracticeProblems } from '../../services/api';
import PublicInfoModal from '../Common/PublicInfoModal';

const featureCards = [
    {
        title: 'Real-Time 1v1 Duels',
        copy: 'Head-to-head algorithmic combat with synchronized room lifecycles and dynamic Elo ratings.',
        icon: faBolt,
    },
    {
        title: 'Institutional Arenas',
        copy: 'Dedicated tournament sub-batches for universities and student labs with custom leaderboards.',
        icon: faBuildingColumns,
    },
    {
        title: 'Cryptographic Edge Gateway',
        copy: 'HMAC-SHA256 authenticated admission boundary preventing abusive traffic and bot manipulation.',
        icon: faLock,
    },
    {
        title: 'Isolated Execution Sandbox',
        copy: 'Fast, secure multi-language judging with strict CPU, memory, and timeout governance.',
        icon: faMicrochip,
    },
    {
        title: 'Combatant ID & Badges',
        copy: 'High-entropy alphanumeric platform codes (e.g. AF-USR-XXXXXXX) for verified competition.',
        icon: faShieldHalved,
    },
    {
        title: 'Global Rank & Leaderboard',
        copy: 'Climb through competitive tiers from Bronze to Grandmaster with live match analytics.',
        icon: faTrophy,
    },
];

function Home() {
    const navigate = useNavigate();
    const [featuredProblems, setFeaturedProblems] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeModalTab, setActiveModalTab] = useState('about');

    const handleOpenModal = (tabKey) => {
        setActiveModalTab(tabKey);
        setIsModalOpen(true);
    };

    useEffect(() => {
        const getProblems = async () => {
            try {
                // Fetch problems and pick 3 at random
                const data = await fetchPracticeProblems({ limit: 50, mode: 'practice' });
                const problemsList = data?.problems || [];
                const shuffled = [...problemsList].sort(() => 0.5 - Math.random());
                setFeaturedProblems(shuffled.slice(0, 3));
            } catch (err) {
                console.error("Error fetching featured problems:", err);
            }
        };
        getProblems();
    }, []);

    return (
        <BackgroundPaths>
            <div className="home-container">
                {/* Hero Section */}
                <div className="hero-section">
                    <div className="hero-left">
                        <div className="pre-heading">COMPETITIVE PROGRAMMING REDEFINED</div>
                        <h1 className="hero-heading">
                            <span className="text-white" style={{ textShadow: '0 0 25px rgba(0, 229, 255, 0.7)' }}>CODE</span>
                            <span className="text-purple">BATTLE</span>
                            <span className="text-white" style={{ textShadow: '0 0 25px rgba(0, 229, 255, 0.7)' }}>DOMINATE</span>
                        </h1>
                        <p className="hero-description">
                            Join 50,000+ developers competing in real-time algorithmic battles. Sub-millisecond judging, cryptographic trust, and live multiplayer duels.
                        </p>
                        <div className="hero-buttons">
                            <button className="btn-primary" onClick={() => navigate("/battle")}>
                                Start Competing <FontAwesomeIcon icon={faArrowRight} className="btn-icon" />
                            </button>
                            <button className="btn-secondary" onClick={() => navigate("/about")}>
                                <FontAwesomeIcon icon={faUsers} className="btn-icon-left" /> About System
                            </button>
                        </div>
                    </div>

                    <div className="hero-right">
                        <div className="stat-card-glass">
                            <div className="stat-block">
                                <h2 className="stat-number stat-pink">50K+</h2>
                                <p className="stat-label">Active Combatants</p>
                            </div>
                            <div className="stat-block">
                                <h2 className="stat-number stat-cyan">2M+</h2>
                                <p className="stat-label">Submissions Judged</p>
                            </div>
                            <div className="stat-block">
                                <h2 className="stat-number stat-yellow">&lt; 6ms</h2>
                                <p className="stat-label">Gateway Latency</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Featured Problems Section */}
                <section className="competitions-section home-panel">
                    <div className="comp-header-row">
                        <div>
                            <div className="pre-heading">HANDPICKED CHALLENGES</div>
                            <h2 className="home-section-title">Prove Your <span className="text-yellow-gradient">Skills</span></h2>
                        </div>
                        <button className="btn-dark btn-view-all" onClick={() => navigate('/practice')}>
                            <FontAwesomeIcon icon={faCodeBranch} /> View All Problems
                        </button>
                    </div>

                    <div className="comp-grid" style={{ minHeight: '260px' }}>
                        {featuredProblems.length > 0 ? featuredProblems.map((problem) => {
                            const problemId = problem.id || problem._id;
                            return (
                                <article key={problemId} className="comp-card" style={{ display: 'flex', flexDirection: 'column' }}>
                                    <h3 className="comp-title">{problem.title}</h3>
                                    <div style={{ marginBottom: '1rem', marginTop: '0.4rem' }}>
                                        <span className={`comp-tag diff-${(problem.difficulty || "medium").toLowerCase()}`} style={{ display: 'inline-block', fontWeight: 'bold' }}>
                                            {(problem.difficulty || "Medium").toUpperCase()}
                                        </span>
                                    </div>

                                    <div className="comp-details" style={{ flexGrow: 1, marginBottom: '1.5rem', color: '#a0a0a0', fontSize: '0.95rem', lineHeight: '1.5' }}>
                                        {problem.statement || problem.description ? (problem.statement || problem.description).substring(0, 100) + '...' : 'Challenge your algorithmic thinking with this classic problem designed to test your limits.'}
                                    </div>

                                    <button
                                        className="btn-primary w-100"
                                        onClick={() => navigate('/practice/' + problemId)}
                                    >
                                        Solve Problem
                                    </button>
                                </article>
                            );
                        }) : (
                            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 0', color: '#888' }}>
                                <div className="loader" style={{ fontSize: '1rem', marginBottom: '1rem' }}>...</div>
                                <p>Loading challenges...</p>
                            </div>
                        )}
                    </div>
                </section>

                {/* Features Section */}
                <section className="features-section home-panel">
                    <div className="pre-heading">PLATFORM CAPABILITIES</div>
                    <h2 className="home-section-title">Engineered For <span className="text-cyan-gradient">Champions</span></h2>

                    <div className="features-grid">
                        {featureCards.map((feature) => (
                            <article key={feature.title} className="feature-card">
                                <div className="feature-icon"><FontAwesomeIcon icon={feature.icon} /></div>
                                <h3>{feature.title}</h3>
                                <p>{feature.copy}</p>
                            </article>
                        ))}
                    </div>
                </section>

                {/* CTA Section */}
                <section className="cta-section">
                    <div className="cta-glass">
                        <h2 className="cta-heading">Ready to <span className="text-purple">Level Up?</span></h2>
                        <p className="cta-description">Join thousands of developers sharpening their algorithmic instincts and climbing the ranks in real time.</p>
                        <div className="cta-buttons">
                            <button className="btn-primary" onClick={() => navigate('/signup')}>Create Free Account <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: "8px" }} /></button>
                            <button className="btn-dark" onClick={() => navigate('/practice')}>Explore Problems</button>
                        </div>
                        <p className="cta-subtext">Instant access. Start solving and dueling in seconds.</p>
                    </div>
                </section>

            </div>

            {/* Footer */}
            <footer className="footer-home">
                <div className="footer-content">
                    <div className="footer-brand">
                        <h2>{'<'}/{'>'} AlgoFight</h2>
                        <p>The ultimate real-time platform for competitive programming, institutional arenas, and technical duels.</p>
                    </div>
                    <div className="footer-links">
                        <div className="link-col">
                            <h4>Platform</h4>
                            <a href="/practice">Problems</a>
                            <a href="/battle">1v1 Arenas</a>
                            <a href="/leaderboard">Leaderboard</a>
                        </div>
                        <div className="link-col">
                            <h4>Architecture</h4>
                            <a onClick={() => handleOpenModal('about')} style={{ cursor: 'pointer' }}>About System</a>
                            <a href="/developer">Architects</a>
                            <a href="/admin">Control Hub</a>
                        </div>
                        <div className="link-col">
                            <h4>Support</h4>
                            <a onClick={() => handleOpenModal('help')} style={{ cursor: 'pointer' }}>Help Center</a>
                            <a onClick={() => handleOpenModal('contact')} style={{ cursor: 'pointer' }}>Contact Us</a>
                            <a onClick={() => handleOpenModal('blog')} style={{ cursor: 'pointer' }}>DevLog</a>
                        </div>
                        <div className="link-col">
                            <h4>Legal</h4>
                            <a onClick={() => handleOpenModal('terms')} style={{ cursor: 'pointer' }}>Terms</a>
                            <a onClick={() => handleOpenModal('privacy')} style={{ cursor: 'pointer' }}>Privacy</a>
                            <a href="/cookies">Cookies</a>
                        </div>
                    </div>
                </div>
                <div className="footer-bottom">
                    <p>&copy; 2026 AlgoFight. All rights reserved.</p>
                    <div className="social-icons">
                        <a href="/developer">Arin Gupta</a>
                        <a href="/developer">Vivek Chaurasiya</a>
                        <a href="/developer">Krish Dargar</a>
                    </div>
                </div>
            </footer>

            {/* Public Info Overlay Modal */}
            <PublicInfoModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                activeTab={activeModalTab}
                onSelectTab={setActiveModalTab}
            />
        </BackgroundPaths>
    );
}

export default Home;
