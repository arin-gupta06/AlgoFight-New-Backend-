import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCodeBranch,
  faCodeMerge,
  faLaptopCode,
  faServer,
  faGraduationCap,
  faEnvelope,
  faCopy,
  faCheck,
} from "@fortawesome/free-solid-svg-icons";
import { faLinkedin, faGithub } from "@fortawesome/free-brands-svg-icons";
import vivekPic from "../../assets/devs/vivek.png";
import krishPic from "../../assets/devs/krish.jpg";
import arinPic from "../../assets/devs/arin.png";
import atulPic from "../../assets/devs/atul.png";
import BackgroundPaths from "../BackgroundPaths/BackgroundPaths";
import "../BackgroundPaths/BackgroundPaths.css";
import Footer from "../Common/Footer/Footer";
import "./Developer.css";

const teamMembers = [
  {
    name: "Arin Gupta",
    role: "Full Stack Architect & Systems Lead",
    categoryBadge: "CORE ARCHITECTURE & SYSTEMS ENGINEERING",
    tagChip: "Core Architect",
    institution: "Madhav Institute of Technology & Science (Deemed to be University), Gwalior",
    bio: "Architects the core application edge, real-time distributed state machines, and cryptographic admission gateways. Obsessed with sub-millisecond execution, tamper-proof user trust contexts, and engineering a fluid, high-octane 1v1 battle experience.",
    pic: arinPic,
    stack: "Distributed Systems & Core Edge",
    skills: ["Distributed State Machines", "Logical User Gateways", "Elastic Telemetry Spine", "Realtime Arenas"],
    icon: faCodeMerge,
    headerIcon: faCodeBranch,
    tone: "tone-cyan",
    linkedin: "https://www.linkedin.com/in/arin-gupta-2b94b032a/",
    github: "https://github.com/arin-gupta06",
    imgStyle: { objectPosition: "center 15%" },
  },
  {
    name: "Vivek Chaurasiya",
    role: "Backend & Sandbox Infrastructure Lead",
    categoryBadge: "INFRASTRUCTURE & RUNTIME ENGINES",
    tagChip: "Infrastructure Lead",
    institution: "Madhav Institute of Technology & Science (Deemed to be University), Gwalior",
    bio: "Engineers database architecture, Prisma query optimization, asynchronous job queues, and isolated code evaluation sandboxes. Ensures the backend executes arbitrary code with strict isolation, low latency, and infinite horizontal scalability.",
    pic: vivekPic,
    stack: "Backend & Sandbox Engines",
    skills: ["PostgreSQL & Prisma", "Elastic BullMQ Queues", "Piston Multi-Runtime Fleet", "System Scalability"],
    icon: faServer,
    headerIcon: faServer,
    tone: "tone-emerald",
    linkedin: "https://www.linkedin.com/in/vivek-chaurasiya-722037315",
    github: "https://github.com/VivekChaurasiya95",
    imgStyle: { objectPosition: "center 20%" },
  },
  {
    name: "Krish Dargar",
    role: "Frontend & UI/UX Systems Architect",
    categoryBadge: "DESIGN SYSTEMS & CREATIVE DIRECTION",
    tagChip: "UI/UX Architect",
    institution: "Madhav Institute of Technology & Science (Deemed to be University), Gwalior",
    bio: "Crafts the cybernetic design language, glassmorphic interfaces, and micro-animations. Translates complex algorithmic mechanics into lightning-fast, intuitive, and visually stunning web applications that coders love to use.",
    pic: krishPic,
    stack: "UI/UX & Design Systems",
    skills: ["Cyber Glassmorphic UI", "React.js & Framer Motion", "WhatsApp Media Previews", "Responsive Layouts"],
    icon: faLaptopCode,
    headerIcon: faLaptopCode,
    tone: "tone-magenta",
    linkedin: "https://www.linkedin.com/in/krish-dargar-101774324/",
    github: "https://github.com/KD2303",
    imgStyle: { objectPosition: "center 15%" },
  },
];

