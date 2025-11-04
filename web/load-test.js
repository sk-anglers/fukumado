import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// カスタムメトリクス
const errorRate = new Rate('errors');
const pageLoadTime = new Trend('page_load_time');

// 負荷テストの設定
export const options = {
  stages: [
    { duration: '2m', target: 10 },   // ウォームアップ: 2分で10ユーザー
    { duration: '5m', target: 50 },   // 負荷増加: 5分で50ユーザー
    { duration: '5m', target: 50 },   // 持続負荷: 50ユーザーを5分間維持
    { duration: '2m', target: 100 },  // ピーク負荷: 2分で100ユーザー
    { duration: '3m', target: 100 },  // ピーク維持: 100ユーザーを3分間維持
    { duration: '2m', target: 0 },    // クールダウン: 2分で0ユーザー
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'], // 95%のリクエストが3秒以内
    http_req_failed: ['rate<0.05'],    // エラー率5%未満
    errors: ['rate<0.05'],              // カスタムエラー率5%未満
  },
};

const BASE_URL = 'https://fukumado.jp';

export default function () {
  // グループ1: フロントエンドアクセス
  group('Frontend Access', function () {
    const startTime = Date.now();
    const res = http.get(BASE_URL);
    const loadTime = Date.now() - startTime;

    pageLoadTime.add(loadTime);

    const success = check(res, {
      'status is 200': (r) => r.status === 200,
      'page loads in < 3s': () => loadTime < 3000,
      'has correct content type': (r) => r.headers['Content-Type']?.includes('text/html'),
    });

    errorRate.add(!success);
  });

  // ユーザーの操作を模倣（ページ閲覧時間）
  sleep(2 + Math.random() * 3); // 2-5秒のランダムな待機時間
}

// テスト終了時のサマリー
export function handleSummary(data) {
  return {
    'load-test-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  const enableColors = options.enableColors || false;

  let summary = '\n' + indent + '========== Load Test Summary ==========\n';

  // HTTPリクエスト統計
  if (data.metrics.http_reqs) {
    summary += indent + `Total Requests: ${data.metrics.http_reqs.values.count}\n`;
    summary += indent + `Request Rate: ${data.metrics.http_reqs.values.rate.toFixed(2)}/s\n`;
  }

  // レスポンスタイム統計
  if (data.metrics.http_req_duration) {
    const duration = data.metrics.http_req_duration.values;
    summary += indent + `\nResponse Time:\n`;
    summary += indent + `  Average: ${duration.avg?.toFixed(2) ?? 'N/A'}ms\n`;
    summary += indent + `  Median: ${duration.med?.toFixed(2) ?? 'N/A'}ms\n`;
    summary += indent + `  95th percentile: ${duration['p(95)']?.toFixed(2) ?? 'N/A'}ms\n`;
    summary += indent + `  99th percentile: ${duration['p(99)']?.toFixed(2) ?? 'N/A'}ms\n`;
    summary += indent + `  Max: ${duration.max?.toFixed(2) ?? 'N/A'}ms\n`;
  }

  // エラー率
  if (data.metrics.http_req_failed) {
    const failRate = data.metrics.http_req_failed.values.rate * 100;
    summary += indent + `\nError Rate: ${failRate.toFixed(2)}%\n`;
  }

  // カスタムメトリクス
  if (data.metrics.errors) {
    const customErrorRate = data.metrics.errors.values.rate * 100;
    summary += indent + `Custom Error Rate: ${customErrorRate.toFixed(2)}%\n`;
  }

  summary += indent + '======================================\n';

  return summary;
}
