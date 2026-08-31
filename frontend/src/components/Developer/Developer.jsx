import React from "react";
import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBolt,
  faCodeBranch,
  faCodeMerge,
  faLaptopCode,
  faShieldHalved,
  faTerminal,
  faServer,
  faMicrochip,
  faNetworkWired
} from "@fortawesome/free-solid-svg-icons";
import { faLinkedin, faGithub } from "@fortawesome/free-brands-svg-icons";
import vivekPic from "../../assets/devs/vivek.png";
import krishPic from "../../assets/devs/krish.jpg";
import arinPic from "../../assets/devs/arin.png";
import "./Developer.css";

const teamMembers = [
  {
    name: "Arin Gupta",
    role: "Full Stack Architect & Systems Lead",
    bio: "Architects the core application edge, real-time distributed state machines, and cryptographic admission gateways. Obsessed with sub-millisecond execution, tamper-proof user trust contexts, and engineering a fluid, high-octane 1v1 battle experience.",
    pic: arinPic,
    stack: "Distributed Systems & Core Edge",
    skills: ["Distributed State Machines", "Logical User Gateways", "Fastify & WebSockets", "Realtime Arenas"],
    icon: faCodeMerge,
    tone: "cyan",
    linkedin: "https://www.linkedin.com/in/arin-gupta-2b94b032a/",
    github: "https://github.com/arin-gupta06",
    imgStyle: { objectPosition: "center top" },
  },
  {
    name: "Vivek Chaurasiya",
    role: "Backend & Sandbox Infrastructure Lead",
    bio: "Engineers database architecture, Prisma query optimization, asynchronous job queues, and isolated code evaluation sandboxes. Ensures the backend executes arbitrary code with strict isolation, low latency, and infinite horizontal scalability.",
    pic: vivekPic,
    stack: "Backend & Sandbox Engines",
    skills: ["PostgreSQL & Prisma", "Redis & BullMQ Queues", "Piston Sandbox Engine", "System Scalability"],
    icon: faServer,
    tone: "cyan",
    linkedin: "https://www.linkedin.com/in/vivek-chaurasiya-722037315",
    github: "https://github.com/VivekChaurasiya95",
    imgStyle: { transform: "scale(1.5)", transformOrigin: "center 20%" },
  },
  {
    name: "Krish Dargar",
    role: "Frontend & UI/UX Systems Architect",
    bio: "Crafts the cybernetic design language, glassmorphic interfaces, and micro-animations. Translates complex algorithmic mechanics into lightning-fast, intuitive, and visually stunning web applications that coders love to use.",
    pic: krishPic,
    stack: "UI/UX & Design Systems",
    skills: ["Cyber Glassmorphic UI", "React.js & Framer Motion", "Interactive Telemetry", "Responsive Layouts"],
    icon: faLaptopCode,
    tone: "pink",
    linkedin: "https://www.linkedin.com/in/krish-dargar-101774324/",
    github: "https://github.com/KD2303",
  },
];

const developerStats = [
  { label: "Core Architects", value: "3" },
  { label: "Monorepo Packages", value: "14" },
  { label: "Gateway Ingress", value: "15k+ RPS" },
  { label: "P99 Latency", value: "< 6ms" },
];

const principles = [
  {
    icon: faShieldHalved,
    title: "Cryptographic Edge Gateway",
    copy: "Every request is vetted at the application edge with HMAC-SHA256 attestations, anti-abuse IP jails, and multi-dimensional token-bucket rate limiters.",
  },
  {
    icon: faBolt,
    title: "Deterministic State Machines",
    copy: "Real-time duel lifecycles strictly enforce zero-race mathematical transitions from matchmaking countdowns to live code execution.",
  },
  {
    icon: faMicrochip,
    title: "Isolated Sandbox Execution",
    copy: "Submissions run in hardware-isolated container sandboxes with strict CPU, memory, and timeout governance.",
  },
  {
    icon: faNetworkWired,
    title: "Zero-Leak Telemetry & Reliability",
    copy: "Engineered with bounded circular memory buffers, live Prometheus scrapers, and fault-tolerant process shields to guarantee 99.99% uptime.",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.14 },
  },
};

const childVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: "easeOut" },
  },
};

function Developer() {
  return (
    <div className="developer-page">
      <motion.section
        className="developer-hero"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <div className="developer-pre-heading">ENGINEERING & ARCHITECTURE</div>
        <h1>
          Built By <span>AlgoFight Architects</span>
        </h1>
        <p>
          Meet the engineers building AlgoFight. Designed from the ground up as a high-throughput, real-time algorithmic combat arena, powered by modern distributed systems and cyber glassmorphic aesthetics.
        </p>

        <div className="developer-stat-grid">
          {developerStats.map((item) => (
            <article key={item.label} className="developer-stat-card">
              <div className="developer-stat-value">{item.value}</div>
              <div className="developer-stat-label">{item.label}</div>
            </article>
          ))}
        </div>
      </motion.section>

      <motion.section
        className="developer-team-grid"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {teamMembers.map((member, index) => (
          <motion.article
            key={member.name}
            variants={childVariants}
            className={`developer-member-card ${member.tone} ${index % 2 === 1 ? "reverse" : ""}`}
          >
            <div className="developer-avatar-wrap">
              <div className="developer-avatar-glow" />
              {member.pic ? (
                 <div className="developer-avatar-container">
                   <img src={member.pic} alt={member.name} className="developer-avatar-img" style={member.imgStyle} />
                 </div>
              ) : (
                 <div className="developer-avatar">{member.name.charAt(0)}</div>
              )}
              <div className="developer-icon-badge">
                <FontAwesomeIcon icon={member.icon} />
              </div>
            </div>

            <div className="developer-member-content">
              <div className="developer-member-head">
                <h2>{member.name}</h2>
                <span className="developer-chip">{member.stack}</span>
              </div>

              <h3>
                <FontAwesomeIcon icon={faCodeMerge} />
                {member.role}
              </h3>

              <p>{member.bio}</p>

              <div className="developer-skill-list">
                {member.skills.map((skill) => (
                  <span key={skill}>{skill}</span>
                ))}
              </div>

              <div className="developer-social-links">
                {member.linkedin !== "#" && (
                  <a href={member.linkedin} target="_blank" rel="noreferrer" className={`social-btn ${member.tone}`}>
                    <FontAwesomeIcon icon={faLinkedin} /> LinkedIn
                  </a>
                )}
                {member.github !== "#" && (
                  <a href={member.github} target="_blank" rel="noreferrer" className={`social-btn ${member.tone}`}>
                    <FontAwesomeIcon icon={faGithub} /> GitHub
                  </a>
                )}
              </div>
            </div>
          </motion.article>
        ))}
      </motion.section>

      <motion.section
        className="developer-principles-panel"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <div className="developer-panel-header">
          <h2>Platform Architecture & Engineering DNA</h2>
          <span className="developer-chip">Production Grade</span>
        </div>

        <div className="developer-principles-grid">
          {principles.map((item) => (
            <article key={item.title} className="developer-principle-card">
              <span className="developer-principle-icon">
                <FontAwesomeIcon icon={item.icon} />
              </span>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </motion.section>
    </div>
  );
}

export default Developer;
