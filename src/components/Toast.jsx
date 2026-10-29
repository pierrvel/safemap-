import React, { useEffect } from 'react';

export default function Toast({ message, onClose, duration = 2800 }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [message, onClose, duration]);

  return (
    <div aria-live="polite" role="status">
      {message && <div className="sm-toast">{message}</div>}
    </div>
  );
}
