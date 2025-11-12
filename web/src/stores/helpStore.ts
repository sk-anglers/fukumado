import { create } from 'zustand';
import { getHelpArticles, getHelpArticle, incrementArticleView, type HelpArticle } from '../api/help';

interface HelpState {
  // 状態
  articles: HelpArticle[];
  selectedArticle: HelpArticle | null;
  categories: string[];
  selectedCategory: string | null;
  isModalOpen: boolean;
  loading: boolean;
  error: string | null;

  // アクション
  loadArticles: (category?: string) => Promise<void>;
  loadArticle: (id: string) => Promise<void>;
  setSelectedCategory: (category: string | null) => void;
  openModal: (articleId?: string) => Promise<void>;
  closeModal: () => void;
  setError: (error: string | null) => void;
}

export const useHelpStore = create<HelpState>((set, get) => ({
  // 初期状態
  articles: [],
  selectedArticle: null,
  categories: [],
  selectedCategory: null,
  isModalOpen: false,
  loading: false,
  error: null,

  // 記事一覧を読み込む
  loadArticles: async (category?: string) => {
    try {
      set({ loading: true, error: null });
      const articles = await getHelpArticles(category);

      // カテゴリ一覧を抽出
      const categories = Array.from(new Set(articles.map(a => a.category))).sort();

      set({ articles, categories, loading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'ヘルプ記事の取得に失敗しました';
      set({ error: errorMessage, loading: false });
      console.error('[HelpStore] Error loading articles:', error);
    }
  },

  // 記事詳細を読み込む
  loadArticle: async (id: string) => {
    try {
      set({ loading: true, error: null });
      const article = await getHelpArticle(id);

      // 閲覧数をインクリメント（非同期・エラーを無視）
      incrementArticleView(id);

      set({ selectedArticle: article, loading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'ヘルプ記事の取得に失敗しました';
      set({ error: errorMessage, loading: false });
      console.error('[HelpStore] Error loading article:', error);
    }
  },

  // カテゴリフィルターを設定
  setSelectedCategory: (category: string | null) => {
    set({ selectedCategory: category });
    get().loadArticles(category || undefined);
  },

  // モーダルを開く
  openModal: async (articleId?: string) => {
    set({ isModalOpen: true });

    if (articleId) {
      await get().loadArticle(articleId);
    } else {
      // 記事一覧を読み込む
      await get().loadArticles(get().selectedCategory || undefined);
    }
  },

  // モーダルを閉じる
  closeModal: () => {
    set({ isModalOpen: false, selectedArticle: null });
  },

  // エラーを設定
  setError: (error: string | null) => {
    set({ error });
  }
}));
