import React from 'react';
import AboutContent from './AboutContent';
import BackgroundPaths from '../BackgroundPaths/BackgroundPaths';
import '../BackgroundPaths/BackgroundPaths.css';
import Footer from '../Common/Footer/Footer';
import './About.css';

function About() {
  return (
    <BackgroundPaths>
      <div className="learn-page">
        <AboutContent isModal={false} />
      </div>
      <Footer />
    </BackgroundPaths>
  );
}

export default About;