import { apiFetch } from '../utils/api';

export interface Announcement {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  content: string;
  link: string | null;
  linkText: string | null;
  priority: number;
  isActive: boolean;
  forceDisplayVersion: number;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnnouncementsResponse {
  success: boolean;
  data: Announcement[];
  timestamp: string;
}

/**
 * アクティブなお知らせ一覧を取得
 * （有効で、表示期間内のお知らせのみ）
 */
export const getActiveAnnouncements = async (): Promise<Announcement[]> => {
  try {
    const response = await apiFetch('/api/announcements');

    if (!response.ok) {
      throw new Error(`Failed to fetch announcements: ${response.statusText}`);
    }

    const result: AnnouncementsResponse = await response.json();

    if (!result.success) {
      throw new Error('Failed to fetch announcements');
    }

    return result.data;
  } catch (error) {
    console.error('[Announcements API] Error fetching announcements:', error);
    throw error;
  }
};

/**
 * お知らせのタイプに応じた色を取得
 */
export const getAnnouncementColor = (type: Announcement['type']): string => {
  switch (type) {
    case 'info':
      return '#3498DB';
    case 'warning':
      return '#f59f00';
    case 'error':
      return '#a4262c';
    case 'success':
      return '#107c10';
    default:
      return '#323130';
  }
};

/**
 * お知らせのタイプに応じた背景色を取得
 */
export const getAnnouncementBgColor = (type: Announcement['type']): string => {
  switch (type) {
    case 'info':
      return '#e3f2fd';
    case 'warning':
      return '#fff4e6';
    case 'error':
      return '#fde7e9';
    case 'success':
      return '#dff6dd';
    default:
      return '#f3f2f1';
  }
};
