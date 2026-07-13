import React from 'react';

/**
 * Simple CSS loading spinner (three pulsing dots)
 * No external dependencies – works under strict tracking prevention.
 */
export default function LoadingDots() {
  return (
    <>
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.3; }
          50% { opacity: 1; }
          100% { opacity: 0.3; }
        }
        .loading-dots {
          display: flex;
          gap: 6px;
        }
        .loading-dots span {
          width: 8px;
          height: 8px;
          background: #58a6ff;
          border-radius: 50%;
          animation: pulse 1s infinite ease-in-out;
        }
        .loading-dots span:nth-child(2) { animation-delay: 0.2s; }
        .loading-dots span:nth-child(3) { animation-delay: 0.4s; }
      `}</style>
      <div className="loading-dots" title="Loading...">
        <span />
        <span />
        <span />
      </div>
    </>
  );
}

