import './Pagination.css';

export function Pagination({ total, page, limit, onPageChange }) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;

  const start = (page - 1) * limit + 1;
  const end   = Math.min(page * limit, total);

  // Build page numbers with ellipsis
  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 || i === totalPages ||
      Math.abs(i - page) <= 1
    ) {
      pages.push(i);
    } else if (
      (i === 2 && page > 4) ||
      (i === totalPages - 1 && page < totalPages - 3)
    ) {
      pages.push('…');
    }
  }

  return (
    <div className="pagination">
      <span className="pagination-info">
        Showing {total === 0 ? 0 : start}–{end} of {total}
      </span>
      <div className="pagination-controls">
        <button
          className="page-btn"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >‹</button>

        {pages.map((p, i) =>
          p === '…'
            ? <span key={`e${i}`} className="page-ellipsis">…</span>
            : <button
                key={p}
                className={`page-btn ${p === page ? 'active' : ''}`}
                onClick={() => onPageChange(p)}
              >{p}</button>
        )}

        <button
          className="page-btn"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >›</button>
      </div>
    </div>
  );
}
