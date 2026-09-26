import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'info', duration = 3500) => {
    if (!message) return;
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    setToasts((prev) => [...prev, { id, message, type, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      {/* Floating Toast Notification Container */}
      <div style={{
        position: 'fixed',
        top: '1.25rem',
        right: '1.25rem',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
        maxWidth: '420px',
        width: 'calc(100vw - 2.5rem)',
        pointerEvents: 'none'
      }}>
        {toasts.map((toast) => {
          let bg = 'var(--bg-card, #1E293B)';
          let borderColor = 'var(--border-color, #334155)';
          let textColor = 'var(--text-main, #F8FAFC)';
          let icon = <Info size={20} color="#3B82F6" />;

          if (toast.type === 'success') {
            borderColor = '#10B981';
            icon = <CheckCircle2 size={20} color="#10B981" />;
          } else if (toast.type === 'error') {
            borderColor = '#EF4444';
            icon = <AlertCircle size={20} color="#EF4444" />;
          } else if (toast.type === 'warning') {
            borderColor = '#F59E0B';
            icon = <AlertTriangle size={20} color="#F59E0B" />;
          }

          return (
            <div
              key={toast.id}
              style={{
                pointerEvents: 'auto',
                background: bg,
                border: `1px solid ${borderColor}`,
                borderRadius: '12px',
                padding: '0.85rem 1rem',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                color: textColor,
                fontSize: '0.9rem',
                fontWeight: 500,
                backdropFilter: 'blur(12px)',
                animation: 'slideInToast 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: 0 }}>
                <span style={{ flexShrink: 0 }}>{icon}</span>
                <span style={{ wordBreak: 'break-word', lineHeight: 1.4 }}>{toast.message}</span>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted, #94A3B8)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  flexShrink: 0
                }}
                aria-label="Close notification"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
