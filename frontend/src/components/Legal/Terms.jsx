import React from 'react';
import TermsContent from './TermsContent';
import './Legal.css';

export default function Terms() {
  return (
    <div className="legal-page">
      <TermsContent isModal={false} />
    </div>
  );
}
