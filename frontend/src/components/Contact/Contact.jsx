import React from 'react';
import ContactContent from './ContactContent';
import './Contact.css';

export default function Contact() {
  return (
    <div className="contact-page">
      <ContactContent isModal={false} />
    </div>
  );
}
