# 15. セキュリティ仕様

このセクションでは、ふくまど！に実装されているセキュリティ対策の詳細を説明します。

---

## 15.1 セキュリティアーキテクチャ概要

### 多層防御戦略（Defense in Depth）

ふくまど！は、複数のセキュリティレイヤーを組み合わせた多層防御戦略を採用しています：

1. **ネットワーク層**: CORS、セキュリティヘッダー（Helmet）
2. **アプリケーション層**: OAuth 2.0、セッション管理、CSRF保護
3. **トランスポート層**: WebSocketセキュリティ、ハートビート
4. **DDoS対策層**: レート制限、IPブロックリスト、リクエストサイズ制限
5. **監視・検知層**: 異常検知、メトリクス収集、ロギング

### セキュリティ設計原則

- **最小権限の原則**: 必要最小限の権限のみを付与
- **安全なデフォルト**: デフォルト設定で安全性を確保
- **深い防御**: 複数のセキュリティレイヤーで保護
- **監視と記録**: すべての重要なイベントをログ記録
- **迅速な対応**: 異常検知時の自動対応（IPブロック等）

---

## 15.2 ネットワーク層セキュリティ

### 15.2.1 CORS（Cross-Origin Resource Sharing）

**設定**: `server/src/index.ts`

```typescript
cors({
  origin: [
    'http://localhost:5173',
    'http://192.168.11.18:5173',
    'http://127.0.0.1:5173'
  ],
  credentials: true
})
```

**ポイント**:
- ✅ **ホワイトリスト方式**: 許可されたオリジンのみアクセス可能
- ✅ **credentials有効**: Cookie、セッション情報の送信を許可
- ⚠️ **本番環境**: 本番URLを追加する必要あり

### 15.2.2 セキュリティヘッダー（Helmet）

**設定**: `server/src/middleware/security.ts`

#### CSP (Content Security Policy)

```typescript
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    scriptSrc: ["'self'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'", 'https://api.twitch.tv', 'https://id.twitch.tv', 'wss://eventsub.wss.twitch.tv'],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
  },
}
```

**保護内容**:
- XSS攻撃対策: スクリプトソースを制限
- データインジェクション対策: リソースソースを制限
- clickjacking対策: frameSrc を none に設定

#### HSTS (HTTP Strict Transport Security)

```typescript
hsts: {
  maxAge: 31536000,        // 1年間
  includeSubDomains: true, // サブドメインも含む
  preload: true,           // HSTSプリロードリストに登録可能
}
```

**保護内容**:
- HTTPS強制: ブラウザがHTTPSのみでアクセス
- 中間者攻撃対策: SSL/TLS通信の強制

---

## 15.3 DDoS攻撃対策

### 15.3.1 レート制限

**実装**: `server/src/middleware/security.ts`

#### API全般

```typescript
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1分
  max: 60,              // 最大60リクエスト
  standardHeaders: true,
  legacyHeaders: false,
})
```

- **制限**: 1分間に60リクエスト
- **適用範囲**: `/api/*` エンドポイント全般
- **超過時**: 429 Too Many Requests、60秒後に再試行可能

#### 認証エンドポイント

```typescript
export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1分
  max: 10,              // 最大10リクエスト
  skipSuccessfulRequests: true, // 成功したリクエストはカウント外
})
```

- **制限**: 1分間に10リクエスト（失敗のみカウント）
- **適用範囲**: `/auth/*` エンドポイント
- **目的**: ブルートフォース攻撃対策

#### WebSocket接続レート制限

```typescript
export const websocketRateLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1分
  max: 30,              // 最大30リクエスト
})
```

#### WebSocketメッセージレート制限

**実装**: `server/src/middleware/websocketSecurity.ts`

```typescript
private readonly maxMessagesPerSecond = 10; // 1秒あたり最大10メッセージ
private readonly messageWindowMs = 1000;    // 1秒
```

- **制限**: 1秒間に10メッセージ
- **適用範囲**: WebSocket経由のすべてのメッセージ
- **超過時**: エラーメッセージ送信、違反記録

### 15.3.2 リクエストサイズ制限

#### HTTPリクエスト

