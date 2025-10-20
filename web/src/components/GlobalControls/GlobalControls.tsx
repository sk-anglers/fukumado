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

export const GlobalControls = ({ onOpenPresetModal }: GlobalControlsProps): JSX.Element => {
  const { preset, setPreset } = useLayoutStore((state) => ({
    preset: state.preset,
    setPreset: state.setPreset
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
