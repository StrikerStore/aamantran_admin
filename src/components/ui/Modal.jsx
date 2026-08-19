import { useCallback, useEffect, useRef, useState } from 'react';
import './Modal.css';

const CLOSE_MS = 140; // must match .is-closing animation duration in Modal.css

/** Elements that can hold focus inside the dialog. */
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ title, children, footer, onClose, size = 'md' }) {
  const dialogRef = useRef(null);
  const restoreFocusRef = useRef(null);
  const [closing, setClosing] = useState(false);

  // Play the exit animation, then hand control back to the parent.
  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => onClose?.(), CLOSE_MS);
  }, [closing, onClose]);

  // Lock body scroll while open. Without this the page scrolled behind the
  // dialog. The scrollbar is replaced with equivalent padding so the layout
  // underneath does not shift sideways as it disappears.
  useEffect(() => {
    const { body } = document;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
    };
  }, []);

  // Move focus in on open and return it to the trigger on close.
  useEffect(() => {
    restoreFocusRef.current = document.activeElement;
    const node = dialogRef.current;
    const first = node?.querySelector(FOCUSABLE);
    (first || node)?.focus?.();
    return () => {
      const target = restoreFocusRef.current;
      if (target && typeof target.focus === 'function') target.focus();
    };
  }, []);

  // Escape closes; Tab cycles within the dialog instead of escaping to the page.
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        requestClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const nodes = Array.from(dialogRef.current?.querySelectorAll(FOCUSABLE) || [])
        .filter((el) => el.offsetParent !== null);
      if (nodes.length === 0) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [requestClose]);

  return (
    <div
      className={`modal-backdrop${closing ? ' is-closing' : ''}`}
      onClick={(e) => { if (e.target === e.currentTarget) requestClose(); }}
    >
      <div
        className={`modal modal-${size}`}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
      >
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={requestClose} aria-label="Close dialog">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmModal({ title, message, icon = '⚠️', confirmText = 'Confirm', confirmVariant = 'danger', onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel} footer={
      <>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button className={`btn btn-${confirmVariant}`} onClick={onConfirm}>{confirmText}</button>
      </>
    }>
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '12px' }} aria-hidden="true">{icon}</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>{message}</p>
      </div>
    </Modal>
  );
}