```typescript
export const validateRequestSize = (req, res, next) => {
  const contentLength = req.get('content-length');

  if (contentLength && parseInt(contentLength) > 100 * 1024) { // 100KB
    ipBlocklist.recordViolation(ip, 'large_request');
    res.status(413).json({ error: 'Request too large' });
    return;
  }
  next();
};
```

- **制限**: 100KB
- **超過時**: 413 Payload Too Large、違反記録

#### JSONボディ

```typescript
app.use(express.json({ limit: '10kb' }));
```

- **制限**: 10KB
- **適用範囲**: JSONパーサー全般

#### WebSocketメッセージ

```typescript
const messageSize = JSON.stringify(message).length;
if (messageSize > 1024 * 1024) { // 1MB
  return { valid: false, reason: 'Message too large' };
}
```

- **制限**: 1MB
- **超過時**: メッセージ拒否

### 15.3.3 IPブロックリスト管理

**実装**: `server/src/middleware/security.ts`

#### 自動ブロック

```typescript
class IPBlocklist {
  public recordViolation(ip: string, type: string): void {
    const count = (this.violationCount.get(ip) || 0) + 1;

    if (count >= 10) {
      // 10回以上の違反 → 1時間ブロック
      this.block(ip, 60 * 60 * 1000, `Multiple violations (${count})`);
    } else if (count >= 5) {
      // 5回以上の違反 → 10分ブロック
      this.block(ip, 10 * 60 * 1000, `Repeated violations (${count})`);
    }
  }
}
```

**ブロック条件**:
- 5回違反 → 10分ブロック
- 10回違反 → 1時間ブロック

**違反タイプ**:
- `large_request`: 100KB以上のリクエスト
- `ws_connection_limit`: WebSocket接続数制限超過
- `ws_message_rate`: WebSocketメッセージレート制限超過
- `suspicious_activity`: 不審なアクティビティ
- `repeated_auth_failure`: 認証失敗の繰り返し

#### ブロック解除

- **自動解除**: ブロック期限が過ぎると自動的に解除
- **違反カウントリセット**: 5分後に1回分減少

---

## 15.4 アプリケーション層セキュリティ

### 15.4.1 OAuth 2.0認証

#### CSRF対策（State パラメータ）

**実装**: `server/src/routes/auth.ts`

**Google OAuth**:
```typescript
// 認証開始
authRouter.get('/google', (req, res) => {
  const state = createState(); // ランダムな文字列生成
  req.session.oauthState = state; // セッションに保存
  const url = buildGoogleAuthUrl(state);
  res.redirect(url);
});

// コールバック
authRouter.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query;

  // state検証
  if (!state || typeof state !== 'string') {
    return res.status(400).json({ error: 'Missing state' });
  }
  if (!req.session.oauthState || req.session.oauthState !== state) {
    return res.status(400).json({ error: 'Invalid state' });
  }

  // state検証成功後、トークン交換処理
  // ...
});
```

**Twitch OAuth**: 同様に `req.session.twitchOauthState` で検証

**保護内容**:
- CSRF攻撃対策: stateパラメータによる検証
- セッション固定攻撃対策: ランダムなstate生成

#### トークン管理

**サーバーサイド保存**:
```typescript
req.session.googleTokens = {
  accessToken: tokenResponse.access_token,
  refreshToken: tokenResponse.refresh_token,
  scope: tokenResponse.scope,
  tokenType: tokenResponse.token_type,
  expiryDate: Date.now() + tokenResponse.expires_in * 1000
};
```

**特徴**:
- ✅ サーバーサイドセッションに保存（フロントエンドに非公開）
- ✅ リフレッシュトークンも保存（トークン更新用）
- ✅ 有効期限を記録（自動リフレッシュ用）

#### トークン自動リフレッシュ

```typescript
export const ensureGoogleAccessToken = async (req: Request): Promise<string | null> => {
  const tokens = req.session.googleTokens;
  if (!tokens) return null;

  // 有効期限の30秒前にリフレッシュ
  if (tokens.expiryDate > Date.now() - 30_000) {
    return tokens.accessToken;
  }

  // リフレッシュトークンを使用してトークンを更新
  if (!tokens.refreshToken) {
    return null;
  }

  try {
    const refreshed = await refreshAccessToken(tokens.refreshToken);
    req.session.googleTokens = {
      accessToken: refreshed.access_token,
      refreshToken: tokens.refreshToken,
      scope: refreshed.scope,
      tokenType: refreshed.token_type,
      expiryDate: Date.now() + refreshed.expires_in * 1000
    };
    return refreshed.access_token;
  } catch {
    req.session.googleTokens = undefined;
    return null;
  }
};
```

