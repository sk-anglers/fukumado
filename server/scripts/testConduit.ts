/**
 * Twitch EventSub Conduits 動作検証スクリプト
 *
 * このスクリプトは本番環境でConduitsの動作を検証します。
 * - Conduit作成
 * - シャード情報取得
 * - Conduit削除（オプション）
 */

import { twitchConduitClient } from '../src/services/twitchConduitClient';
import { getTwitchAppAccessToken } from '../src/services/twitchAppAuth';

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

async function verifyConduits() {
  console.log('='.repeat(60));
  console.log('Twitch EventSub Conduits 動作検証');
  console.log('='.repeat(60));

  // Step 1: App Access Token取得
  try {
    console.log('\n[Step 1] App Access Token取得中...');
    const token = await getTwitchAppAccessToken();
    logResult('App Access Token', 'success', 'トークン取得成功', {
      tokenLength: token.length,
      tokenPrefix: token.substring(0, 10) + '...'
    });
  } catch (error) {
    logResult('App Access Token', 'error', 'トークン取得失敗', {
      error: error instanceof Error ? error.message : String(error)
    });
    return;
  }

  // Step 2: 既存Conduit一覧取得
  try {
    console.log('\n[Step 2] 既存Conduit一覧取得中...');
    const existingConduits = await twitchConduitClient.getConduits();
    logResult('既存Conduit確認', 'success', `${existingConduits.length}個のConduitが存在`, existingConduits);

    if (existingConduits.length > 0) {
      console.log('\n⚠️  既にConduitが存在します。');
      console.log('このスクリプトは新規Conduit作成をスキップし、既存Conduitの情報のみ取得します。');

      // 既存Conduitのシャード情報を取得
      for (const conduit of existingConduits) {
        try {
          console.log(`\n[Step 3] Conduit ${conduit.id} のシャード情報取得中...`);
          const shardsResponse = await twitchConduitClient.getShards(conduit.id);
          logResult(`Conduit ${conduit.id} シャード情報`, 'success',
            `${shardsResponse.data.length}個のシャードが存在`,
            shardsResponse.data);
        } catch (error) {
          logResult(`Conduit ${conduit.id} シャード情報`, 'error', 'シャード情報取得失敗', {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      console.log('\n📊 検証完了（既存Conduitの確認のみ）');
      printSummary();
      return;
    }
  } catch (error) {
    logResult('既存Conduit確認', 'error', 'Conduit一覧取得失敗', {
      error: error instanceof Error ? error.message : String(error)
    });
    return;
  }

  // Step 3: テスト用Conduit作成
  let testConduitId: string | null = null;
  try {
    console.log('\n[Step 3] テスト用Conduit作成中（シャード数: 1）...');
    const conduit = await twitchConduitClient.createConduit(1);
    testConduitId = conduit.id;
    logResult('Conduit作成', 'success', 'Conduit作成成功', conduit);
  } catch (error) {
    logResult('Conduit作成', 'error', 'Conduit作成失敗', {
      error: error instanceof Error ? error.message : String(error)
    });
    console.log('\n📊 検証完了（Conduit作成で失敗）');
    printSummary();
    return;
  }

  // Step 4: 作成したConduitのシャード情報取得
  if (testConduitId) {
    try {
      console.log(`\n[Step 4] Conduit ${testConduitId} のシャード情報取得中...`);
      const shardsResponse = await twitchConduitClient.getShards(testConduitId);
      logResult('シャード情報取得', 'success', `${shardsResponse.data.length}個のシャードが存在`, shardsResponse);
    } catch (error) {
      logResult('シャード情報取得', 'error', 'シャード情報取得失敗', {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Step 5: Conduit削除（オプション）
    console.log('\n[Step 5] テスト用Conduitの削除...');
    console.log('⚠️  注意: 本番環境でConduitsを使用する予定がある場合は、削除しないでください。');
    console.log('削除する場合は、手動で以下のコマンドを実行してください:');
    console.log(`  twitchConduitClient.deleteConduit('${testConduitId}')`);

    // 自動削除はしない（本番環境での誤削除を防ぐため）
    logResult('Conduit削除', 'success', 'Conduit削除はスキップしました（手動で削除可能）', { conduitId: testConduitId });
  }

  console.log('\n📊 検証完了');
  printSummary();
}

function printSummary() {
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
}

// スクリプト実行
verifyConduits().catch(error => {
  console.error('\n❌ 予期しないエラーが発生しました:', error);
  process.exit(1);
});
