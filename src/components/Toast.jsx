import React, { useEffect } from 'react';

export default function Toast({ message, onClose, duration = 2500 }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, onClose, duration]);

  if (!message) return null;

  return (
    <div className="status-toast show">
      <span>{message}</span>
    </div>
  );
}