**特徴**:
- ✅ 自動リフレッシュ: 有効期限の30秒前に自動更新
- ✅ エラーハンドリング: リフレッシュ失敗時はセッションをクリア

#### OAuth認証完了画面セキュリティ

**実装**: `server/src/routes/auth.ts` (`/auth/success`)

```javascript
setTimeout(function() {
  // 別ウィンドウで開かれている場合は閉じる
  if (window.opener) {
    window.close();
  } else {
    // 同じウィンドウで開かれている場合はリダイレクト
    window.location.href = 'http://localhost:5173/';
  }
}, 3000);
```

**特徴**:
- ✅ ポップアップウィンドウ検出: `window.opener` による判定
- ✅ 3秒自動クローズ: ユーザー体験の向上
- ⚠️ `rel="noopener"` 未使用: 将来的な改善推奨

### 15.4.2 セッション管理

#### Cookie設定

**実装**: `server/src/index.ts`

```typescript
session({
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false, // ngrok使用時はfalseに設定
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7日間
  }
})
```

**セキュリティ設定**:
- ✅ **httpOnly**: JavaScriptからアクセス不可（XSS対策）
- ✅ **sameSite: lax**: CSRF対策（一部のクロスサイトリクエストをブロック）
- ✅ **maxAge: 7日間**: セッションの有効期限
- ⚠️ **secure: false**: 開発環境用、本番環境では `true` 必須

#### セッションセキュリティミドルウェア

**実装**: `server/src/middleware/sessionSecurity.ts`

##### セッション初期化

```typescript
export const initializeSession = (req, res, next) => {
  if (!session.security) {
    session.security = {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip || req.socket.remoteAddress,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      csrfToken: generateCSRFToken()
    };
  } else {
    // 既存セッションの最終アクティビティを更新
    session.security.lastActivity = Date.now();
  }
  next();
};
```

**記録内容**:
- User-Agent（セッションハイジャック検出用）
- IPアドレス（セッションハイジャック検出用）
- 作成時刻
- 最終アクティビティ時刻
- CSRFトークン

##### セッションハイジャック検出

```typescript
export const detectSessionHijacking = (req, res, next) => {
  const currentUserAgent = req.get('user-agent');
  const currentIP = req.ip || req.socket.remoteAddress;
  const sessionData = session.security;

  // User-Agentの検証
  if (sessionData.userAgent && currentUserAgent !== sessionData.userAgent) {
    console.warn('[Session Security] User-Agent mismatch detected');

    // セッションを破棄
    session.destroy((err) => {
      if (err) console.error('[Session Security] Failed to destroy session:', err);
    });

    res.status(403).json({
      error: 'Session hijacking detected. Please log in again.'
    });
    return;
  }

  // IPアドレスの検証（警告のみ、破棄はしない）
  if (sessionData.ipAddress && currentIP !== sessionData.ipAddress) {
    console.warn('[Session Security] IP address change detected');
    sessionData.ipAddress = currentIP; // IPアドレスを更新
  }

  next();
};
```

**保護内容**:
- ✅ User-Agent変更検出: セッションハイジャック攻撃を検出し、セッションを破棄
- ✅ IPアドレス変更検出: 警告のみ（モバイルネットワークやVPNでIPが変わる可能性を考慮）

##### セッションタイムアウト

```typescript
export const checkSessionTimeout = (maxInactiveMinutes: number = 30) => {
  return (req, res, next) => {
    const sessionData = session.security;
    const now = Date.now();
    const lastActivity = sessionData.lastActivity || 0;
    const inactiveMs = now - lastActivity;
    const maxInactiveMs = maxInactiveMinutes * 60 * 1000;

    if (inactiveMs > maxInactiveMs) {
      console.warn('[Session Security] Session timeout');

      // セッションを破棄
      session.destroy((err) => {
        if (err) console.error('[Session Security] Failed to destroy session:', err);
      });

      res.status(401).json({
        error: 'Session expired due to inactivity. Please log in again.'
      });
      return;
    }

    // 最終アクティビティを更新
    sessionData.lastActivity = now;
    next();
  };
};
```

