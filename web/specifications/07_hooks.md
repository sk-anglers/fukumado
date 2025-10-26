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

## 7.10 フック設計のベストプラクティス

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
