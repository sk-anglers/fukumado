import { useState } from 'react';
import { LegalModal } from '../Legal/LegalModal';
import { trackButtonClick } from '../../utils/gtm';
import styles from './Footer.module.css';

export function Footer(): JSX.Element {
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalType, setLegalType] = useState<'terms' | 'privacy'>('terms');

  const handleOpenTerms = (): void => {
    // GTMトラッキング
    trackButtonClick('footer_open_terms');
    setLegalType('terms');
    setLegalModalOpen(true);
  };

  const handleOpenPrivacy = (): void => {
    // GTMトラッキング
    trackButtonClick('footer_open_privacy');
    setLegalType('privacy');
    setLegalModalOpen(true);
  };

  const handleCloseModal = (): void => {
    setLegalModalOpen(false);
  };

  return (
    <>
      <footer className={styles.footer}>
        <div className={styles.content}>
          <div className={styles.left}>
            <span className={styles.copyright}>© 2025 ふくまど！ All rights reserved.</span>
          </div>
          <div className={styles.links}>
            <button onClick={handleOpenTerms} className={styles.link}>
              利用規約
            </button>
            <span className={styles.separator}>|</span>
            <button onClick={handleOpenPrivacy} className={styles.link}>
              プライバシーポリシー
            </button>
          </div>
        </div>
      </footer>

      <LegalModal isOpen={legalModalOpen} onClose={handleCloseModal} type={legalType} />
    </>
  );
}
