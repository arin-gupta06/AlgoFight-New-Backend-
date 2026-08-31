import React from 'react';
import CareersContent from './CareersContent';
import './Careers.css';

export default function Careers() {
  return (
    <div className="careers-page">
      <CareersContent isModal={false} />
    </div>
  );
}
