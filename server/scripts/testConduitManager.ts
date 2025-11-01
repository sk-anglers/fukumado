/**
 * TwitchConduitManager 動作検証スクリプト
 *
 * このスクリプトは、TwitchConduitManagerの動作を検証します：
 * 1. マネージャー初期化
 * 2. WebSocketシャード作成
 * 3. 統計情報取得
 * 4. クリーンアップ
 */

import { twitchConduitManager } from '../src/services/twitchConduitManager';

async function testConduitManager() {
  console.log('='.repeat(60));
  console.log('TwitchConduitManager 動作検証');
  console.log('='.repeat(60));

  try {
    // Step 1: マネージャー初期化
    console.log('\n[Step 1] マネージャー初期化中...');
    await twitchConduitManager.initialize();
    console.log('✅ マネージャー初期化成功');

    // Step 2: WebSocketシャード作成
    console.log('\n[Step 2] WebSocketシャード作成中（シャード #0）...');
    await twitchConduitManager.createWebSocketShard('0');
    console.log('✅ シャード #0 作成成功');

    // 少し待機してシャードが安定するのを待つ
    console.log('\n[Wait] 5秒待機中...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 3: 統計情報取得
    console.log('\n[Step 3] 統計情報取得中...');
    const stats = await twitchConduitManager.getStats();
    console.log('✅ 統計情報取得成功:');
    console.log(JSON.stringify(stats, null, 2));

    console.log('\n✅ 検証成功！');
    console.log('TwitchConduitManagerが正常に動作しています。');

    console.log('\n次のステップ:');
    console.log('1. EventSubManagerとの統合');
    console.log('2. モード切り替え機能の実装');
    console.log('3. 実際のチャンネルでのテスト');

  } catch (error) {
    console.error('\n❌ 検証中にエラーが発生:', error);
    process.exit(1);
  } finally {
    // クリーンアップ
    console.log('\n[Cleanup] マネージャーをクリーンアップ中...');
    twitchConduitManager.disconnect();
    console.log('✅ クリーンアップ完了');

    // 終了
    console.log('\n' + '='.repeat(60));
    process.exit(0);
  }
}

// スクリプト実行
testConduitManager().catch(error => {
  console.error('\n❌ 予期しないエラーが発生しました:', error);
  process.exit(1);
});
