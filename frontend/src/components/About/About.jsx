import React, { useEffect } from 'react';
import AboutContent from './AboutContent';
import BackgroundPaths from '../BackgroundPaths/BackgroundPaths';
import '../BackgroundPaths/BackgroundPaths.css';
import Footer from '../Common/Footer/Footer';
import './About.css';

function About() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "About AlgoFight | Real-Time Competitive Coding Arena & Engineering Team";
    return () => {
      document.title = prevTitle;
    };
  }, []);

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