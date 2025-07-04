import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// Props interface for the GV_ConfirmationModal component
interface GV_ConfirmationModalProps {
  isOpen: boolean;
  modalTitle?: string; // Optional title for the modal, defaults to "Confirmation"
  message: string;
  onConfirm: () => void;
  onCancel?: () => void; // Optional cancel action
  confirmButtonText?: string; // Optional text for confirm button, defaults to "Confirm"
  cancelButtonText?: string; // Optional text for cancel button, defaults to "Cancel"
}

const GV_ConfirmationModal: React.FC<GV_ConfirmationModalProps> = ({
  isOpen,
  modalTitle = 'Confirmation',
  message,
  onConfirm,
  onCancel,
  confirmButtonText = 'Confirm',
  cancelButtonText = 'Cancel',
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close modal on Escape key press
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleCancelClick();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Focus on the modal or a primary button when it opens for accessibility
      modalRef.current?.focus(); 
      return () => {
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, onCancel]); // Include onCancel in dependencies to avoid stale closures

  // Handle click outside the modal content
  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
      handleCancelClick();
    }
  };

  const handleConfirmClick = () => {
    onConfirm();
  };

  const handleCancelClick = () => {
    if (onCancel) {
      onCancel();
    }
    // No explicit state change here, as the parent component handling `isOpen`
    // will be responsible for closing the modal after `onConfirm` or `onCancel`
    // are called and return from App.tsx's `showConfirmation` function.
  };

  if (!isOpen) {
    return null;
  }

  // Use React Portal to render modal outside of the main DOM tree, for better z-index management
  return createPortal(
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900 bg-opacity-70 transition-opacity duration-300 ease-in-out"
        onClick={handleOverlayClick}
        // role="dialog"
        // aria-modal="true"
        // aria-labelledby="confirmation-modal-title"
        // aria-describedby="confirmation-modal-message"
      >
        {/* Modal Content */}
        <div
          ref={modalRef}
          className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm transform transition-all duration-300 ease-in-out scale-100 opacity-100
                     md:p-8 relative" // Added relative for potential future absolute positioning of close button if needed.
          onClick={(e) => e.stopPropagation()} // Prevent clicks inside modal from closing it
          tabIndex={-1} // Make div focusable
        >
          <h2 id="confirmation-modal-title" className="text-xl font-semibold text-gray-900 mb-4 text-center">
            {modalTitle}
          </h2>
          <p id="confirmation-modal-message" className="text-gray-700 mb-6 text-center">
            {message}
          </p>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-75 transition-colors duration-200"
              onClick={handleCancelClick}
              aria-label={cancelButtonText}
            >
              {cancelButtonText}
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75 transition-colors duration-200"
              onClick={handleConfirmClick}
              aria-label={confirmButtonText}
            >
              {confirmButtonText}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body // Append the modal to the body
  );
};

export default GV_ConfirmationModal;