**設定**:
- **タイムアウト**: 30分（デフォルト）
- **自動更新**: リクエストごとに最終アクティビティを更新

##### セッション固定攻撃対策

```typescript
export const regenerateSession = (req: Request): Promise<void> => {
  return new Promise((resolve, reject) => {
    const session = (req as any).session;

    // セッションを再生成
    session.regenerate((err: any) => {
      if (err) {
        reject(err);
        return;
      }

      // セキュリティ情報を再設定
      session.security = {
        userAgent: req.get('user-agent'),
        ipAddress: req.ip || req.socket.remoteAddress,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        csrfToken: generateCSRFToken()
      };

      resolve();
    });
  });
};
```

**使用タイミング**: ログイン成功時にセッションIDを再生成

##### CSRF保護

```typescript
export const csrfProtection = (req, res, next) => {
  // GET、HEAD、OPTIONSリクエストはスキップ
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }

  const sessionData = session.security;
  const tokenFromHeader = req.get('x-csrf-token');
  const tokenFromBody = req.body?.csrfToken;

  const providedToken = tokenFromHeader || tokenFromBody;

  if (!providedToken) {
    res.status(403).json({ error: 'CSRF token missing' });
    return;
  }

  if (providedToken !== sessionData.csrfToken) {
    res.status(403).json({ error: 'Invalid CSRF token' });
    return;
  }

  next();
};
```

**CSRF トークン生成**:
```typescript
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex'); // 32バイトランダム
}
```

**送信方法**:
- `X-CSRF-Token` ヘッダー
- または `csrfToken` フィールド（リクエストボディ）

**レスポンスに含める**:
```typescript
export const includeCSRFToken = (req, res, next) => {
  const session = (req as any).session;

  if (session && session.security) {
    const sessionData = session.security;
    res.setHeader('X-CSRF-Token', sessionData.csrfToken || '');
  }

  next();
};
```

---

## 15.5 WebSocketセキュリティ

### 15.5.1 接続管理

**実装**: `server/src/middleware/websocketSecurity.ts`

#### 接続数制限

```typescript
class WebSocketConnectionManager {
  private readonly maxConnectionsPerIP = 5; // 同一IPから最大5接続

  public canConnect(ip: string): { allowed: boolean; reason?: string } {
    // IPブロックリストチェック
    if (ipBlocklist.isBlocked(ip)) {
      return { allowed: false, reason: 'IP is blocked' };
    }

    const currentConnections = this.connectionsPerIP.get(ip) || 0;

    if (currentConnections >= this.maxConnectionsPerIP) {
      ipBlocklist.recordViolation(ip, 'ws_connection_limit');
      return { allowed: false, reason: 'Too many connections from this IP' };
    }

    return { allowed: true };
  }
}
```

**制限**: 同一IPから最大5接続

#### ハートビート（Ping/Pong）

```typescript
export class WebSocketHeartbeat {
  private readonly pingInterval = 30000; // 30秒
  private readonly pongTimeout = 5000;   // 5秒

  public start(ws: WebSocket): void {
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();

        // Pongが返ってこない場合は接続を切断
        const timeout = setTimeout(() => {
          console.warn('[WebSocket Heartbeat] No pong received, terminating connection');
          ws.terminate();
        }, this.pongTimeout);

        // Pongを受信したらタイムアウトをクリア
        ws.once('pong', () => {
          clearTimeout(timeout);
        });
      }
    }, this.pingInterval);
  }
}
```

**動作**:
- 30秒ごとにPingを送信
- 5秒以内にPongが返ってこない場合は接続を切断
- 不正な接続や応答不能な接続を自動的に切断

### 15.5.2 メッセージセキュリティ

#### メッセージ検証

