import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange
}) {
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers with window
  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - 1 && i <= currentPage + 1)
    ) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '0.75rem',
      marginTop: '1.25rem',
      paddingTop: '0.75rem',
      borderTop: '1px solid var(--border-color)',
      fontSize: '0.85rem',
      color: 'var(--text-muted)'
    }}>
      <div>
        Showing <strong style={{ color: 'var(--text-main)' }}>{startItem}–{endItem}</strong> of <strong style={{ color: 'var(--text-main)' }}>{totalItems}</strong> entries
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="btn-secondary"
          style={{
            padding: '6px 10px',
            fontSize: '0.8rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} /> Prev
        </button>

        {pages.map((p, idx) => {
          if (p === '...') {
            return (
              <span key={`dots_${idx}`} style={{ padding: '0 4px', color: 'var(--text-muted)' }}>
                ...
              </span>
            );
          }
          const isActive = p === currentPage;
          return (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.85rem',
                background: isActive ? 'var(--accent-emerald)' : 'var(--bg-card)',
                color: isActive ? '#FFFFFF' : 'var(--text-main)',
                border: `1px solid ${isActive ? 'var(--accent-emerald)' : 'var(--border-color)'}`,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {p}
            </button>
          );
        })}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="btn-secondary"
          style={{
            padding: '6px 10px',
            fontSize: '0.8rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}
          aria-label="Next page"
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
