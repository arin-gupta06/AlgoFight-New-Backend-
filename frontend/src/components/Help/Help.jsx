import React from 'react';
import { useNavigate } from 'react-router-dom';
import HelpContent from './HelpContent';
import './Help.css';

export default function Help() {
  const navigate = useNavigate();

  return (
    <div className="help-page">
      <HelpContent isModal={false} onSelectTab={() => navigate('/contact')} />
    </div>
  );
}
