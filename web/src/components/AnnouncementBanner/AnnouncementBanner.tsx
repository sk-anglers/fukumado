import React, { useEffect, useMemo } from 'react';
import { useAnnouncementStore } from '../../stores/announcementStore';
import { getAnnouncementColor, getAnnouncementBgColor } from '../../api/announcements';
import './AnnouncementBanner.css';

export const AnnouncementBanner: React.FC = () => {
  const announcements = useAnnouncementStore((state) => state.announcements);
  const dismissedVersions = useAnnouncementStore((state) => state.dismissedVersions);
  const loadAnnouncements = useAnnouncementStore((state) => state.loadAnnouncements);
  const dismissAnnouncement = useAnnouncementStore((state) => state.dismissAnnouncement);

  // storeの状態から表示すべきお知らせを計算
  const visibleAnnouncements = useMemo(() => {
    return announcements.filter(announcement => {
      const dismissedVersion = dismissedVersions.get(announcement.id);
      // 閉じられていない、または閉じた時より新しいバージョンなら表示
      return dismissedVersion === undefined || announcement.forceDisplayVersion > dismissedVersion;
    });
  }, [announcements, dismissedVersions]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  if (visibleAnnouncements.length === 0) {
    return null;
  }

  return (
    <div className="announcement-banner-container">
      {visibleAnnouncements.map(announcement => (
        <div
          key={announcement.id}
          className="announcement-banner"
          style={{
            backgroundColor: getAnnouncementBgColor(announcement.type),
            borderLeftColor: getAnnouncementColor(announcement.type)
          }}
        >
          <div className="announcement-content">
            <div className="announcement-header">
              <span
                className="announcement-type-badge"
                style={{ backgroundColor: getAnnouncementColor(announcement.type) }}
              >
                {announcement.type === 'info' && 'お知らせ'}
                {announcement.type === 'warning' && '警告'}
                {announcement.type === 'error' && 'エラー'}
                {announcement.type === 'success' && '成功'}
              </span>
              <span className="announcement-title">{announcement.title}</span>
            </div>
            <div className="announcement-text">{announcement.content}</div>
            {announcement.link && announcement.linkText && (
              <a
                href={announcement.link}
                target="_blank"
                rel="noopener noreferrer"
                className="announcement-link"
                style={{ color: getAnnouncementColor(announcement.type) }}
              >
                {announcement.linkText} →
              </a>
            )}
          </div>
          <button
            className="announcement-close"
            onClick={() => dismissAnnouncement(announcement.id, announcement.forceDisplayVersion)}
            aria-label="お知らせを閉じる"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};
