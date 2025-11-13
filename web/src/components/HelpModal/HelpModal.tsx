import React, { useEffect } from 'react';
import { useHelpStore } from '../../stores/helpStore';
import { trackButtonClick } from '../../utils/gtm';
import './HelpModal.css';

export const HelpModal: React.FC = () => {
  const {
    articles,
    selectedArticle,
    categories,
    selectedCategory,
    isModalOpen,
    loading,
    error,
    loadArticles,
    setSelectedCategory,
    closeModal,
    loadArticle
  } = useHelpStore();

  useEffect(() => {
    if (isModalOpen && articles.length === 0) {
      loadArticles();
    }
  }, [isModalOpen]);

  if (!isModalOpen) {
    return null;
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  };

  const handleCategoryChange = (category: string | null) => {
    // GTMトラッキング
    trackButtonClick('help_category_change', {
      category: category || 'all'
    });
    setSelectedCategory(category);
  };

  const handleArticleClick = async (articleId: string) => {
    await loadArticle(articleId);
  };

  const handleBack = () => {
    // GTMトラッキング
    trackButtonClick('help_article_back', {
      article_id: selectedArticle?.id
    });
    useHelpStore.setState({ selectedArticle: null });
  };

  const renderMarkdown = (content: string) => {
    // シンプルなMarkdownレンダリング（改行、太字、リンク、画像、ボタンなど）
    const lines = content.split('\n');
    return lines.map((line, index) => {
      // ボタン [!button text](url)
      const buttonMatch = line.match(/\[!button\s+([^\]]+)\]\((.+?)\)/);
      if (buttonMatch) {
        const text = buttonMatch[1];
        const url = buttonMatch[2];
        return (
          <a
            key={index}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="help-article-button"
          >
            {text}
          </a>
        );
      }

      // 画像 ![alt](url)
      const imageMatch = line.match(/!\[([^\]]*)\]\((.+?)\)/);
      if (imageMatch) {
        const alt = imageMatch[1];
        const url = imageMatch[2];
        return <img key={index} src={url} alt={alt} className="help-article-image" />;
      }

      // 見出し
      if (line.startsWith('###')) {
        return <h3 key={index}>{line.replace(/^###\s*/, '')}</h3>;
      }
      if (line.startsWith('##')) {
        return <h2 key={index}>{line.replace(/^##\s*/, '')}</h2>;
      }
      if (line.startsWith('#')) {
        return <h1 key={index}>{line.replace(/^#\s*/, '')}</h1>;
      }

      // リスト
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return <li key={index}>{line.replace(/^[-*]\s*/, '')}</li>;
      }

      // 空行
      if (line.trim() === '') {
        return <br key={index} />;
      }

      // 通常のテキスト（太字、リンクを処理）
      let processedLine = line;

      // 太字 **text**
      processedLine = processedLine.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

      // リンク [text](url)
      processedLine = processedLine.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

      return <p key={index} dangerouslySetInnerHTML={{ __html: processedLine }} />;
    });
  };

  const filteredArticles = selectedCategory
    ? articles.filter(a => a.category === selectedCategory)
    : articles;

  // カテゴリ別にグループ化
  const articlesByCategory = filteredArticles.reduce((acc, article) => {
    if (!acc[article.category]) {
      acc[article.category] = [];
    }
    acc[article.category].push(article);
    return acc;
  }, {} as Record<string, typeof articles>);

  return (
    <div className="help-modal-overlay" onClick={handleOverlayClick}>
      <div className="help-modal">
        <div className="help-modal-header">
          <h2>ヘルプ</h2>
          <button
            className="help-modal-close"
            onClick={() => {
              trackButtonClick('help_modal_close');
              closeModal();
            }}
          >
            ✕
          </button>
        </div>

        <div className="help-modal-content">
          {error && (
            <div className="help-modal-error">
              {error}
            </div>
          )}

          {loading && (
            <div className="help-modal-loading">
              読み込み中...
            </div>
          )}

          {!loading && !error && (
            <>
              {selectedArticle ? (
                // 記事詳細表示
                <div className="help-article-detail">
                  <button className="help-back-button" onClick={handleBack}>
                    ← 戻る
                  </button>
                  <div className="help-article-category">{selectedArticle.category}</div>
                  <h3 className="help-article-title">{selectedArticle.title}</h3>
                  <div className="help-article-content">
                    {renderMarkdown(selectedArticle.content)}
                  </div>
                  <div className="help-article-meta">
                    閲覧数: {selectedArticle.viewCount}
                  </div>
                </div>
              ) : (
                // 記事一覧表示
                <>
                  {categories.length > 1 && (
                    <div className="help-category-filter">
                      <button
                        className={`help-category-button ${selectedCategory === null ? 'active' : ''}`}
                        onClick={() => handleCategoryChange(null)}
                      >
                        すべて
                      </button>
                      {categories.map(category => (
                        <button
                          key={category}
                          className={`help-category-button ${selectedCategory === category ? 'active' : ''}`}
                          onClick={() => handleCategoryChange(category)}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="help-articles-list">
                    {Object.keys(articlesByCategory).length === 0 ? (
                      <div className="help-no-articles">
                        ヘルプ記事がありません
                      </div>
                    ) : (
                      Object.entries(articlesByCategory).map(([category, categoryArticles]) => (
                        <div key={category} className="help-category-group">
                          <h3 className="help-category-title">{category}</h3>
                          <div className="help-articles">
                            {categoryArticles
                              .sort((a, b) => a.order - b.order)
                              .map(article => (
                                <div
                                  key={article.id}
                                  className="help-article-item"
                                  onClick={() => handleArticleClick(article.id)}
                                >
                                  <div className="help-article-item-title">{article.title}</div>
                                  <div className="help-article-item-arrow">→</div>
                                </div>
                              ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
