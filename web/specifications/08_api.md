# 8. API仕様

このセクションでは、ふくまど！のバックエンドAPIエンドポイントの詳細を説明します。

## 8.1 認証API

### GET `/auth/status`
Google認証状態取得。

**レスポンス**:
```json
{
  "authenticated": true,
  "user": {
    "id": "...",
    "email": "...",
    "name": "...",
    "picture": "..."
  }
}
```

### GET `/auth/google`
Google OAuth2認証開始（リダイレクト）。

**フロー**:
1. ユーザーをGoogle OAuth2同意画面にリダイレクト
2. 認証成功後、`/auth/google/callback`にコールバック
3. アクセストークンを取得してセッションに保存
4. フロントエンドにリダイレクト

### GET `/auth/logout`
Googleログアウト。

**処理**:
- セッションからGoogle認証情報を削除
- フロントエンドにリダイレクト

### GET `/auth/twitch/status`
Twitch認証状態取得。

**レスポンス**:
```json
{
  "authenticated": true,
  "user": {
    "id": "...",
    "login": "...",
    "displayName": "...",
    "profileImageUrl": "..."
  }
}
```

### GET `/auth/twitch`
Twitch OAuth2認証開始（リダイレクト）。

**スコープ**:
- `user:read:follows`: フォロー中チャンネル取得
- `chat:read`: チャット読み取り
- `chat:edit`: チャット送信

### GET `/auth/twitch/logout`
Twitchログアウト。

## 8.2 YouTube API

### GET `/api/youtube/live`
YouTube配信リスト取得。

**クエリパラメータ**:
- `channelId`: チャンネルID（複数指定可）
- `q`: 検索クエリ（fallback）

