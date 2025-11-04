# 7. カスタムフック仕様

ふくまど！では、ビジネスロジックをコンポーネントから分離するため、カスタムReactフックを活用しています。

## 7.1 useAuthStatus (src/hooks/useAuthStatus.ts)

Google（YouTube）認証状態を取得。

### 引数
なし

### 処理
1. `/auth/status` にGETリクエスト
2. レスポンスをauthStore.setStatusに設定

### 依存
- authStore

### 使用例
```typescript
// App.tsx または Header.tsx で呼び出し
useAuthStatus();

// authStore から状態を取得
const { authenticated, user } = useAuthStore();
```

## 7.2 useTwitchAuthStatus (src/hooks/useTwitchAuthStatus.ts)

Twitch認証状態を取得。

### 引数
なし

### 処理
1. `/auth/twitch/status` にGETリクエスト
2. レスポンスをauthStore.setTwitchStatusに設定

### 依存
- authStore

## 7.3 useYoutubeStreams (src/hooks/useYoutubeStreams.ts)

YouTube配信リストを取得・自動同期。

### 引数
```typescript
function useYoutubeStreams(
  channelIds: string[],
  fallbackQuery?: string
): void
```

### 処理
1. `/api/youtube/live?channelId=...` にGETリクエスト
2. レスポンスをStreamer型に変換
3. layoutStore.setAvailableStreamsForPlatform('youtube', streams)に設定
4. 新規配信があれば通知生成（notificationStore.addNotification）
5. syncSettings.intervalで定期実行

### 通知生成条件
- 初回ロード時は通知しない
- 2回目以降、前回のstreamIdセットに存在しない配信を新規と判定

### 依存
- layoutStore
- notificationStore
- syncStore

## 7.4 useTwitchStreams (src/hooks/useTwitchStreams.ts)

Twitch配信リストを取得・自動同期。

### 引数
```typescript
function useTwitchStreams(
  channelIds: string[]
): void
```

### 処理
useYoutubeStreamsと同様だが、fallbackクエリなし。

### API
`/api/twitch/live?channelId=...&channelId=...`

## 7.5 useTwitchChat (src/hooks/useTwitchChat.ts)

TwitchチャットをWebSocketで受信。

### 引数
```typescript
interface TwitchChannel {
  login: string;
  displayName: string;
  channelId?: string;
}

function useTwitchChat(channels: TwitchChannel[]): void
```

### 処理
1. `ws://localhost:4000/chat` にWebSocket接続
2. チャンネル購読メッセージを送信:
   ```json
   {
     "type": "subscribe",
     "channels": ["channel1", "channel2"],
     "channelMapping": { "channel1": "DisplayName1" },
     "channelIdMapping": { "channel1": "channelId1" }
   }
   ```
3. サーバーからメッセージ受信時、chatStore.addMessageで追加

### チャンネル変更
- WebSocketを切断せず、購読メッセージを再送信
- チャンネルリストの文字列化（JSON.stringify）で変更検出

### 依存
- chatStore

### メッセージフィルタリング（v1.1.0）

**実装背景**: WebSocketで受信するメッセージには、チャットメッセージ以外にEventSub通知や配信リスト更新などが含まれるため、チャットメッセージのみを抽出する必要がある。

#### フィルタリングロジック (L77-90)

```typescript
// チャットメッセージのみを処理（typeフィールドがない、またはplatformがtwitchのメッセージ）
// EventSub通知、配信リスト更新、優先度変更などは無視する
if (message.type && message.type !== 'chat') {
  console.log('[useTwitchChat] Ignoring non-chat message:', message.type);
  return;
}

// チャットメッセージかどうかを確認（platformまたはchannelLoginフィールドの存在）
if (!message.platform && !message.channelLogin) {
  console.log('[useTwitchChat] Ignoring message without platform/channelLogin');
  return;
}
```

**フィルタリング条件**:
1. `message.type === 'chat'` のメッセージのみ処理
2. `message.type` が存在しない場合、`platform` または `channelLogin` フィールドの存在を確認
3. 上記条件を満たさないメッセージは無視

**無視されるメッセージタイプ**:
- EventSub通知（`type: 'eventsub'`）
- 配信リスト更新（`type: 'streams'`）
- 優先度変更（`type: 'priority'`）
- その他のシステムメッセージ

### ハートビート送信（v1.1.0）

**目的**: WebSocket接続を維持し、タイムアウトを防止

```typescript
// 30秒ごとにハートビートを送信
heartbeatTimerRef.current = setInterval(() => {
  if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
    wsRef.current.send(JSON.stringify({ type: 'heartbeat' }));
  }
}, 30000);
```