```typescript
export function validateWebSocketMessage(message: any): { valid: boolean; reason?: string } {
  // メッセージタイプのホワイトリスト
  const allowedTypes = ['subscribe', 'subscribe_streams', 'unsubscribe'];

  if (!message.type) {
    return { valid: false, reason: 'Missing message type' };
  }

  if (!allowedTypes.includes(message.type)) {
    return { valid: false, reason: `Invalid message type: ${message.type}` };
  }

  // メッセージサイズチェック（1MB制限）
  const messageSize = JSON.stringify(message).length;
  if (messageSize > 1024 * 1024) {
    return { valid: false, reason: 'Message too large' };
  }

  // タイプ別の検証
  switch (message.type) {
    case 'subscribe':
      if (!Array.isArray(message.channels)) {
        return { valid: false, reason: 'Invalid channels format' };
      }
      if (message.channels.length > 100) {
        return { valid: false, reason: 'Too many channels' };
      }
      break;

    case 'subscribe_streams':
      const totalChannels = (message.youtubeChannels?.length || 0) + (message.twitchChannels?.length || 0);
      if (totalChannels > 200) {
        return { valid: false, reason: 'Too many channels' };
      }
      break;
  }

  return { valid: true };
}
```

**検証項目**:
- タイプホワイトリスト: `subscribe`, `subscribe_streams`, `unsubscribe`
- メッセージサイズ: 1MB制限
- チャンネル数制限: 最大100（subscribe）、200（subscribe_streams）

#### メッセージレート制限

```typescript
public canSendMessage(ip: string): { allowed: boolean; reason?: string } {
  const now = new Date();
  const record = this.messageCountPerIP.get(ip);

  if (!record || record.resetAt < now) {
    // 新しいウィンドウを開始
    this.messageCountPerIP.set(ip, {
      count: 1,
      resetAt: new Date(now.getTime() + this.messageWindowMs),
    });
    return { allowed: true };
  }

  if (record.count >= this.maxMessagesPerSecond) {
    ipBlocklist.recordViolation(ip, 'ws_message_rate');
    return { allowed: false, reason: 'Too many messages per second' };
  }

  record.count++;
  return { allowed: true };
}
```

**制限**: 1秒あたり10メッセージ

---

## 15.6 異常検知・監視

### 15.6.1 異常検知サービス

**実装**: `server/src/services/anomalyDetection.ts`

#### トラフィック急増検出

```typescript
private checkTrafficSpike(): void {
  // 過去10分間の平均リクエスト数を計算
  const recentMetrics = this.trafficMetrics.slice(-10);
  const avgRequests = recentMetrics.reduce((sum, m) => sum + m.requestCount, 0) / recentMetrics.length;

  // 現在のリクエスト数が平均の3倍以上
  if (this.currentMetrics.requestCount > avgRequests * this.thresholds.trafficSpikeMultiplier) {
    this.createAlert({
      type: 'traffic_spike',
      severity: 'medium',
      ip: 'multiple',
      description: `Traffic spike detected: ${this.currentMetrics.requestCount} requests (avg: ${avgRequests.toFixed(0)})`,
      metadata: {
        currentRequests: this.currentMetrics.requestCount,
        averageRequests: avgRequests,
        multiplier: (this.currentMetrics.requestCount / avgRequests).toFixed(2)
      }
    });
  }
}
```

**閾値**: 過去平均の3倍以上

#### エラー急増検出

```typescript
// エラー急増チェック
if (this.currentMetrics.errorCount >= this.thresholds.errorSpikeThreshold) {
  this.createAlert({
    type: 'error_spike',
    severity: 'high',
    ip: 'multiple',
    description: `Error spike detected: ${this.currentMetrics.errorCount} errors in 1 minute`,
    metadata: {
      errorCount: this.currentMetrics.errorCount
    }
  });
}
```

**閾値**: 1分間に10件以上のエラー

#### 不審なアクティビティ検出

