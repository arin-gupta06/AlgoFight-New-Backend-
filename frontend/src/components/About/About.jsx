import React from 'react';
import AboutContent from './AboutContent';
import './About.css';

function About() {
  return (
    <div className="learn-page">
      <AboutContent isModal={false} />
    </div>
  );
}

export default About;