import { BellAlertIcon, CheckIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useNotificationStore } from '../../stores/notificationStore';
import styles from './NotificationMenu.module.css';

interface NotificationMenuProps {
  onClose: () => void;
}

export const NotificationMenu = ({ onClose }: NotificationMenuProps): JSX.Element => {
  const notifications = useNotificationStore((state) => state.notifications);
  const settings = useNotificationStore((state) => state.settings);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
  const clearAll = useNotificationStore((state) => state.clearAll);
  const updateSettings = useNotificationStore((state) => state.updateSettings);

  return (
    <div className={styles.menu}>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <BellAlertIcon />
          <h3 className={styles.sectionTitle}>通知センター</h3>
        </div>

        {/* 通知設定 */}
        <div className={styles.notificationSettings}>
          <label className={styles.settingItem}>
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => updateSettings({ enabled: e.target.checked })}
            />
            <span>通知を有効にする</span>
          </label>
          <label className={styles.settingItem}>
            <input
              type="checkbox"
              checked={settings.youtube}
              onChange={(e) => updateSettings({ youtube: e.target.checked })}
              disabled={!settings.enabled}
            />
            <span>YouTube配信開始通知</span>
          </label>
          <label className={styles.settingItem}>
            <input
              type="checkbox"
              checked={settings.twitch}
              onChange={(e) => updateSettings({ twitch: e.target.checked })}
              disabled={!settings.enabled}
            />
            <span>Twitch配信開始通知</span>
          </label>
          <label className={styles.settingItem}>
            <input
              type="checkbox"
              checked={settings.sound}
              onChange={(e) => updateSettings({ sound: e.target.checked })}
              disabled={!settings.enabled}
            />
            <span>通知音を再生</span>
          </label>
        </div>

        {/* 通知履歴 */}
        <div className={styles.notificationHistory}>
          <div className={styles.notificationHistoryHeader}>
            <span>通知履歴 ({notifications.filter(n => !n.read).length}件未読)</span>
            <div className={styles.notificationActions}>
              <button type="button" onClick={markAllAsRead} disabled={notifications.length === 0}>
                <CheckIcon />
                全て既読
              </button>
              <button type="button" onClick={clearAll} disabled={notifications.length === 0}>
                <TrashIcon />
                クリア
              </button>
            </div>
          </div>
          <div className={styles.notificationList}>
            {notifications.length === 0 ? (
              <div className={styles.notificationEmpty}>通知はありません</div>
            ) : (
              notifications.slice(0, 10).map((notification) => (
                <div
                  key={notification.id}
                  className={`${styles.notificationItem} ${!notification.read ? styles.notificationItemUnread : ''}`}
                  onClick={() => markAsRead(notification.id)}
                >
                  {notification.thumbnailUrl && (
                    <img src={notification.thumbnailUrl} alt="" className={styles.notificationThumbnail} />
                  )}
                  <div className={styles.notificationContent}>
                    <div className={styles.notificationHeader}>
                      <span className={styles.notificationPlatform} style={{ color: notification.platform === 'youtube' ? '#ef4444' : '#a855f7' }}>
                        {notification.platform.toUpperCase()}
                      </span>
                      <span className={styles.notificationTime}>
                        {new Date(notification.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className={styles.notificationChannel}>{notification.channelName}</div>
                    <div className={styles.notificationTitle}>{notification.streamTitle}</div>
                  </div>
                  {!notification.read && <div className={styles.notificationUnreadBadge} />}
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
