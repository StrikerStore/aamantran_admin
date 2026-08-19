import { createContext, useContext, useState, useCallback } from 'react';
import './Toast.css';

const ToastContext = createContext(null);

let _id = 0;

const EXIT_MS = 200; // must match .toast.is-leaving in Toast.css

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = ++_id;
    setToasts(t => [...t, { id, message, type, leaving: false }]);
    // Two-phase dismissal: mark it leaving so the exit animation can play,
    // then unmount. Previously toasts animated in and then vanished abruptly.
    setTimeout(() => {
      setToasts(t => t.map(x => (x.id === id ? { ...x, leaving: true } : x)));
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), EXIT_MS);
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="toast-container" role="status" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}${t.leaving ? ' is-leaving' : ''}`}>
            <span className="toast-icon" aria-hidden="true">
              {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : t.type === 'warning' ? '⚠' : 'ℹ'}
            </span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
