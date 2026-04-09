import './Button.css';

/**
 * variant: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'
 * size: 'sm' | 'md'
 */
export function Button({ children, variant = 'secondary', size = 'md', icon, loading, className = '', ...props }) {
  return (
    <button
      className={`btn btn-${variant} ${size === 'sm' ? 'btn-sm' : ''} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading
        ? <span className="btn-spinner" />
        : icon && <span className="btn-icon-slot">{icon}</span>
      }
      {children}
    </button>
  );
}