**実装箇所**: `web/src/hooks/useTwitchChat.ts` L27-40

参照: [12.15 チャットメッセージ表示の問題（解決済み）](./12_issues.md#1215-チャットメッセージ表示の問題解決済み)

## 7.6 useYouTubeIframeApi (src/hooks/useYouTubeIframeApi.ts)

YouTube IFrame APIをロード・プレイヤー制御。

### 引数
```typescript
function useYouTubeIframeApi(
  videoId: string,
  elementId: string,
  volume: number,
  muted: boolean,
  quality: VideoQuality
): void
```

### 処理
1. YouTube IFrame APIスクリプトをロード
2. `YT.Player`インスタンス作成
3. 音量・ミュート・画質をプロパティ変更に応じて同期

### プレイヤー制御
```typescript
// 音量変更
player.setVolume(volume);

// ミュート
player.mute();
player.unMute();

// 画質変更
player.setPlaybackQuality(quality);
```

## 7.7 useTwitchEmbed (src/hooks/useTwitchEmbed.ts)

Twitch Embedプレイヤーを制御。

### 引数
```typescript
function useTwitchEmbed(
  channel: string,
  elementId: string,
  volume: number,
  muted: boolean
): void
```

### 処理
1. Twitch Embedスクリプトをロード
2. `Twitch.Embed`インスタンス作成
3. 音量・ミュートをプロパティ変更に応じて同期

### プレイヤー制御
```typescript
// 音量変更
player.setVolume(volume / 100); // 0-1

// ミュート
player.setMuted(muted);
```

## 7.8 useAudioLevelMonitor (src/hooks/useAudioLevelMonitor.ts)

音声レベルをモニタリング（実験的）。

### 引数
```typescript
function useAudioLevelMonitor(slotIds: string[]): AudioLevelData
```

### 戻り値
```typescript
interface AudioLevelData {
  [slotId: string]: number; // 0-100の音量レベル
}
```

### 処理
- Web Audio APIでAudioContextを作成
- 各スロットのiframe内videoエレメントに接続を試みる
- **制限**: クロスオリジン制限により、実際には機能しない
- **現状**: ランダムな音量レベルをシミュレーション（デモ用）

### 今後の改善案
- バックエンドで音声分析
- プラットフォームAPIから音量情報を取得

## 7.9 useDataUsageMonitor (src/hooks/useDataUsageMonitor.ts)

データ使用量を監視。

### 引数
なし

### 処理
1. Resource Timing API (`performance.getEntriesByType('resource')`) でリソース取得
2. 未処理のリソースの`transferSize`を取得
3. dataUsageStore.addUsageでバイト数を追加
4. 5秒ごとに実行

### 制限
- **iframe内リソースは測定不可**: クロスオリジン制限により、配信ストリーミングデータは取得できない
- **測定対象**: JS/CSS/画像/APIリクエストなど、メインページのリソースのみ

### 依存
- dataUsageStore

### 実装例
```typescript
useEffect(() => {
  const interval = setInterval(() => {
    const resources = performance.getEntriesByType('resource');
    const newResources = resources.filter(r => !processedResources.has(r.name));

    let totalBytes = 0;
    newResources.forEach(r => {
      const entry = r as PerformanceResourceTiming;
      if (entry.transferSize > 0) {
        totalBytes += entry.transferSize;
        processedResources.add(entry.name);
      }
    });

    if (totalBytes > 0) {
      dataUsageStore.getState().addUsage(totalBytes);
    }
  }, 5000);

  return () => clearInterval(interval);
}, []);
```

## 7.10 useMediaQuery (src/hooks/useMediaQuery.ts)

メディアクエリの状態を監視するカスタムフック。レスポンシブデザインに使用。

### 引数
```typescript
function useMediaQuery(query: string): boolean
```

- `query`: メディアクエリ文字列（例: `'(max-width: 768px)'`）

### 戻り値
- `boolean`: クエリがマッチする場合は`true`

### 処理
1. `window.matchMedia(query)` でMediaQueryListを取得
2. `matches`プロパティで現在の状態を取得
3. `change`イベントをリスンして状態を更新

### ヘルパーフック
```typescript
export const useIsMobile = (): boolean => useMediaQuery('(max-width: 768px)');
export const useIsTablet = (): boolean => useMediaQuery('(min-width: 769px) and (max-width: 1200px)');
export const useIsDesktop = (): boolean => useMediaQuery('(min-width: 1201px)');
```

### 使用例
```typescript
const isMobile = useIsMobile();

if (isMobile) {
  // モバイル専用UI
  return <MobileLayout />;
}
```

### 依存
- なし（標準Web API使用）

## 7.11 useStreamUpdates (src/hooks/useStreamUpdates.ts)

WebSocket経由で配信リスト更新を受信するフック。バックエンドのStreamSyncServiceと連携。

### 引数
```typescript
function useStreamUpdates(
  youtubeChannelIds: string[] = [],
  twitchChannelIds: string[] = []
): void
```

### 処理
1. **WebSocket接続**: グローバルシングルトンのwebsocketServiceを使用
2. **メッセージハンドラー登録**: `stream_list_updated`メッセージを受信
3. **データ変換**: プラットフォーム別にStreamer型に変換
4. **ストア更新**: layoutStore.setAvailableStreamsForPlatformで配信リストを更新
5. **通知生成**: 初回ロード以降、新規配信を検出してnotificationStoreに追加
6. **購読送信**: チャンネルまたはsessionIdが変更されたら`subscribe_streams`メッセージを送信

### WebSocketメッセージ形式
#### 送信: subscribe_streams
```typescript
{
  type: 'subscribe_streams',
  youtubeChannels: string[],
  twitchChannels: string[],
  sessionId: string
}
```

#### 受信: stream_list_updated
```typescript
{
  type: 'stream_list_updated',
  platform: 'youtube' | 'twitch',
  streams: any[],
  changes: {
    added: string[],
    removed: string[]
  }
}
```

### 依存
- layoutStore
- notificationStore
- syncStore
- authStore（sessionId取得）
- websocketService

### 重要な仕様
- **初回ロードスキップ**: 初回ロード時は通知を生成しない
- **重複購読防止**: チャンネルとsessionIdが同じ場合は再送信しない
- **グローバル接続**: WebSocket接続はグローバルで1つのみ（複数フック間で共有）

## 7.12 useAnalytics (src/hooks/useAnalytics.ts)

**目的**: ユーザー行動のアナリティクストラッキング

### 機能

```typescript
export function useAnalytics() {
  // セッション開始（アプリ起動時に1度だけ）
  // 画面遷移を監視（popstate/hashchange）

  // レイアウト変更を追跡
  const trackLayout: (data: { preset: LayoutPreset; slotCount: number }) => void;

  // ボタンクリックを追跡
  const trackButton: (buttonType: ButtonType, metadata?: Record<string, any>) => void;

  // 機能使用を追跡
  const trackFeature: (featureType: FeatureType, metadata?: Record<string, any>) => void;

  // 配信アクションを追跡
  const trackStream: (data: { actionType: StreamActionType; platform: Platform; streamId?: string }) => void;

  // 認証アクションを追跡
  const trackAuth: (action: 'login' | 'logout' | 'failed', platform?: Platform) => void;

  return { trackLayout, trackButton, trackFeature, trackStream, trackAuth };
}
```

### 使用例

```typescript
const { trackButton, trackLayout, trackStream } = useAnalytics();

// ボタンクリック追跡
const handleClick = () => {
  trackButton('fullscreen_toggle', { enabled: true });
};

// レイアウト変更追跡
const handleLayoutChange = (preset: LayoutPreset) => {
  trackLayout({ preset, slotCount: 4 });
};

// 配信アクション追跡
const handleStreamAdd = (stream: Streamer) => {
  trackStream({
    actionType: 'add_stream',
    platform: stream.platform,
    streamId: stream.id
  });
};
```

### 追跡されるイベント

- **レイアウト変更**: プリセット切り替え、スロット数変更
- **ボタンクリック**: 全画面、ミュート、音量調整、検索など
- **機能使用**: データ使用量表示、音声同期、通知設定など
- **配信アクション**: 配信追加、削除、プラットフォーム切り替え
- **認証アクション**: ログイン、ログアウト、認証失敗
- **セッション**: セッション開始、ページビュー

### 特徴

- **自動セッション管理**: アプリ起動時にセッションを自動開始
- **画面遷移監視**: popstate/hashchangeイベントを監視してページビューをカウント
- **型安全**: すべてのイベントタイプが型定義されている
- **メタデータサポート**: 各イベントに任意のメタデータを追加可能
- **バックエンド送信**: アナリティクスデータはバックエンドに送信され、永続化される

## 7.13 フック設計のベストプラクティス

### 単一責任の原則
各フックは1つの明確な責務を持ちます。

### 副作用の管理
- useEffect内で副作用を管理
- クリーンアップ関数で確実にリソース解放

### エラーハンドリング
```typescript
const useDataFetching = (url: string) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(url);
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [url]);

  return { data, error, loading };
};
```

### 依存配列の適切な管理
- useEffectの依存配列を正確に指定
- ESLintの exhaustive-deps ルールを遵守
