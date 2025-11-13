import React, { useEffect, useMemo } from 'react';
import { useAnnouncementStore } from '../../stores/announcementStore';
import { getAnnouncementColor, getAnnouncementBgColor } from '../../api/announcements';
import { trackButtonClick } from '../../utils/gtm';
import './AnnouncementBanner.css';

export const AnnouncementBanner: React.FC = () => {
  const announcements = useAnnouncementStore((state) => state.announcements);
  const dismissedIds = useAnnouncementStore((state) => state.dismissedIds);
  const loadAnnouncements = useAnnouncementStore((state) => state.loadAnnouncements);
  const dismissAnnouncement = useAnnouncementStore((state) => state.dismissAnnouncement);

  // storeの状態から表示すべきお知らせを計算
  const visibleAnnouncements = useMemo(() => {
    return announcements.filter(announcement => {
      // 閉じられていないお知らせのみ表示
      return !dismissedIds.has(announcement.id);
    });
  }, [announcements, dismissedIds]);

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
            onClick={() => {
              trackButtonClick('announcement_dismiss', {
                announcement_id: announcement.id,
                announcement_type: announcement.type
              });
              dismissAnnouncement(announcement.id);
            }}
            aria-label="お知らせを閉じる"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};
