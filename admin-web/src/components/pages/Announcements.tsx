import React, { useState, useEffect } from 'react';
import {
  getAnnouncements,
  getAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  toggleAnnouncementActive,
  forceDisplayAnnouncement,
  type Announcement
} from '../../services/apiClient';
import styles from './Announcements.module.css';

interface AnnouncementFormData {
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  content: string;
  link: string;
  linkText: string;
  priority: number;
  isActive: boolean;
  startAt: string;
  endAt: string;
}

const INITIAL_FORM_DATA: AnnouncementFormData = {
  type: 'info',
  title: '',
  content: '',
  link: '',
  linkText: '',
  priority: 0,
  isActive: true,
  startAt: '',
  endAt: ''
};

const ANNOUNCEMENT_TYPES = [
  { value: 'info', label: '情報', color: '#3498DB' },
  { value: 'warning', label: '警告', color: '#f59f00' },
  { value: 'error', label: 'エラー', color: '#a4262c' },
  { value: 'success', label: '成功', color: '#107c10' }
] as const;

export const Announcements: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<AnnouncementFormData>(INITIAL_FORM_DATA);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAnnouncements();
      setAnnouncements(data);
    } catch (err) {
      setError('お知らせの取得に失敗しました');
      console.error('Failed to load announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setIsEditing(true);
    setEditingId(null);
    setFormData(INITIAL_FORM_DATA);
  };

  const handleEdit = async (id: string) => {
    try {
      const announcement = await getAnnouncement(id);
      setIsEditing(true);
      setEditingId(id);
      setFormData({
        type: announcement.type,
        title: announcement.title,
        content: announcement.content,
        link: announcement.link || '',
        linkText: announcement.linkText || '',
        priority: announcement.priority,
        isActive: announcement.isActive,
        startAt: announcement.startAt ? announcement.startAt.slice(0, 16) : '',
        endAt: announcement.endAt ? announcement.endAt.slice(0, 16) : ''
      });
    } catch (err) {
      setError('お知らせの取得に失敗しました');
      console.error('Failed to load announcement:', err);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData(INITIAL_FORM_DATA);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setError(null);

      const submitData = {
        type: formData.type,
        title: formData.title,
        content: formData.content,
        link: formData.link || null,
        linkText: formData.linkText || null,
        priority: formData.priority,
        isActive: formData.isActive,
        startAt: formData.startAt || null,
        endAt: formData.endAt || null
      };

      if (editingId) {
        await updateAnnouncement(editingId, submitData);
      } else {
        await createAnnouncement(submitData);
      }

      setIsEditing(false);
      setEditingId(null);
      setFormData(INITIAL_FORM_DATA);
      await loadAnnouncements();
    } catch (err) {
      setError('お知らせの保存に失敗しました');
      console.error('Failed to save announcement:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setError(null);
      await deleteAnnouncement(id);
      setShowDeleteConfirm(null);
      await loadAnnouncements();
    } catch (err) {
      setError('お知らせの削除に失敗しました');
      console.error('Failed to delete announcement:', err);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      setError(null);
      await toggleAnnouncementActive(id, !currentStatus);
      await loadAnnouncements();
    } catch (err) {
      setError('有効状態の変更に失敗しました');
      console.error('Failed to toggle active status:', err);
    }
  };

  const handleForceDisplay = async (id: string) => {
    try {
      setError(null);
      await forceDisplayAnnouncement(id);
      alert('お知らせを全ユーザーに強制表示しました');
      await loadAnnouncements();
    } catch (err) {
      setError('強制表示に失敗しました');
      console.error('Failed to force display announcement:', err);
    }
  };

  const getTypeLabel = (type: string) => {
    return ANNOUNCEMENT_TYPES.find(t => t.value === type)?.label || type;
  };

  const getTypeColor = (type: string) => {
    return ANNOUNCEMENT_TYPES.find(t => t.value === type)?.color || '#323130';
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && announcements.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>読み込み中...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>お知らせ管理</h1>
        <button onClick={handleCreate} className={styles.createButton}>
          新規作成
        </button>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      {isEditing ? (
        <div className={styles.formContainer}>
          <h2>{editingId ? 'お知らせを編集' : '新規お知らせ作成'}</h2>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="type">タイプ</label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                required
              >
                {ANNOUNCEMENT_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="title">タイトル</label>
              <input
                id="title"
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                placeholder="例: メンテナンスのお知らせ"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="content">内容</label>
              <textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                required
                rows={6}
                placeholder="お知らせの詳細内容を入力してください"
              />
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="link">リンクURL（任意）</label>
                <input
                  id="link"
                  type="url"
                  value={formData.link}
                  onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                  placeholder="https://example.com"
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="linkText">リンクテキスト（任意）</label>
                <input
                  id="linkText"
                  type="text"
                  value={formData.linkText}
                  onChange={(e) => setFormData({ ...formData, linkText: e.target.value })}
                  placeholder="詳細はこちら"
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="priority">優先度</label>
                <input
                  id="priority"
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                  min="0"
                  placeholder="数値が大きいほど上位に表示"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  有効にする
                </label>
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="startAt">表示開始日時（任意）</label>
                <input
                  id="startAt"
                  type="datetime-local"
                  value={formData.startAt}
                  onChange={(e) => setFormData({ ...formData, startAt: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="endAt">表示終了日時（任意）</label>
                <input
                  id="endAt"
                  type="datetime-local"
                  value={formData.endAt}
                  onChange={(e) => setFormData({ ...formData, endAt: e.target.value })}
                />
              </div>
            </div>

            <div className={styles.formActions}>
              <button type="button" onClick={handleCancel} className={styles.cancelButton}>
                キャンセル
              </button>
              <button type="submit" className={styles.submitButton}>
                {editingId ? '更新' : '作成'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>タイプ</th>
                <th>タイトル</th>
                <th>状態</th>
                <th>優先度</th>
                <th>表示開始</th>
                <th>表示終了</th>
                <th>作成日時</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {announcements.length === 0 ? (
                <tr>
                  <td colSpan={8} className={styles.noData}>
                    お知らせがありません
                  </td>
                </tr>
              ) : (
                announcements.map(announcement => (
                  <tr key={announcement.id}>
                    <td>
                      <span
                        className={styles.typeBadge}
                        style={{ backgroundColor: getTypeColor(announcement.type) }}
                      >
                        {getTypeLabel(announcement.type)}
                      </span>
                    </td>
                    <td className={styles.titleCell}>{announcement.title}</td>
                    <td>
                      <span className={announcement.isActive ? styles.active : styles.inactive}>
                        {announcement.isActive ? '有効' : '無効'}
                      </span>
                    </td>
                    <td>{announcement.priority}</td>
                    <td>{formatDateTime(announcement.startAt)}</td>
                    <td>{formatDateTime(announcement.endAt)}</td>
                    <td>{formatDateTime(announcement.createdAt)}</td>
                    <td className={styles.actions}>
                      <button
                        onClick={() => handleEdit(announcement.id)}
                        className={styles.editButton}
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleToggleActive(announcement.id, announcement.isActive)}
                        className={styles.toggleButton}
                      >
                        {announcement.isActive ? '無効化' : '有効化'}
                      </button>
                      <button
                        onClick={() => handleForceDisplay(announcement.id)}
                        className={styles.forceDisplayButton}
                        title="全ユーザーに再表示"
                      >
                        強制表示
                      </button>
                      {showDeleteConfirm === announcement.id ? (
                        <div className={styles.deleteConfirm}>
                          <button
                            onClick={() => handleDelete(announcement.id)}
                            className={styles.confirmDelete}
                          >
                            確認
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(null)}
                            className={styles.cancelDelete}
                          >
                            キャンセル
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowDeleteConfirm(announcement.id)}
                          className={styles.deleteButton}
                        >
                          削除
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