const mentor = {
  name: "Mr. Atul Chauhan",
  role: "Faculty Mentor & Technical Advisor",
  categoryBadge: "INSTITUTIONAL MENTORSHIP & TECHNICAL GUIDANCE",
  tagChip: "Programmer of MITS DU",
  institution: "Madhav Institute of Technology & Science (Deemed to be University), Gwalior",
  bio: "Providing distinguished institutional mentorship, systems guidance, and architectural advisory for AlgoFight at MITS DU. Inspires and steers student engineers to build high-throughput real-time platforms, develop disciplined algorithmic problem-solving capabilities, and adhere to industry-standard software engineering benchmarks.",
  pic: atulPic,
  stack: "Programmer of MITS DU",
  skills: [
    "Programmer of MITS DU",
    "Institutional Guidance",
    "Systems Engineering",
    "Pedagogical Advisory",
    "Competitive Programming Steering",
  ],
  icon: faCodeBranch,
  headerIcon: faGraduationCap,
  tone: "tone-amber",
  email: "atul@mitsgwalior.in",
  imgStyle: { objectPosition: "center 15%" },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
};

const childVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: "easeOut" },
  },
};

function Developer() {
  const [copiedEmail, setCopiedEmail] = useState(false);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "AlgoFight Developers & Creators | Arin Gupta, Vivek Chaurasiya, Krish Dargar";

    const metaDesc = document.querySelector('meta[name="description"]');
    const prevDesc = metaDesc ? metaDesc.getAttribute("content") : null;
    if (metaDesc) {
      metaDesc.setAttribute(
        "content",
        "Meet the core developers and architects of AlgoFight: Arin Gupta (Full Stack Architect & Systems Lead), Vivek Chaurasiya (Backend & Sandbox Infrastructure Lead), and Krish Dargar (Frontend & UI/UX Systems Architect), mentored by Mr. Atul Chauhan at MITS DU Gwalior."
      );
    }

    const metaKeywords = document.querySelector('meta[name="keywords"]');
    const prevKeywords = metaKeywords ? metaKeywords.getAttribute("content") : null;
    if (metaKeywords) {
      metaKeywords.setAttribute(
        "content",
        "AlgoFight developers, AlgoFight creators, AlgoFight team, Arin Gupta, Vivek Chaurasiya, Krish Dargar, Krish Darger, Atul Chauhan, MITS Gwalior AlgoFight, software architects, competitive programming creators"
      );
    }

    const canonicalLink = document.querySelector('link[rel="canonical"]');
    const prevCanonical = canonicalLink ? canonicalLink.getAttribute("href") : null;
    if (canonicalLink) {
      canonicalLink.setAttribute("href", "https://algofight.com/developer");
    }

    return () => {
      document.title = prevTitle;
      if (metaDesc && prevDesc) metaDesc.setAttribute("content", prevDesc);
      if (metaKeywords && prevKeywords) metaKeywords.setAttribute("content", prevKeywords);
      if (canonicalLink && prevCanonical) canonicalLink.setAttribute("href", prevCanonical);
    };
  }, []);

  const handleCopyMentorEmail = () => {
    navigator.clipboard.writeText("atul@mitsgwalior.in");
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2400);
  };

  return (
    <BackgroundPaths>
      <div className="developer-page">
        {/* Hero Section */}
        <motion.section
          className="developer-hero-header"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <h1 className="developer-hero-title">
            BUILT BY <span className="word-glow-cyan">ALGOFIGHT ARCHITECTS</span>
          </h1>

          <p className="developer-hero-desc">
            Engineered from the ground up as a high-throughput, sub-second algorithmic combat platform. Driven by distributed state machines, containerized judge sandboxes, and modern glassmorphic aesthetics.
          </p>
        </motion.section>

        {/* Developer Cards Section */}
        <motion.section
          className="developer-team-grid"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {teamMembers.map((member) => (
            <motion.article
              key={member.name}
              variants={childVariants}
              className={`dev-profile-card dash-card dev-column-card ${member.tone}`}
              itemScope
              itemType="https://schema.org/Person"
            >
              <meta itemProp="url" content={`https://algofight.com/developer#${member.name.toLowerCase().replace(/\s+/g, '-')}`} />
              {member.name === "Krish Dargar" && (
                <meta itemProp="alternateName" content="Krish Darger" />
              )}

              {/* Category Badge */}
              <div className="card-header-badge">
                <FontAwesomeIcon icon={member.headerIcon} />
                <span>{member.categoryBadge}</span>
              </div>

              <div className="card-inner">
                {/* Circular Avatar with Glowing Halo */}
                <div className="card-avatar-wrap">
                  <div className="card-avatar-glow" />
                  <div className="card-avatar-img-box">
                    <img
                      src={member.pic}
                      alt={member.name}
                      className="card-avatar-img"
                      style={member.imgStyle}
                      itemProp="image"
                    />
                  </div>
                  <div className="card-tag-chip">
                    <span>{member.tagChip}</span>
                  </div>
                </div>

                {/* Content Section */}
                <div className="card-content">
                  <div className="card-title-row">
                    <div>
                      <h2 className="card-name" itemProp="name">{member.name}</h2>
                      <div className="card-role-badge">
                        <FontAwesomeIcon icon={member.icon} />
                        <span itemProp="jobTitle">{member.role}</span>
                      </div>
                    </div>
                    <div className="card-tag-pill">{member.stack}</div>
                  </div>

                  <p className="card-institution" itemProp="affiliation">{member.institution}</p>
                  <p className="card-bio" itemProp="description">{member.bio}</p>

                  <div className="card-skills-list">
                    {member.skills.map((skill) => (
                      <span key={skill}>{skill}</span>
                    ))}
                  </div>

                  <div className="card-contact-actions">
                    {member.linkedin && (
                      <a
                        href={member.linkedin}
                        target="_blank"
                        rel="noreferrer"
                        className="card-primary-btn"
                        title={`${member.name} on LinkedIn`}
                        itemProp="sameAs"
                      >
                        <FontAwesomeIcon icon={faLinkedin} />
                        <span>LinkedIn</span>
                      </a>
                    )}
                    {member.github && (
                      <a
                        href={member.github}
                        target="_blank"
                        rel="noreferrer"
                        className="card-secondary-btn"
                        title={`${member.name} on GitHub`}
                        itemProp="sameAs"
                      >
                        <FontAwesomeIcon icon={faGithub} />
                        <span>GitHub</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </motion.article>
          ))}
        </motion.section>

        {/* Faculty Mentor Section */}
        <motion.section
          className={`dev-profile-card dash-card ${mentor.tone} faculty-mentor-card`}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          itemScope
          itemType="https://schema.org/Person"
        >
          {/* Category Badge */}
          <div className="card-header-badge">
            <FontAwesomeIcon icon={mentor.headerIcon} />
            <span>{mentor.categoryBadge}</span>
          </div>

          <div className="card-inner">
            {/* Circular Avatar with Glowing Halo */}
            <div className="card-avatar-wrap">
              <div className="card-avatar-glow" />
              <div className="card-avatar-img-box">
                <img
                  src={mentor.pic}
                  alt={mentor.name}
                  className="card-avatar-img"
                  style={mentor.imgStyle}
                  itemProp="image"
                />
              </div>
              <div className="card-tag-chip">
                <span>{mentor.tagChip}</span>
              </div>
            </div>

            {/* Content Section */}
            <div className="card-content">
              <div className="card-title-row">
                <div>
                  <h2 className="card-name" itemProp="name">{mentor.name}</h2>
                  <div className="card-role-badge">
                    <FontAwesomeIcon icon={mentor.icon} />
                    <span itemProp="jobTitle">{mentor.role}</span>
                  </div>
                </div>
                <div className="card-tag-pill">{mentor.stack}</div>
              </div>

              <p className="card-institution" itemProp="affiliation">{mentor.institution}</p>
              <p className="card-bio" itemProp="description">{mentor.bio}</p>

              <div className="card-skills-list">
                {mentor.skills.map((skill) => (
                  <span key={skill}>{skill}</span>
                ))}
              </div>

              <div className="card-contact-actions">
                <a
                  href={`mailto:${mentor.email}`}
                  className="card-primary-btn mentor-email-btn"
                  title={`Send email to ${mentor.name}`}
                  itemProp="email"
                >
                  <FontAwesomeIcon icon={faEnvelope} />
                  <span>{mentor.email}</span>
                </a>
                <button
                  type="button"
                  className="card-secondary-btn"
                  onClick={handleCopyMentorEmail}
                  title="Copy email address"
                >
                  <FontAwesomeIcon icon={copiedEmail ? faCheck : faCopy} />
                  <span>{copiedEmail ? "Copied!" : "Copy Email"}</span>
                </button>
              </div>
            </div>
          </div>
        </motion.section>
      </div>
      <Footer />
    </BackgroundPaths>
  );
}

export default Developer;
