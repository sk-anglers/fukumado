import { XMarkIcon } from '@heroicons/react/24/outline';
import { TermsOfService } from './TermsOfService';
import { PrivacyPolicy } from './PrivacyPolicy';
import styles from './LegalModal.module.css';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'terms' | 'privacy';
}

export function LegalModal({ isOpen, onClose, type }: LegalModalProps): JSX.Element | null {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>{type === 'terms' ? '利用規約' : 'プライバシーポリシー'}</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="閉じる">
            <XMarkIcon />
          </button>
        </div>
        <div className={styles.content}>
          {type === 'terms' ? <TermsOfService /> : <PrivacyPolicy />}
        </div>
      </div>
    </div>
  );
}
