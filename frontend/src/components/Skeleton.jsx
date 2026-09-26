import React from 'react';

export function SkeletonBanner() {
  return (
    <div
      className="skeleton-shimmer"
      style={{
        width: '100%',
        height: '110px',
        borderRadius: '20px',
        marginBottom: '1.5rem'
      }}
    />
  );
}

export function SkeletonStatGrid({ count = 4 }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '1rem',
      marginBottom: '1.5rem'
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="skeleton-shimmer"
          style={{
            height: '100px',
            borderRadius: '16px',
            border: '1px solid var(--border-color)'
          }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ height = '200px' }) {
  return (
    <div
      className="skeleton-shimmer"
      style={{
        width: '100%',
        height,
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        marginBottom: '1.25rem'
      }}
    />
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: '16px',
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.85rem'
    }}>
      <div className="skeleton-shimmer" style={{ width: '40%', height: '24px', borderRadius: '6px' }} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-shimmer" style={{ width: '100%', height: '42px', borderRadius: '8px' }} />
      ))}
    </div>
  );
}
