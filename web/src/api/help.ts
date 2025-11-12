import { apiFetch } from '../utils/api';

export interface HelpArticle {
  id: string;
  category: string;
  title: string;
  content: string;
  order: number;
  isPublished: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface HelpArticlesResponse {
  success: boolean;
  data: HelpArticle[];
  timestamp: string;
}

export interface HelpArticleResponse {
  success: boolean;
  data: HelpArticle;
  timestamp: string;
}

/**
 * 公開されているヘルプ記事一覧を取得
 */
export const getHelpArticles = async (category?: string): Promise<HelpArticle[]> => {
  try {
    const params = new URLSearchParams();
    if (category) {
      params.append('category', category);
    }

    const url = `/api/help/articles${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await apiFetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch help articles: ${response.statusText}`);
    }

    const result: HelpArticlesResponse = await response.json();

    if (!result.success) {
      throw new Error('Failed to fetch help articles');
    }

    return result.data;
  } catch (error) {
    console.error('[Help API] Error fetching articles:', error);
    throw error;
  }
};

/**
 * ヘルプ記事詳細を取得
 */
export const getHelpArticle = async (id: string): Promise<HelpArticle> => {
  try {
    const response = await apiFetch(`/api/help/articles/${id}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch help article: ${response.statusText}`);
    }

    const result: HelpArticleResponse = await response.json();

    if (!result.success) {
      throw new Error('Failed to fetch help article');
    }

    return result.data;
  } catch (error) {
    console.error('[Help API] Error fetching article:', error);
    throw error;
  }
};

/**
 * ヘルプ記事の閲覧数をインクリメント
 */
export const incrementArticleView = async (id: string): Promise<void> => {
  try {
    const response = await apiFetch(`/api/help/articles/${id}/view`, {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error(`Failed to increment view count: ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error('Failed to increment view count');
    }
  } catch (error) {
    console.error('[Help API] Error incrementing view count:', error);
    // 閲覧数のインクリメント失敗は致命的ではないため、エラーをスローしない
  }
};

/**
 * カテゴリ一覧を取得（記事からユニークなカテゴリを抽出）
 */
export const getHelpCategories = async (): Promise<string[]> => {
  try {
    const articles = await getHelpArticles();
    const categories = Array.from(new Set(articles.map(article => article.category)));
    return categories.sort();
  } catch (error) {
    console.error('[Help API] Error fetching categories:', error);
    throw error;
  }
};