```typescript
private checkSuspiciousActivity(ip: string, activity: IPActivity): void {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

  // 1分間に100リクエスト以上
  if (activity.firstRequestTime > oneMinuteAgo && activity.requestCount >= this.thresholds.suspiciousRequestThreshold) {
    this.createAlert({
      type: 'suspicious_pattern',
      severity: 'high',
      ip,
      description: `Suspicious request pattern: ${activity.requestCount} requests in 1 minute`,
      metadata: {
        requestCount: activity.requestCount,
        errorCount: activity.errorCount,
        uniqueEndpoints: activity.endpoints.size
      }
    });

    // IPをブロック
    ipBlocklist.recordViolation(ip, 'suspicious_activity');
  }

  // エラー率が50%以上
  const errorRate = activity.errorCount / activity.requestCount;
  if (activity.requestCount >= 10 && errorRate >= 0.5) {
    this.createAlert({
      type: 'suspicious_pattern',
      severity: 'medium',
      ip,
      description: `High error rate: ${(errorRate * 100).toFixed(0)}%`,
      metadata: {
        errorRate: errorRate.toFixed(2),
        errorCount: activity.errorCount,
        totalRequests: activity.requestCount
      }
    });
  }
}
```

**閾値**:
- 1分間に100リクエスト以上
- エラー率が50%以上（10リクエスト以上の場合）

#### 認証失敗監視

```typescript
public recordAuthFailure(ip: string, username?: string): void {
  const failure = this.authFailures.get(ip) || { count: 0, lastFailure: new Date() };
  failure.count++;
  failure.lastFailure = new Date();
  this.authFailures.set(ip, failure);

  // 閾値を超えた場合（5分間に5回以上）
  if (failure.count >= this.thresholds.authFailureThreshold) {
    this.createAlert({
      type: 'failed_auth',
      severity: 'high',
      ip,
      description: `Multiple authentication failures detected (${failure.count} attempts)`,
      metadata: { username, failureCount: failure.count }
    });

    // IPをブロック
    ipBlocklist.recordViolation(ip, 'repeated_auth_failure');
  }
}
```

**閾値**: 5分間に5回以上の認証失敗

#### 異常なエンドポイントアクセス検出

```typescript
private checkUnusualEndpoint(ip: string, path: string): void {
  const activity = this.ipActivity.get(ip);
  if (!activity) return;

  const endpointCount = activity.endpoints.get(path) || 0;

  if (endpointCount >= this.thresholds.unusualEndpointThreshold) {
    this.createAlert({
      type: 'unusual_endpoint',
      severity: 'medium',
      ip,
      description: `Repeated access to non-existent endpoint: ${path} (${endpointCount} times)`,
      metadata: {
        endpoint: path,
        accessCount: endpointCount
      }
    });
  }
}
```

**閾値**: 404エラーが10回以上

#### アラートの重要度

- **low**: 軽微な異常、情報提供レベル
- **medium**: 注意が必要な異常、監視強化
- **high**: 深刻な異常、即座に対応が必要
- **critical**: 緊急対応が必要な異常

### 15.6.2 メトリクス収集

**実装**: `server/src/services/metricsCollector.ts`

#### Prometheus形式

```typescript
public getPrometheusMetrics(): string {
  const lines: string[] = [];

  // カウンター
  lines.push('# TYPE http_requests_total counter');
  lines.push(`http_requests_total ${counter.value}`);

  // ゲージ
  lines.push('# TYPE websocket_connections gauge');
  lines.push(`websocket_connections ${gauge.value}`);

  // ヒストグラム
  lines.push('# TYPE http_request_duration_ms histogram');
  lines.push(`http_request_duration_ms_sum ${histogram.sum}`);
  lines.push(`http_request_duration_ms_count ${histogram.count}`);

  return lines.join('\n');
}
```

#### カウンター（増加のみ）

- `http_requests_total`: HTTPリクエスト総数
- `http_errors_total`: HTTPエラー総数
- `websocket_messages_total`: WebSocketメッセージ総数
- `security_alerts_total`: セキュリティアラート総数
- `rate_limit_violations_total`: レート制限違反総数

#### ゲージ（増減する値）

- `websocket_connections`: WebSocket接続数

#### ヒストグラム（分布を記録）

- `http_request_duration_ms`: HTTPリクエストのレスポンス時間（ミリ秒）

**バケット定義**: [10, 50, 100, 200, 500, 1000, 2000, 5000]

### 15.6.3 ロギング

**実装**: `server/src/middleware/logging.ts`

#### リクエストログ

