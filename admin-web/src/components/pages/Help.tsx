import React, { useState, useEffect } from 'react';
import {
  getHelpArticles,
  getHelpArticle,
  createHelpArticle,
  updateHelpArticle,
  deleteHelpArticle,
  toggleHelpArticlePublish,
  type HelpArticle
} from '../../services/apiClient';
import styles from './Help.module.css';

interface HelpFormData {
  category: string;
  title: string;
  content: string;
  order: number;
  isPublished: boolean;
}

const INITIAL_FORM_DATA: HelpFormData = {
  category: '',
  title: '',
  content: '',
  order: 0,
  isPublished: false
};

export const Help: React.FC = () => {
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<HelpFormData>(INITIAL_FORM_DATA);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [showButtonDialog, setShowButtonDialog] = useState(false);
  const [buttonText, setButtonText] = useState('');
  const [buttonUrl, setButtonUrl] = useState('');

  useEffect(() => {
    loadArticles();
  }, [categoryFilter]);

  const loadArticles = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getHelpArticles(categoryFilter || undefined);
      setArticles(data);
    } catch (err) {
      setError('ヘルプ記事の取得に失敗しました');
      console.error('Failed to load help articles:', err);
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
      const article = await getHelpArticle(id);
      setIsEditing(true);
      setEditingId(id);
      setFormData({
        category: article.category,
        title: article.title,
        content: article.content,
        order: article.order,
        isPublished: article.isPublished
      });
    } catch (err) {
      setError('記事の取得に失敗しました');
      console.error('Failed to load article:', err);
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

      if (editingId) {
        await updateHelpArticle(editingId, formData);
      } else {
        await createHelpArticle(formData);
      }

      setIsEditing(false);
      setEditingId(null);
      setFormData(INITIAL_FORM_DATA);
      await loadArticles();
    } catch (err) {
      setError('記事の保存に失敗しました');
      console.error('Failed to save article:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setError(null);
      await deleteHelpArticle(id);
      setShowDeleteConfirm(null);
      await loadArticles();
    } catch (err) {
      setError('記事の削除に失敗しました');
      console.error('Failed to delete article:', err);
    }
  };

  const handleTogglePublish = async (id: string, currentStatus: boolean) => {
    try {
      setError(null);
      await toggleHelpArticlePublish(id, !currentStatus);
      await loadArticles();
    } catch (err) {
      setError('公開状態の変更に失敗しました');
      console.error('Failed to toggle publish status:', err);
    }
  };

  const convertGoogleDriveUrl = (url: string): string => {
    // Google Drive の共有リンクを画像表示用URLに変換
    // https://drive.google.com/file/d/FILE_ID/view → https://lh3.googleusercontent.com/d/FILE_ID
    const match = url.match(/\/file\/d\/([^\/]+)/);
    if (match) {
      return `https://lh3.googleusercontent.com/d/${match[1]}`;
    }
    // 既に変換済み、または通常のURL
    return url;
  };

  const handleInsertImage = () => {
    if (!imageUrl.trim()) {
      alert('画像URLを入力してください');
      return;
    }

    const convertedUrl = convertGoogleDriveUrl(imageUrl);
    const markdown = `![${imageAlt || '画像'}](${convertedUrl})`;

    // カーソル位置に挿入（簡易実装：末尾に追加）
    setFormData({
      ...formData,
      content: formData.content + '\n\n' + markdown + '\n\n'
    });

    // ダイアログをクリア
    setShowImageDialog(false);
    setImageUrl('');
    setImageAlt('');
  };

  const handleInsertButton = () => {
    if (!buttonText.trim() || !buttonUrl.trim()) {
      alert('ボタンテキストとURLを入力してください');
      return;
    }

    const markdown = `[!button ${buttonText}](${buttonUrl})`;

    // カーソル位置に挿入（簡易実装：末尾に追加）
    setFormData({
      ...formData,
      content: formData.content + '\n\n' + markdown + '\n\n'
    });

    // ダイアログをクリア
    setShowButtonDialog(false);
    setButtonText('');
    setButtonUrl('');
  };

  const uniqueCategories = Array.from(new Set(articles.map(a => a.category)));

  if (loading && articles.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>読み込み中...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>ヘルプ記事管理</h1>
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
          <h2>{editingId ? '記事を編集' : '新規記事作成'}</h2>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="category">カテゴリ</label>
              <input
                id="category"
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
                placeholder="例: 基本操作"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="title">タイトル</label>
              <input
                id="title"
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                placeholder="例: アカウント登録方法"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="content">内容（Markdown対応）</label>
              <div className={styles.contentActions}>
                <button
                  type="button"
                  onClick={() => setShowImageDialog(true)}
                  className={styles.imageButton}
                >
                  📷 画像挿入
                </button>
                <button
                  type="button"
                  onClick={() => setShowButtonDialog(true)}
                  className={styles.imageButton}
                >
                  🔘 ボタン挿入
                </button>
              </div>
              <textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                required
                rows={15}
                placeholder="Markdown形式で記事の内容を入力してください"
              />
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="order">表示順</label>
                <input
                  id="order"
                  type="number"
                  value={formData.order}
                  onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                  min="0"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={formData.isPublished}
                    onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
                  />
                  公開する
                </label>
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

          {/* 画像挿入ダイアログ */}
          {showImageDialog && (
            <div className={styles.imageDialogOverlay} onClick={() => setShowImageDialog(false)}>
              <div className={styles.imageDialog} onClick={(e) => e.stopPropagation()}>
                <h3>画像を挿入</h3>
                <div className={styles.imageDialogContent}>
                  <div className={styles.formGroup}>
                    <label htmlFor="imageUrl">画像URL（Googleドライブの共有リンク可）</label>
                    <input
                      id="imageUrl"
                      type="text"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://drive.google.com/file/d/xxx/view"
                    />
                    <small>※ Googleドライブの場合、「リンクを知っている全員」に設定してください</small>
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="imageAlt">画像の説明（任意）</label>
                    <input
                      id="imageAlt"
                      type="text"
                      value={imageAlt}
                      onChange={(e) => setImageAlt(e.target.value)}
                      placeholder="例: スクリーンショット"
                    />
                  </div>
                  <div className={styles.imageDialogActions}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowImageDialog(false);
                        setImageUrl('');
                        setImageAlt('');
                      }}
                      className={styles.cancelButton}
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      onClick={handleInsertImage}
                      className={styles.submitButton}
                    >
                      挿入
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ボタン挿入ダイアログ */}
          {showButtonDialog && (
            <div className={styles.imageDialogOverlay} onClick={() => setShowButtonDialog(false)}>
              <div className={styles.imageDialog} onClick={(e) => e.stopPropagation()}>
                <h3>ボタンを挿入</h3>
                <div className={styles.imageDialogContent}>
                  <div className={styles.formGroup}>
                    <label htmlFor="buttonText">ボタンのテキスト</label>
                    <input
                      id="buttonText"
                      type="text"
                      value={buttonText}
                      onChange={(e) => setButtonText(e.target.value)}
                      placeholder="例: お問い合わせフォーム"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="buttonUrl">リンク先URL</label>
                    <input
                      id="buttonUrl"
                      type="text"
                      value={buttonUrl}
                      onChange={(e) => setButtonUrl(e.target.value)}
                      placeholder="https://forms.gle/xxx"
                    />
                  </div>
                  <div className={styles.imageDialogActions}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowButtonDialog(false);
                        setButtonText('');
                        setButtonUrl('');
                      }}
                      className={styles.cancelButton}
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      onClick={handleInsertButton}
                      className={styles.submitButton}
                    >
                      挿入
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className={styles.filters}>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className={styles.categoryFilter}
            >
              <option value="">すべてのカテゴリ</option>
              {uniqueCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>カテゴリ</th>
                  <th>タイトル</th>
                  <th>公開状態</th>
                  <th>表示順</th>
                  <th>閲覧数</th>
                  <th>作成日時</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {articles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={styles.noData}>
                      記事がありません
                    </td>
                  </tr>
                ) : (
                  articles.map(article => (
                    <tr key={article.id}>
                      <td>{article.category}</td>
                      <td>{article.title}</td>
                      <td>
                        <span className={article.isPublished ? styles.published : styles.draft}>
                          {article.isPublished ? '公開中' : '下書き'}
                        </span>
                      </td>
                      <td>{article.order}</td>
                      <td>{article.viewCount}</td>
                      <td>{new Date(article.createdAt).toLocaleString('ja-JP')}</td>
                      <td className={styles.actions}>
                        <button
                          onClick={() => handleEdit(article.id)}
                          className={styles.editButton}
                        >
                          編集
                        </button>
                        <button
                          onClick={() => handleTogglePublish(article.id, article.isPublished)}
                          className={styles.toggleButton}
                        >
                          {article.isPublished ? '非公開' : '公開'}
                        </button>
                        {showDeleteConfirm === article.id ? (
                          <div className={styles.deleteConfirm}>
                            <button
                              onClick={() => handleDelete(article.id)}
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
                            onClick={() => setShowDeleteConfirm(article.id)}
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
        </>
      )}
    </div>
  );
};
