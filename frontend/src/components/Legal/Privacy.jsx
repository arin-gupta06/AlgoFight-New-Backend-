import React from 'react';
import PrivacyContent from './PrivacyContent';
import './Legal.css';

export default function Privacy() {
  return (
    <div className="legal-page">
      <PrivacyContent isModal={false} />
    </div>
  );
}