```typescript
export const requestLogger = (req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.path} - ${req.ip}`);
  next();
};
```

#### アクセス統計

```typescript
export const recordAccessStats = (req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`[HTTP] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });

  next();
};
```

#### セキュリティログ

```typescript
export class SecurityLogger {
  public static logBlockedRequest(ip: string, reason: string, endpoint: string, metadata: any): void {
    console.warn(`[Security] Blocked request from ${ip} - Reason: ${reason} - Endpoint: ${endpoint}`, metadata);
  }

  public static logAnomalousActivity(ip: string, type: string, metadata: any): void {
    console.warn(`[Security] Anomalous activity from ${ip} - Type: ${type}`, metadata);
  }
}
```

---

## 15.7 脅威モデル

### 15.7.1 対応済みの脅威

| 脅威 | 対策 | 実装状況 |
|---|---|---|
| **XSS攻撃** | CSP（Content Security Policy） | ✅ 実装済み |
| **CSRF攻撃** | State パラメータ、CSRFトークン | ✅ 実装済み |
| **セッションハイジャック** | User-Agent検証、セッション再生成 | ✅ 実装済み |
| **セッション固定攻撃** | ログイン時のセッションID再生成 | ✅ 実装済み |
| **ブルートフォース攻撃** | レート制限（認証: 10req/min）、IPブロック | ✅ 実装済み |
| **DDoS攻撃** | レート制限、リクエストサイズ制限、IPブロック | ✅ 実装済み |
| **リプレイ攻撃** | トークン有効期限、自動リフレッシュ | ✅ 実装済み |
| **中間者攻撃** | HSTS（HTTPS強制） | ✅ 実装済み |
| **Clickjacking** | CSP（frameSrc: none） | ✅ 実装済み |
| **データインジェクション** | CSP（リソースソース制限） | ✅ 実装済み |
| **不正なWebSocket接続** | 接続数制限、ハートビート、メッセージ検証 | ✅ 実装済み |
| **大量リクエスト攻撃** | レート制限、異常検知 | ✅ 実装済み |

### 15.7.2 残存リスク

| 脅威 | 現状 | 推奨対策 |
|---|---|---|
| **本番環境のHTTPS未設定** | 開発環境では`secure: false` | ⚠️ 本番環境では`secure: true`に設定 |
| **セッションストアのメモリ使用** | メモリベースのセッション管理 | ⚠️ Redis Session Storeの導入 |
| **`rel="noopener"` 未使用** | OAuth認証ポップアップ | ⚠️ `window.open(url, '_blank', 'noopener,noreferrer')` |
| **レート制限の永続化なし** | メモリベースのレート制限 | ⚠️ Redis等で永続化 |
| **アクセスログの永続化なし** | コンソール出力のみ | ⚠️ ログファイルまたはログ管理サービス |

---

## 15.8 セキュリティ監査チェックリスト

### 15.8.1 実装済み ✅

#### 認証・認可
- ✅ OAuth 2.0 CSRF対策（State パラメータ）
- ✅ セッションCookie（httpOnly, sameSite）
- ✅ アクセストークンのサーバーサイド管理
- ✅ トークン自動リフレッシュ（30秒前）
- ✅ セッションハイジャック検出（User-Agent検証）
- ✅ セッションタイムアウト（30分非アクティブ）
- ✅ CSRF保護（POSTリクエスト）

#### ネットワーク層
- ✅ CORS設定（ホワイトリスト方式）
- ✅ セキュリティヘッダー（Helmet）
- ✅ CSP（Content Security Policy）
- ✅ HSTS（HTTP Strict Transport Security）

#### DDoS対策
- ✅ レート制限（API: 60req/min、認証: 10req/min）
- ✅ リクエストサイズ制限（HTTP: 100KB、JSON: 10KB、WS: 1MB）
- ✅ IPブロックリスト管理（自動ブロック）
- ✅ WebSocket接続数制限（5接続/IP）
- ✅ WebSocketメッセージレート制限（10msg/sec）

#### WebSocketセキュリティ
- ✅ 接続数制限
- ✅ メッセージ検証（タイプホワイトリスト）
- ✅ ハートビート（Ping/Pong）
- ✅ チャンネル数制限（100/200チャンネル）

#### 監視・ロギング
- ✅ 異常検知サービス（トラフィック急増、エラー急増、不審なアクティビティ）
- ✅ メトリクス収集（Prometheus形式）
- ✅ リクエストログ
- ✅ セキュリティログ

#### その他
- ✅ Webhook署名検証（Twitch EventSub）

### 15.8.2 要改善 ⚠️

#### 本番環境
- ⚠️ **HTTPS強制**: 本番環境での`secure: true`設定
- ⚠️ **HTTPS強制リダイレクト**: HTTPからHTTPSへの自動リダイレクト
- ⚠️ **セッションストア**: Redis Session Storeの導入
- ⚠️ **レート制限の永続化**: Redis等での永続化

#### セキュリティヘッダー
- ⚠️ **`rel="noopener"`**: OAuth認証ポップアップで使用推奨

#### ロギング
- ⚠️ **ログの永続化**: ログファイルまたはログ管理サービス
- ⚠️ **ログローテーション**: ログファイルのサイズ管理

#### 監視
- ⚠️ **アラート通知**: Slack、Emailなどへの通知機能
- ⚠️ **ダッシュボード**: Grafana等での可視化

#### その他
- ⚠️ **バックアップ**: セッションデータのバックアップ
- ⚠️ **災害復旧計画**: インシデント対応手順の文書化

---

## 15.9 セキュリティインシデント対応

### 15.9.1 インシデント検知

**自動検知**:
- 異常検知サービスによる自動アラート生成
- IPブロックリストによる自動ブロック
- メトリクス収集による異常値検知

**手動検知**:
- ログの定期確認
- ユーザーからの報告

### 15.9.2 対応手順

#### レベル1: 低リスク（情報提供）
- **例**: トラフィック軽微な増加、低頻度の認証失敗
- **対応**: ログ記録、監視継続

#### レベル2: 中リスク（注意が必要）
- **例**: トラフィック急増、高エラー率、異常なエンドポイントアクセス
- **対応**: ログ詳細確認、IPブロック検討、監視強化

#### レベル3: 高リスク（即座に対応）
- **例**: 不審なアクティビティ、認証失敗の繰り返し、DDoS攻撃の兆候
- **対応**:
  1. IPブロック（自動実行済み）
  2. ログ詳細分析
  3. 必要に応じてサービス一時停止
  4. 管理者への通知
  5. セキュリティパッチの適用

#### レベル4: 緊急（クリティカル）
- **例**: サービス停止、データ漏洩の可能性
- **対応**:
  1. 即座にサービス停止
  2. インシデント対応チーム招集
  3. 影響範囲の特定
  4. セキュリティパッチの緊急適用
  5. ユーザーへの通知
  6. 事後分析と改善

---

## 15.10 セキュリティベストプラクティス

### 15.10.1 開発時

1. **最小権限の原則**: 必要最小限の権限のみを付与
2. **安全なデフォルト**: デフォルト設定で安全性を確保
3. **入力検証**: すべてのユーザー入力を検証
4. **出力エスケープ**: XSS対策のためHTMLエスケープ
5. **秘密情報の管理**: 環境変数やシークレットマネージャーを使用
6. **依存関係の管理**: 定期的なパッケージ更新、脆弱性スキャン
7. **コードレビュー**: セキュリティ観点でのコードレビュー

### 15.10.2 運用時

1. **定期的なセキュリティ監査**: 四半期ごとのセキュリティチェック
2. **ログの定期確認**: 週次でのログ分析
3. **インシデント対応訓練**: 年次での訓練実施
4. **セキュリティパッチの適用**: 緊急パッチは24時間以内、通常パッチは1週間以内
5. **バックアップの実施**: 日次でのデータバックアップ
6. **災害復旧計画**: 年次での見直し
7. **セキュリティ教育**: 開発者向けの定期的なセキュリティトレーニング

---

## 15.11 参考資料

### セキュリティ標準
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/
- CWE/SANS Top 25: https://cwe.mitre.org/top25/

### OAuth 2.0
- RFC 6749: https://tools.ietf.org/html/rfc6749
- OAuth 2.0 Security Best Practices: https://tools.ietf.org/html/draft-ietf-oauth-security-topics

### セキュリティヘッダー
- Helmet.js: https://helmetjs.github.io/
- CSP Evaluator: https://csp-evaluator.withgoogle.com/

### WebSocket
- WebSocket Security: https://tools.ietf.org/html/rfc6455#section-10

---

**© 2025 ふくまど！ All rights reserved.**
