import {
  BellAlertIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
  SpeakerXMarkIcon,
  SpeakerWaveIcon,
  UserCircleIcon
} from '@heroicons/react/24/outline';
import { useLayoutStore } from '../../stores/layoutStore';
import styles from './Header.module.css';

interface HeaderProps {
  onOpenPresetModal: () => void;
}

export const Header = ({ onOpenPresetModal }: HeaderProps): JSX.Element => {
  const mutedAll = useLayoutStore((state) => state.mutedAll);
  const toggleMuteAll = useLayoutStore((state) => state.toggleMuteAll);

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <div className={styles.logo}>ふ</div>
        <div className={styles.meta}>
          <h1 className={styles.title}>ふくまど！</h1>
          <span className={styles.subtitle}>お気に入りの配信を一度にチェック</span>
        </div>
      </div>
      <div className={styles.actions}>
        <label className={styles.search}>
          <MagnifyingGlassIcon className={styles.searchIcon} />
          <input type="search" placeholder="配信者・タイトルを検索" />
        </label>
        <button
          className={styles.controlButton}
          type="button"
          onClick={toggleMuteAll}
          aria-pressed={mutedAll}
        >
          {mutedAll ? <SpeakerXMarkIcon /> : <SpeakerWaveIcon />}
          <span>{mutedAll ? '全体ミュート解除' : '全体ミュート'}</span>
        </button>
        <button className={styles.controlButton} type='button' onClick={onOpenPresetModal}>
          <Squares2X2Icon />
          <span>レイアウト</span>
        </button>
        <button className={styles.iconButton} type="button" title="通知センター">
          <BellAlertIcon />
        </button>
        <button className={styles.accountButton} type="button">
          <UserCircleIcon />
          <span>ゲスト</span>
        </button>
      </div>
    </header>
  );
};
