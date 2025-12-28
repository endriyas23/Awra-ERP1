
import React from 'react';
import { AppNotification } from '../types';

interface ToastProps {
  notification: AppNotification;
  onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ notification, onClose }) => {
  const getStyles = () => {
    switch (notification.type) {
      case 'SUCCESS':
        return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', icon: '✅', iconBg: 'bg-emerald-100' };
      case 'ERROR':
        return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', icon: '⚠️', iconBg: 'bg-red-100' };
      case 'WARNING':
        return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', icon: '🔔', iconBg: 'bg-amber-100' };
      case 'INFO':
      default:
        return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', icon: 'ℹ️', iconBg: 'bg-blue-100' };
    }
  };

  const styles = getStyles();

  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg transition-all animate-in slide-in-from-right-10 duration-300 w-80 bg-white ${styles.border}`}>
      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${styles.iconBg}`}>
        <span className="text-sm">{styles.icon}</span>
      </div>
      <div className="flex-1">
        <h4 className={`text-sm font-bold ${styles.text}`}>{notification.message}</h4>
        {notification.details && <p className="text-xs text-slate-500 mt-1">{notification.details}</p>}
      </div>
      <button 
        onClick={() => onClose(notification.id)}
        className="text-slate-400 hover:text-slate-600 transition-colors"
      >
        ✕
      </button>
    </div>
  );
};

export default Toast;
