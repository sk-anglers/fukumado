import clsx from 'clsx';
import { useLayoutStore } from '../../stores/layoutStore';
import type { LayoutPreset } from '../../types';
import styles from './LayoutPresetModal.module.css';

interface LayoutPresetModalProps {
  open: boolean;
  onClose: () => void;
}

const presetDetails: Record<
  LayoutPreset,
  {
    label: string;
    description: string;
    layout: number[];
  }
> = {
  twoByTwo: {
    label: '2 × 2 グリッド',
    description: '均等に4枠を配置する定番レイアウト',
    layout: [1, 1, 1, 1]
  },
  oneByTwo: {
    label: '1 × 2 + サブ',
    description: 'メイン配信を大きく、サブ枠で補助視聴',
    layout: [2, 1, 1]
  },
  focus: {
    label: 'フォーカス + サブ',
    description: '一つの枠を全面表示しながらサブ枠を一覧',
    layout: [4, 1, 1, 1]
  }
};

export const LayoutPresetModal = ({ open, onClose }: LayoutPresetModalProps): JSX.Element | null => {
  const { preset, setPreset } = useLayoutStore((state) => ({
    preset: state.preset,
    setPreset: state.setPreset
  }));

  if (!open) {
    return null;
  }

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="layout-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <h2 id="layout-modal-title">レイアウトプリセット</h2>
            <p>よく使うレイアウトを選択して該当プリセットを適用します。</p>
          </div>
          <button className={styles.closeButton} type="button" onClick={onClose}>
            閉じる
          </button>
        </header>
        <div className={styles.grid}>
          {(Object.keys(presetDetails) as LayoutPreset[]).map((key) => {
            const detail = presetDetails[key];
            return (
              <button
                key={key}
                type="button"
                className={clsx(styles.card, preset === key && styles.cardActive)}
                onClick={() => {
                  setPreset(key);
                  onClose();
                }}
              >
                <div className={styles.cardPreview}>
                  {detail.layout.map((span, index) => (
                    <div key={index} className={styles.previewCell} style={{ flex: span }} />
                  ))}
                </div>
                <div className={styles.cardBody}>
                  <h3>{detail.label}</h3>
                  <p>{detail.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
