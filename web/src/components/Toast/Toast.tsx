import { useEffect } from 'react';
import styles from './Toast.module.css';

export interface ToastData {
  id: string;
  message: string;
  thumbnailUrl?: string;
}

interface ToastProps {
  toast: ToastData;
  onClose: (id: string) => void;
}

export const Toast = ({ toast, onClose }: ToastProps): JSX.Element => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, 5000); // 5秒後に自動的に閉じる

    return () => clearTimeout(timer);
  }, [toast.id, onClose]);

  return (
    <div className={styles.toast}>
      {toast.thumbnailUrl && (
        <img
          src={toast.thumbnailUrl}
          alt=""
          className={styles.thumbnail}
          loading="lazy"
        />
      )}
      <div className={styles.content}>
        <p className={styles.message}>{toast.message}</p>
      </div>
      <button
        type="button"
        className={styles.closeButton}
        onClick={() => onClose(toast.id)}
        aria-label="閉じる"
      >
        ×
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: ToastData[];
  onClose: (id: string) => void;
}

export const ToastContainer = ({ toasts, onClose }: ToastContainerProps): JSX.Element => {
  return (
    <div className={styles.toastContainer}>
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
};
