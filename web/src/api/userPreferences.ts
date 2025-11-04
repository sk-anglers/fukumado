import { apiFetch } from '../utils/api';

export interface UserPreferences {
  defaultLayout: string;
  savedLayouts: any[];
  notificationSettings: {
    enabled: boolean;
    sound: boolean;
  };
  preferences: {
    autoQualityEnabled?: boolean;
    mutedAll?: boolean;
    masterVolume?: number;
    activeSlotsCount?: number;
  };
}

/**
 * ユーザー設定を取得
 */
export const getUserPreferences = async (): Promise<UserPreferences | null> => {
  try {
    const response = await apiFetch('/api/user/preferences', {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      if (response.status === 401) {
        // 未認証の場合はnullを返す
        return null;
      }
      throw new Error(`Failed to get user preferences: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('[UserPreferences API] Error getting preferences:', error);
    return null;
  }
};

/**
 * ユーザー設定を更新
 */
export const updateUserPreferences = async (
  preferences: Partial<UserPreferences>
): Promise<UserPreferences | null> => {
  try {
    const response = await apiFetch('/api/user/preferences', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(preferences)
    });

    if (!response.ok) {
      if (response.status === 401) {
        // 未認証の場合はnullを返す
        return null;
      }
      throw new Error(`Failed to update user preferences: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('[UserPreferences API] Error updating preferences:', error);
    return null;
  }
};
