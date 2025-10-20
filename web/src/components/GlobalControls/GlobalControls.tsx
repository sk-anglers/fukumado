import {
  AdjustmentsHorizontalIcon,
  CircleStackIcon,
  Squares2X2Icon
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useLayoutStore } from '../../stores/layoutStore';
import type { LayoutPreset } from '../../types';
import styles from './GlobalControls.module.css';

interface GlobalControlsProps {
  onOpenPresetModal: () => void;
}

const presetLabels: Record<LayoutPreset, string> = {
  twoByTwo: '2×2',
  oneByTwo: '1×2 + サブ',
  focus: 'フォーカス'
};

const displayCountLabels: Record<number, string> = {
  4: '4画面',
  3: '3画面',
  2: '2画面',
  1: '1画面'
};

export const GlobalControls = ({ onOpenPresetModal }: GlobalControlsProps): JSX.Element => {
  const { preset, setPreset, activeSlotsCount, setActiveSlotsCount } = useLayoutStore((state) => ({
    preset: state.preset,
    setPreset: state.setPreset,
    activeSlotsCount: state.activeSlotsCount,
    setActiveSlotsCount: state.setActiveSlotsCount
  }));

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Squares2X2Icon />
          <span>レイアウト</span>
        </div>
        <div className={styles.buttons}>
          {(Object.keys(presetLabels) as LayoutPreset[]).map((key) => (
            <button
              key={key}
              type="button"
              className={clsx(styles.presetButton, preset === key && styles.presetButtonActive)}
              onClick={() => setPreset(key)}
            >
              {presetLabels[key]}
            </button>
          ))}
        </div>
        <button type="button" className={styles.primaryAction} onClick={onOpenPresetModal}>
          プリセットを編集
        </button>
        <div className={styles.divider} />
        <div className={styles.subHeader}>表示する枠の数</div>
        <div className={styles.displayButtons}>
          {[4, 3, 2, 1].map((count) => (
            <button
              key={count}
              type="button"
              className={clsx(
                styles.countButton,
                activeSlotsCount === count && styles.countButtonActive
              )}
              onClick={() => setActiveSlotsCount(count)}
            >
              {displayCountLabels[count]}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.header}>
          <AdjustmentsHorizontalIcon />
          <span>同期コントロール</span>
        </div>
        <div className={styles.description}>
          同期と通知の細かな設定は後続フェーズで実装予定です。
        </div>
        <button type="button" className={styles.secondaryAction} disabled>
          開発予定
        </button>
      </div>
      <div className={styles.card}>
        <div className={styles.header}>
          <CircleStackIcon />
          <span>データ使用量</span>
        </div>
        <div className={styles.description}>
          自動画質調整と配信枠ごとの帯域表示をここに表示します。
        </div>
        <button type="button" className={styles.secondaryAction} disabled>
          開発予定
        </button>
      </div>
    </div>
  );
};
