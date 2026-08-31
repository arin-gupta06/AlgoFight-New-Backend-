import React from 'react';
import BlogContent from './BlogContent';
import './Blog.css';

export default function Blog() {
  return (
    <div className="blog-page">
      <BlogContent isModal={false} />
    </div>
  );
}
