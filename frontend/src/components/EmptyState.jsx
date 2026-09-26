import React from 'react';
import { PackageOpen } from 'lucide-react';

export default function EmptyState({
  icon: Icon = PackageOpen,
  title = 'No items found',
  description = 'There is currently no data to display here.',
  actionLabel,
  onAction
}) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px dashed var(--border-color)',
      borderRadius: '16px',
      padding: '2.5rem 1.5rem',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.75rem',
      margin: '1rem 0'
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: 'var(--bg-card-hover)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)'
      }}>
        <Icon size={24} />
      </div>
      <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
        {title}
      </h4>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '360px', margin: 0 }}>
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="btn-primary"
          style={{ marginTop: '0.5rem', padding: '8px 18px', fontSize: '0.85rem' }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
