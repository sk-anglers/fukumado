import { useMaintenanceStore } from '../../stores/maintenanceStore';
import './MaintenancePage.css';

export const MaintenancePage = (): JSX.Element => {
  const { message, enabledAt, scheduledEndAt, duration } = useMaintenanceStore();

  return (
    <div className="maintenance-page">
      <div className="maintenance-container">
        <div className="maintenance-icon">🔧</div>

        <h1 className="maintenance-title">メンテナンス中</h1>

        <div className="maintenance-message">
          {message || 'サービスは現在メンテナンス中です。しばらくお待ちください。'}
        </div>

        <div className="maintenance-info">
          {enabledAt && (
            <div className="info-item">
              <span className="info-label">開始時刻:</span>
              <span className="info-value">
                {new Date(enabledAt).toLocaleString('ja-JP', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          )}

          {duration !== undefined && (
            <div className="info-item">
              <span className="info-label">予定時間:</span>
              <span className="info-value">
                {duration === 0 ? '無期限' : `${duration}分`}
              </span>
            </div>
          )}

          {scheduledEndAt && (
            <div className="info-item">
              <span className="info-label">終了予定:</span>
              <span className="info-value">
                {new Date(scheduledEndAt).toLocaleString('ja-JP', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          )}
        </div>

        <div className="maintenance-footer">
          <p>ご不便をおかけして申し訳ございません。</p>
          <p>メンテナンス完了後、自動的にサービスが再開されます。</p>
        </div>
      </div>
    </div>
  );
};
