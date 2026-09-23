import React from 'react';

interface HistoryPlaceholderProps {
  onSelectExample?: () => void;
}

export const HistoryPlaceholder: React.FC<HistoryPlaceholderProps> = ({ onSelectExample }) => {
  return (
    <div className="history-section">
      <div className="section-label-row">
        <span className="history-header">History</span>
      </div>

      <div className="history-card">
        <div className="history-item-left">
          <span>x² + y² = 4</span>
          <span>z = x + y</span>
        </div>
        <div className="history-item-right">
          <button
            type="button"
            className="header-btn"
            style={{ padding: '3px 8px', fontSize: '0.72rem' }}
            onClick={onSelectExample}
            title="Load reference example"
          >
            Load Example
          </button>
        </div>
      </div>
      <p className="provisional-note">
        IndexedDB persistence and session restore scheduled for V10.
      </p>
    </div>
  );
};
