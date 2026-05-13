import React from "react";
import { glossary } from "../data/glossary";

interface GlossaryModalProps {
  open: boolean;
  onClose: () => void;
}

const GlossaryModal: React.FC<GlossaryModalProps> = ({ open, onClose }) => {
  if (!open) return null;
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <header>
          <h3>Glossary</h3>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="modal-body">
          {glossary.map((item) => (
            <div key={item.term} className="glossary-item">
              <strong>{item.term}</strong>
              <p>{item.meaning}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GlossaryModal;
