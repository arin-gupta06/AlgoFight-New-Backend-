import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faEnvelope,
  faLocationDot,
  faClock,
  faPaperPlane,
  faCheckCircle,
  faBuildingColumns
} from '@fortawesome/free-solid-svg-icons';
import './Contact.css';

export default function ContactContent({ isModal = false }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'General Inquiry',
    message: ''
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) return;

    setIsSubmitting(true);
    // Client-side confirmation
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
    }, 600);
  };

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className={`contact-content-wrapper ${isModal ? 'is-modal-view' : ''}`}>
      <motion.section
        className="contact-hero"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="contact-pre">GET IN TOUCH</div>
        <h1>
          Contact <span>AlgoFight Team</span>
        </h1>
        <p>
          Have a question about 1v1 arenas, institutional batches, bug reports, or partnership opportunities? Reach out to our core systems engineering team.
        </p>
      </motion.section>

      <div className="contact-layout-grid">
        {/* Info Column */}
        <div className="contact-info-panel">
          <div className="contact-card-box">
            <h3>
              <FontAwesomeIcon icon={faBuildingColumns} style={{ color: '#00e5ff' }} /> Direct Communication Channels
            </h3>
            <ul className="contact-details-list">
              <li className="contact-detail-row">
                <div className="contact-icon-bubble">
                  <FontAwesomeIcon icon={faEnvelope} />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Email Support</div>
                  <a href="mailto:supportalgofight@gmail.com" className="contact-link-value">
                    supportalgofight@gmail.com
                  </a>
                </div>
              </li>

              <li className="contact-detail-row">
                <div className="contact-icon-bubble">
                  <FontAwesomeIcon icon={faLocationDot} />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Headquarters</div>
                  <div style={{ color: '#e2e8f0', fontWeight: 500 }}>India</div>
                </div>
              </li>

              <li className="contact-detail-row">
                <div className="contact-icon-bubble">
                  <FontAwesomeIcon icon={faClock} />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Operational Hours</div>
                  <div style={{ color: '#e2e8f0', fontWeight: 500 }}>Mon - Fri, 10AM - 6PM IST</div>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Message Form Column */}
        <div className="contact-form-panel">
          <h3>Send Direct Message</h3>
          <p>Leave a note and an AlgoFight systems architect will get back to you within 24 hours.</p>

          {isSubmitted ? (
            <motion.div
              className="contact-success-state"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <FontAwesomeIcon icon={faCheckCircle} style={{ fontSize: '2.5rem', color: '#00e5ff' }} />
              <h4>Message Received</h4>
              <p>
                Thank you, <strong>{formData.name}</strong>! Your inquiry regarding "{formData.subject}" has been queued. We'll reply to <strong>{formData.email}</strong> shortly.
              </p>
              <button
                className="btn-contact-submit"
                style={{ margin: '0 auto' }}
                onClick={() => {
                  setIsSubmitted(false);
                  setFormData({ name: '', email: '', subject: 'General Inquiry', message: '' });
                }}
              >
                Send Another Message
              </button>
            </motion.div>
          ) : (
            <form className="contact-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Your Name</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Alex Turing"
                  className="form-control"
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Your Email Address</label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="e.g. alex@developer.dev"
                  className="form-control"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Inquiry Topic</label>
                <select
                  name="subject"
                  className="form-control"
                  value={formData.subject}
                  onChange={handleChange}
                >
                  <option value="General Inquiry">General Inquiry</option>
                  <option value="Bug Report / Platform Issue">Bug Report / Platform Issue</option>
                  <option value="Battle Arena & Rating Dispute">Battle Arena & Rating Dispute</option>
                  <option value="University / Institutional Tournament">University / Institutional Tournament</option>
                  <option value="Security / Anti-Cheat Disclosure">Security / Anti-Cheat Disclosure</option>
                </select>
              </div>

              <div className="form-group">
                <label>Message Content</label>
                <textarea
                  name="message"
                  required
                  rows={4}
                  placeholder="Describe your question or issue in detail..."
                  className="form-control"
                  value={formData.message}
                  onChange={handleChange}
                />
              </div>

              <button type="submit" className="btn-contact-submit" disabled={isSubmitting}>
                <FontAwesomeIcon icon={faPaperPlane} />
                {isSubmitting ? 'Transmitting...' : 'Send Message'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