**レスポンス**:
```json
{
  "items": [
    {
      "id": "videoId",
      "title": "配信タイトル",
      "channelId": "channelId",
      "channelTitle": "チャンネル名",
      "description": "説明",
      "thumbnailUrl": "https://...",
      "publishedAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

**エラーレスポンス**:
```json
{
  "error": "YouTube API quota exceeded"
}
```

### GET `/api/youtube/channels`
YouTubeチャンネル検索。

**クエリパラメータ**:
- `q`: 検索クエリ

**レスポンス**:
```json
{
  "items": [
    {
      "id": "channelId",
      "title": "チャンネル名",
      "description": "説明",
      "thumbnailUrl": "https://...",
      "customUrl": "@channelname"
    }
  ]
}
```

### GET `/api/youtube/subscriptions`
YouTube登録チャンネル取得。

**認証**: Google OAuth2 必須

**レスポンス**:
```json
{
  "items": [
    {
      "channelId": "...",
      "title": "...",
      "thumbnailUrl": "..."
    }
  ],
  "sessionId": "..."
}
```

## 8.3 Twitch API

### GET `/api/twitch/subscriptions`
Twitchフォロー中チャンネル取得。

**認証**: Twitch OAuth2 必須

**レスポンス**:
```json
{
  "items": [
    {
      "id": "userId",
      "login": "channelLogin",
      "displayName": "DisplayName"
    }
  ],
  "sessionId": "..."
}
```

### GET `/api/twitch/live`
Twitch配信リスト取得。

**クエリパラメータ**:
- `channelId`: チャンネルID（複数指定可）

**レスポンス**:
```json
{
  "items": [
    {
      "id": "streamId",
      "userId": "userId",
      "login": "channelLogin",
      "displayName": "DisplayName",
      "title": "配信タイトル",
      "viewerCount": 123,
      "gameTitle": "Apex Legends",
      "thumbnailUrl": "https://...",
      "startedAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### GET `/api/twitch/channels`
Twitchチャンネル検索。

**クエリパラメータ**:
- `query`: 検索クエリ

**キャッシュ**: 5分（メモリ）

**レスポンス**:
```json
{
  "items": [
    {
      "id": "userId",
      "login": "channelLogin",
      "displayName": "DisplayName",
      "description": "説明",
      "thumbnailUrl": "https://...",
      "login": "channelLogin"
    }
  ]
}
```

### POST `/api/twitch/chat/send`
Twitchチャット送信。

**認証**: Twitch OAuth2 必須

**リクエストボディ**:
```json
{
  "channelId": "userId",
  "channelLogin": "channelLogin",
  "message": "Hello!"
}
```

**レスポンス**:
```json
{
  "success": true
}
```

**エラーレスポンス**:
```json
{
  "error": "Not authenticated",
  "success": false
}
```

### GET `/api/twitch/emotes/global`
Twitchグローバルエモート取得。

**レスポンス**:
```json
{
  "items": [
    {
      "id": "25",
      "name": "Kappa",
      "imageUrl": "https://static-cdn.jtvnw.net/emoticons/v2/25/default/light/1.0"
    }
  ]
}
```

### GET `/api/twitch/emotes/channel`
Twitchチャンネルエモート取得。

**クエリパラメータ**:
- `channelId`: チャンネルID

**レスポンス**:
```json
{
  "items": [
    {
      "id": "...",
      "name": "...",
      "imageUrl": "..."
    }
  ]
}
```

## 8.4 ニコニコAPI

### GET `/api/niconico/live`
ニコニコ配信リスト取得（未実装）。

**計画中の機能**:
- ニコニコ生放送APIとの統合
- 配信リスト取得
- チャット機能（コメント取得・送信）

## 8.5 WebSocket API

### エンドポイント
`ws://localhost:4000/chat`

### 接続
```javascript
const ws = new WebSocket('ws://localhost:4000/chat');
```

### メッセージ形式

#### クライアント → サーバー（購読）
```json
{
  "type": "subscribe",
  "channels": ["channel1", "channel2"],
  "channelMapping": {
    "channel1": "DisplayName1"
  },
  "channelIdMapping": {
    "channel1": "channelId1"
  }
}
```

#### サーバー → クライアント（チャットメッセージ）
```json
{
  "id": "messageId",
  "platform": "twitch",
  "author": "username",
  "message": "Hello!",
  "timestamp": "12:34:56",
  "avatarColor": "#FF5733",
  "channelName": "DisplayName1",
  "emotes": [
    {
      "id": "emoteId",
      "positions": [{ "start": 0, "end": 5 }]
    }
  ],
  "badges": [
    {
      "setId": "subscriber",
      "version": "12",
      "imageUrl": "https://..."
    }
  ],
  "bits": 100,
  "isSubscriber": true,
  "isModerator": false,
  "isVip": false
}
```

#### サーバー → クライアント（配信リスト更新）
```json
{
  "type": "stream_list_updated",
  "platform": "twitch",
  "streams": [...],
  "changes": {
    "added": [...],
    "removed": [...]
  }
}
```

## 8.6 エラーコード

| ステータスコード | 意味 | 対処法 |
|---|---|---|
| 200 | 成功 | - |
| 400 | リクエストエラー | リクエストパラメータを確認 |
| 401 | 未認証 | OAuth2認証を実行 |
| 403 | 権限不足 | 必要なスコープが不足 |
| 404 | リソースが見つからない | エンドポイントURLを確認 |
| 429 | レート制限超過 | しばらく待機してから再試行 |
| 500 | サーバーエラー | バックエンドログを確認 |

## 8.7 レート制限

### Twitch API
- **制限**: 800リクエスト/分
- **ヘッダー**: `Ratelimit-Remaining`, `Ratelimit-Reset`
- **対策**: キャッシング、バッチ処理

### YouTube Data API
- **クォータ**: 10,000 units/日
- **コスト**:
  - search: 100 units
  - videos.list: 1 unit
- **対策**: キャッシング、fallbackクエリの最小化

## 8.8 API呼び出しのベストプラクティス

### エラーハンドリング
```typescript
try {
  const response = await fetch('/api/twitch/live');
  if (!response.ok) {
    if (response.status === 429) {
      // レート制限超過
      console.error('Rate limit exceeded');
    } else if (response.status === 401) {
      // 未認証
      console.error('Not authenticated');
    }
    throw new Error(`API error: ${response.status}`);
  }
  const data = await response.json();
  return data;
} catch (error) {
  console.error('API call failed:', error);
  throw error;
}
```

### リトライロジック
```typescript
const fetchWithRetry = async (url: string, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
};
```

### タイムアウト設定
```typescript
const fetchWithTimeout = async (url: string, timeout = 5000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
};
```
