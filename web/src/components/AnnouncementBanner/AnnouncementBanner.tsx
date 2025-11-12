import React, { useEffect } from 'react';
import { useAnnouncementStore } from '../../stores/announcementStore';
import { getAnnouncementColor, getAnnouncementBgColor } from '../../api/announcements';
import './AnnouncementBanner.css';

export const AnnouncementBanner: React.FC = () => {
  const {
    loadAnnouncements,
    dismissAnnouncement,
    getVisibleAnnouncements
  } = useAnnouncementStore();

  const visibleAnnouncements = getVisibleAnnouncements();

  useEffect(() => {
    loadAnnouncements();
  }, []);

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
