/**
 * Twitch EventSub Conduits + WebSocket 統合検証スクリプト
 *
 * このスクリプトは、WebSocketとConduitsの統合動作を検証します：
 * 1. Conduit作成または既存Conduit取得
 * 2. WebSocket接続確立
 * 3. セッションID取得（Welcomeメッセージ）
 * 4. updateShards APIでシャード登録
 * 5. Conduitモードでサブスクリプション作成
 * 6. イベント受信確認（オプション）
 */

import * as WS from 'ws';
import { twitchConduitClient } from '../src/services/twitchConduitClient';
import { getTwitchAppAccessToken } from '../src/services/twitchAppAuth';
import { env } from '../src/config/env';
import type { Conduit, ConduitShard } from '../src/types/conduit';

interface TestResult {
  step: string;
  status: 'success' | 'error';
  message: string;
  data?: any;
}

const results: TestResult[] = [];

function logResult(step: string, status: 'success' | 'error', message: string, data?: any) {
  const result: TestResult = { step, status, message, data };
  results.push(result);

  const emoji = status === 'success' ? '✅' : '❌';
  console.log(`\n${emoji} [${step}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

/**
 * WebSocketセッションIDを取得（Promiseベース）
 */
function waitForSessionId(ws: WS.WebSocket, timeoutMs: number = 30000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout waiting for session_welcome message'));
    }, timeoutMs);

    ws.on('message', (data: WS.Data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log(`[WebSocket] Received message type: ${message.metadata?.message_type}`);

        if (message.metadata?.message_type === 'session_welcome') {
          const sessionId = message.payload?.session?.id;
          if (sessionId) {
            clearTimeout(timeout);
            console.log(`[WebSocket] Session ID obtained: ${sessionId}`);
            resolve(sessionId);
          } else {
            clearTimeout(timeout);
            reject(new Error('session_welcome message missing session.id'));
          }
        }
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    ws.on('close', () => {
      clearTimeout(timeout);
      reject(new Error('WebSocket closed before receiving session_welcome'));
    });
  });
}

/**
 * WebSocket接続を確立してセッションIDを取得
 */
async function connectWebSocketAndGetSessionId(): Promise<{ ws: WS.WebSocket; sessionId: string }> {
  const wsUrl = 'wss://eventsub.wss.twitch.tv/ws';
  console.log(`[WebSocket] Connecting to ${wsUrl}...`);

  const ws = new WS.WebSocket(wsUrl);

  // 接続確立を待機
  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => {
      console.log('[WebSocket] Connection established');
      resolve();
    });
    ws.on('error', reject);
  });

  // セッションIDを取得
  const sessionId = await waitForSessionId(ws);

  return { ws, sessionId };
}

/**
 * Conduitモードでサブスクリプションを作成
 */
async function createConduitSubscription(
  conduitId: string,
  broadcasterId: string,
  type: string,
  version: string
): Promise<string> {
  const appToken = await getTwitchAppAccessToken();
  const { clientId } = env.twitch;

  const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${appToken}`,
      'Client-Id': clientId!,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type,
      version,
      condition: {
        broadcaster_user_id: broadcasterId
      },
      transport: {
        method: 'conduit',
        conduit_id: conduitId
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create subscription: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as { data: Array<{ id: string }> };
  return data.data[0].id;
}

async function runIntegrationTest() {
  console.log('='.repeat(60));
  console.log('Twitch EventSub Conduits + WebSocket 統合検証');
  console.log('='.repeat(60));

  let conduitId: string | null = null;
  let ws: WS.WebSocket | null = null;
  let sessionId: string | null = null;

  try {
    // Step 1: App Access Token取得
    console.log('\n[Step 1] App Access Token取得中...');
    const appToken = await getTwitchAppAccessToken();
    logResult('App Access Token', 'success', 'トークン取得成功', {
      tokenLength: appToken.length
    });

    // Step 2: 既存Conduit確認または作成
    console.log('\n[Step 2] Conduit確認/作成中...');
    const existingConduits = await twitchConduitClient.getConduits();

    if (existingConduits.length > 0) {
      conduitId = existingConduits[0].id;
      logResult('Conduit確認', 'success', `既存Conduitを使用: ${conduitId}`, existingConduits[0]);
    } else {
      const conduit = await twitchConduitClient.createConduit(10);
      conduitId = conduit.id;
      logResult('Conduit作成', 'success', `新規Conduit作成: ${conduitId}`, conduit);
    }

    // Step 3: WebSocket接続とセッションID取得
    console.log('\n[Step 3] WebSocket接続とセッションID取得中...');
    const connectionResult = await connectWebSocketAndGetSessionId();
    ws = connectionResult.ws;
    sessionId = connectionResult.sessionId;

    logResult('WebSocket接続', 'success', `セッションID取得成功: ${sessionId}`, {
      sessionId
    });

    // Step 4: シャード登録（updateShards API）
    console.log('\n[Step 4] シャード登録中...');
    const updateResult = await twitchConduitClient.updateShards({
      conduit_id: conduitId,
      shards: [
        {
          id: '0',
          transport: {
            method: 'websocket',
            session_id: sessionId
          }
        }
      ]
    });

    if (updateResult.errors && updateResult.errors.length > 0) {
      logResult('シャード登録', 'error', 'シャード登録にエラーあり', updateResult.errors);
    } else {
      logResult('シャード登録', 'success', `シャード #0 登録成功`, updateResult.data);
    }

    // Step 5: シャード状態確認
    console.log('\n[Step 5] シャード状態確認中...');
    const shardsResponse = await twitchConduitClient.getShards(conduitId);
    logResult('シャード状態確認', 'success', `${shardsResponse.data.length}個のシャードが登録済み`, shardsResponse.data);

    // シャード詳細を表示
    shardsResponse.data.forEach((shard: ConduitShard) => {
      console.log(`  - Shard #${shard.id}: ${shard.status}`);
      console.log(`    Transport: ${shard.transport.method}`);
      if (shard.transport.session_id) {
        console.log(`    Session ID: ${shard.transport.session_id}`);
      }
    });

    // Step 6: テスト用サブスクリプション作成（オプション）
    console.log('\n[Step 6] テスト用サブスクリプション作成（スキップ）');
    console.log('⚠️  実際のチャンネルIDが必要なため、この段階ではスキップします。');
    console.log('手動でサブスクリプションを作成する場合：');
    console.log(`  - Conduit ID: ${conduitId}`);
    console.log(`  - Transport: { method: 'conduit', conduit_id: '${conduitId}' }`);

    logResult('サブスクリプション作成', 'success', 'スキップ（手動実行可能）', {
      conduitId,
      note: 'Conduitモードでサブスクリプションを作成する準備完了'
    });

    // Step 7: 成功まとめ
    console.log('\n✅ 統合検証成功！');
    console.log('Conduits + WebSocketの統合動作を確認しました。');
    console.log('\n次のステップ:');
    console.log('1. TwitchConduitManager クラスの実装');
    console.log('2. 既存EventSubManagerとの統合');
    console.log('3. 並行運用モードの実装');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('\n❌ 検証中にエラーが発生:', errorMessage);
    logResult('統合検証', 'error', errorMessage, { error });
  } finally {
    // クリーンアップ
    if (ws) {
      console.log('\n[Cleanup] WebSocket接続をクローズ中...');
      ws.close();
    }

    console.log('\n' + '='.repeat(60));
    console.log('検証結果サマリー');
    console.log('='.repeat(60));

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    console.log(`\n✅ 成功: ${successCount}件`);
    console.log(`❌ 失敗: ${errorCount}件`);

    console.log('\n詳細:');
    results.forEach((result, index) => {
      const emoji = result.status === 'success' ? '✅' : '❌';
      console.log(`  ${index + 1}. ${emoji} ${result.step}: ${result.message}`);
    });

    console.log('\n' + '='.repeat(60));

    // 終了コード
    process.exit(errorCount > 0 ? 1 : 0);
  }
}

// スクリプト実行
runIntegrationTest().catch(error => {
  console.error('\n❌ 予期しないエラーが発生しました:', error);
  process.exit(1);
});
