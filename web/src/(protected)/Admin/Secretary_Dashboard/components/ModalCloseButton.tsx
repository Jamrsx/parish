import React from 'react';
import { X } from 'lucide-react';

interface ModalCloseButtonProps {
  onClick: () => void;
  className?: string;
}

const ModalCloseButton: React.FC<ModalCloseButtonProps> = ({ onClick, className = '' }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      className={`rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 ${className}`}
    >
      <X size={20} />
    </button>
  );
};

export default ModalCloseButton;
