import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFileLines,
  faFilePdf,
  faDownload,
  faArrowUpRightFromSquare,
  faEye,
} from '@fortawesome/free-solid-svg-icons';
import { generatePdfThumbnail } from '../../../utils/pdfThumbnail';
import './WhatsAppDocumentPreview.css';

/**
 * Determine file extension and type styling
 */
function getDocumentInfo(name = '', url = '') {
  const target = (name || url).toLowerCase();
  if (target.includes('.pdf') || url.startsWith('data:application/pdf')) {
    return { ext: 'PDF', color: '#ff3b30', bg: 'rgba(255, 59, 48, 0.15)', border: 'rgba(255, 59, 48, 0.35)', isPdf: true };
  }
  if (target.includes('.doc') || target.includes('.docx')) {
    return { ext: 'DOC', color: '#2b7fff', bg: 'rgba(43, 127, 255, 0.15)', border: 'rgba(43, 127, 255, 0.35)', isPdf: false };
  }
  if (target.includes('.xls') || target.includes('.xlsx') || target.includes('.csv')) {
    return { ext: 'XLS', color: '#34c759', bg: 'rgba(52, 199, 89, 0.15)', border: 'rgba(52, 199, 89, 0.35)', isPdf: false };
  }
  if (target.includes('.ppt') || target.includes('.pptx')) {
    return { ext: 'PPT', color: '#ff9500', bg: 'rgba(255, 149, 0, 0.15)', border: 'rgba(255, 149, 0, 0.35)', isPdf: false };
  }
  if (target.includes('.txt') || target.includes('.md')) {
    return { ext: 'TXT', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.35)', isPdf: false };
  }
  return { ext: 'FILE', color: '#00e5ff', bg: 'rgba(0, 229, 255, 0.15)', border: 'rgba(0, 229, 255, 0.35)', isPdf: false };
}

function formatFileSize(bytes) {
  if (!bytes || isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function WhatsAppDocumentPreview({ content, isPreview = false }) {
  if (!content || !content.url) return null;

  const docInfo = getDocumentInfo(content.name, content.url);
  const [thumb, setThumb] = useState(content.thumbnailUrl || null);
  const [pageCount, setPageCount] = useState(content.pageCount || content.numPages || null);
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Sync if prop changes
  useEffect(() => {
    if (content.thumbnailUrl) {
      setThumb(content.thumbnailUrl);
    }
    if (content.pageCount || content.numPages) {
      setPageCount(content.pageCount || content.numPages);
    }
  }, [content.thumbnailUrl, content.pageCount, content.numPages]);

  // If it's a PDF and no thumbnail was pre-generated, attempt on-the-fly rendering
  useEffect(() => {
    if (thumb || !docInfo.isPdf || !content.url) return;

    let isMounted = true;
    setLoading(true);

    generatePdfThumbnail(content.url, 640)
      .then((res) => {
        if (!isMounted) return;
        if (res && res.thumbnailUrl) {
          setThumb(res.thumbnailUrl);
          if (res.pageCount) setPageCount(res.pageCount);
        } else {
          setHasError(true);
        }
      })
      .catch(() => {
        if (isMounted) setHasError(true);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [content.url, docInfo.isPdf, thumb]);

  const docName = content.name || (content.url.startsWith('data:') ? `Document.${docInfo.ext.toLowerCase()}` : 'Attached Document');
  const sizeText = formatFileSize(content.size);

  const handleClick = (e) => {
    e.stopPropagation();
    if (isPreview) return;

    if (content.url.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = content.url;
      link.download = docName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      window.open(content.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      className={`whatsapp-doc-card ${isPreview ? 'is-preview-mode' : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      title={`Click to view or download ${docName}`}
    >
      {/* 1. Page 1 First-Page Thumbnail Viewport (WhatsApp Style) */}
      <div className="whatsapp-doc-viewport">
        {thumb ? (
          <div className="whatsapp-page-wrapper">
            <img
              src={thumb}
              alt={docName}
              className="whatsapp-page-img"
              loading="lazy"
            />
            {pageCount && (
              <div className="whatsapp-page-pill">
                <span>1 / {pageCount}</span>
              </div>
            )}
            <div className="whatsapp-page-overlay">
              <div className="whatsapp-open-chip">
                <FontAwesomeIcon icon={faEye} />
                <span>Tap to view document</span>
              </div>
            </div>
          </div>
        ) : loading ? (
          <div className="whatsapp-page-skeleton">
            <div className="whatsapp-shimmer-paper">
              <div className="skeleton-bar title-bar" />
              <div className="skeleton-bar line-bar" />
              <div className="skeleton-bar line-bar short" />
              <div className="skeleton-spinner">
                <FontAwesomeIcon icon={faFilePdf} className="pulse-pdf-icon" />
                <span>Rendering Page 1 Preview...</span>
              </div>
            </div>
          </div>
        ) : (
          /* Elegant Document Cover Fallback (e.g. DOCX, TXT, or if PDF cannot render directly) */
          <div className="whatsapp-cover-fallback">
            <div className="cover-sheet" style={{ borderColor: docInfo.border }}>
              <div className="cover-badge-corner" style={{ background: docInfo.color }}>
                {docInfo.ext}
              </div>
              <div className="cover-sheet-body">
                <FontAwesomeIcon icon={docInfo.isPdf ? faFilePdf : faFileLines} className="cover-sheet-icon" style={{ color: docInfo.color }} />
                <div className="cover-sheet-lines">
                  <div className="sheet-line line-1" />
                  <div className="sheet-line line-2" />
                  <div className="sheet-line line-3" />
                </div>
              </div>
              {pageCount && (
                <div className="cover-page-badge">
                  {pageCount} Page{pageCount > 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. Bottom Document Info & Metadata Bar (WhatsApp Style) */}
      <div className="whatsapp-doc-footer">
        <div className="doc-type-icon-box" style={{ background: docInfo.bg, borderColor: docInfo.border, color: docInfo.color }}>
          <FontAwesomeIcon icon={docInfo.isPdf ? faFilePdf : faFileLines} />
        </div>

        <div className="doc-text-meta">
          <div className="doc-primary-title" title={docName}>
            {docName}
          </div>
          <div className="doc-secondary-meta">
            {pageCount ? (
              <span className="meta-pages">{pageCount} page{pageCount > 1 ? 's' : ''}</span>
            ) : null}
            {pageCount && sizeText ? <span className="meta-dot">•</span> : null}
            {sizeText ? <span className="meta-size">{sizeText}</span> : null}
            {(pageCount || sizeText) ? <span className="meta-dot">•</span> : null}
            <span className="meta-ext" style={{ color: docInfo.color }}>{docInfo.ext}</span>
          </div>
        </div>

        <div className="doc-action-bubble" title="Open or Download Document">
          <FontAwesomeIcon icon={content.url.startsWith('data:') ? faDownload : faArrowUpRightFromSquare} />
        </div>
      </div>
    </div>
  );
}
