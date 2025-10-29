import { request, Dispatcher } from 'undici';
import { apiLogStore, ApiCallLog } from './apiLogStore';

/**
 * API呼び出しをトラッキングするラッパー
 */

interface TrackOptions {
  service: 'twitch' | 'youtube' | 'other';
  endpoint: string;
  includeResponseBody?: boolean;
  includeRequestBody?: boolean;
}

/**
 * HTTP リクエストをトラッキング
 */
export async function trackedRequest(
  url: string,
  options: Dispatcher.RequestOptions & { body?: string },
  trackOptions: TrackOptions
): Promise<Dispatcher.ResponseData> {
  const startTime = Date.now();
  const logId = apiLogStore.generateId();

  // リクエストヘッダーを記録用に変換
  const requestHeaders: Record<string, string> = {};
  if (options.headers) {
    if (Array.isArray(options.headers)) {
      for (let i = 0; i < options.headers.length; i += 2) {
        requestHeaders[options.headers[i] as string] = options.headers[i + 1] as string;
      }
    } else if (typeof options.headers === 'object') {
      Object.entries(options.headers).forEach(([key, value]) => {
        if (typeof value === 'string') {
          requestHeaders[key] = value;
        }
      });
    }
  }

  // URLからクエリパラメータを抽出
  const urlObj = new URL(url);
  const requestQuery: Record<string, string> = {};
  urlObj.searchParams.forEach((value, key) => {
    requestQuery[key] = value;
  });

  let log: ApiCallLog;

  try {
    const response = await request(url, options);
    const responseTime = Date.now() - startTime;

    // レスポンスヘッダーを記録
    const responseHeaders: Record<string, string> = {};
    Object.entries(response.headers).forEach(([key, value]) => {
      if (typeof value === 'string') {
        responseHeaders[key] = value;
      } else if (Array.isArray(value)) {
        responseHeaders[key] = value.join(', ');
      }
    });

    // レスポンスボディを読み取る（オプション）
    let responseBody: any = undefined;
    if (trackOptions.includeResponseBody) {
      try {
        const bodyText = await response.body.text();
        responseBody = JSON.parse(bodyText);
        // ボディを再利用可能にするため、新しいResponseを返す必要がある
        // ここでは簡略化のためログのみ記録
      } catch (e) {
        // JSON以外の場合やエラーの場合はスキップ
      }
    }

    // Twitchレート制限情報を抽出
    let rateLimit: ApiCallLog['rateLimit'] | undefined;
    if (trackOptions.service === 'twitch') {
      const limit = responseHeaders['ratelimit-limit'];
      const remaining = responseHeaders['ratelimit-remaining'];
      const reset = responseHeaders['ratelimit-reset'];

      if (limit && remaining && reset) {
        rateLimit = {
          limit: parseInt(limit, 10),
          remaining: parseInt(remaining, 10),
          reset: parseInt(reset, 10)
        };
      }
    }

    log = {
      id: logId,
      timestamp: new Date().toISOString(),
      service: trackOptions.service,
      endpoint: trackOptions.endpoint,
      method: (options.method || 'GET') as string,
      url,
      requestHeaders,
      requestQuery: Object.keys(requestQuery).length > 0 ? requestQuery : undefined,
      requestBody: trackOptions.includeRequestBody ? options.body : undefined,
      responseStatus: response.statusCode,
      responseHeaders,
      responseBody,
      responseTime,
      rateLimit
    };

    apiLogStore.addLog(log);

    console.log(`[API Tracker] ${trackOptions.service.toUpperCase()} ${options.method || 'GET'} ${trackOptions.endpoint} - ${response.statusCode} (${responseTime}ms)`);
    if (rateLimit) {
      console.log(`[API Tracker] Rate Limit: ${rateLimit.remaining}/${rateLimit.limit}`);
    }

    return response;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    log = {
      id: logId,
      timestamp: new Date().toISOString(),
      service: trackOptions.service,
      endpoint: trackOptions.endpoint,
      method: (options.method || 'GET') as string,
      url,
      requestHeaders,
      requestQuery: Object.keys(requestQuery).length > 0 ? requestQuery : undefined,
      requestBody: trackOptions.includeRequestBody ? options.body : undefined,
      responseStatus: 0,
      responseHeaders: {},
      responseTime,
      error: errorMessage
    };

    apiLogStore.addLog(log);

    console.error(`[API Tracker] ${trackOptions.service.toUpperCase()} ${options.method || 'GET'} ${trackOptions.endpoint} - ERROR (${responseTime}ms): ${errorMessage}`);

    throw error;
  }
}

/**
 * Twitch API専用ラッパー
 */
export async function trackedTwitchRequest(
  url: string,
  options: Dispatcher.RequestOptions & { body?: string },
  endpoint: string
): Promise<Dispatcher.ResponseData> {
  return trackedRequest(url, options, {
    service: 'twitch',
    endpoint,
    includeResponseBody: false, // 大量のデータを避けるため、デフォルトはfalse
    includeRequestBody: options.method === 'POST' || options.method === 'PUT'
  });
}

/**
 * YouTube API専用ラッパー
 */
export async function trackedYouTubeRequest(
  url: string,
  options: Dispatcher.RequestOptions & { body?: string },
  endpoint: string,
  quotaCost: number = 1
): Promise<Dispatcher.ResponseData> {
  const response = await trackedRequest(url, options, {
    service: 'youtube',
    endpoint,
    includeResponseBody: false,
    includeRequestBody: options.method === 'POST' || options.method === 'PUT'
  });

  // クォータコストを後から追加
  const logs = apiLogStore.getLogs({ limit: 1 });
  if (logs.logs.length > 0) {
    logs.logs[0].quotaCost = quotaCost;
  }

  return response;
}

/**
 * fetch() API用のトラッキングラッパー
 */
export async function trackedFetch(
  url: string | URL,
  options: RequestInit & { service: 'twitch' | 'youtube' | 'other'; endpoint: string } = { service: 'other', endpoint: 'unknown' }
): Promise<Response> {
  const startTime = Date.now();
  const logId = apiLogStore.generateId();
  const urlString = url.toString();

  // リクエストヘッダーを記録用に変換
  const requestHeaders: Record<string, string> = {};
  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        requestHeaders[key] = value;
      });
    } else if (Array.isArray(options.headers)) {
      for (let i = 0; i < options.headers.length; i += 2) {
        requestHeaders[options.headers[i] as string] = options.headers[i + 1] as string;
      }
    } else {
      Object.entries(options.headers).forEach(([key, value]) => {
        if (typeof value === 'string') {
          requestHeaders[key] = value;
        }
      });
    }
  }

  // URLからクエリパラメータを抽出
  const urlObj = new URL(urlString);
  const requestQuery: Record<string, string> = {};
  urlObj.searchParams.forEach((value, key) => {
    requestQuery[key] = value;
  });

  let log: ApiCallLog;

  try {
    const response = await fetch(url, options);
    const responseTime = Date.now() - startTime;

    // レスポンスヘッダーを記録
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // Twitchレート制限情報を抽出
    let rateLimit: ApiCallLog['rateLimit'] | undefined;
    if (options.service === 'twitch') {
      const limit = responseHeaders['ratelimit-limit'];
      const remaining = responseHeaders['ratelimit-remaining'];
      const reset = responseHeaders['ratelimit-reset'];

      if (limit && remaining && reset) {
        rateLimit = {
          limit: parseInt(limit, 10),
          remaining: parseInt(remaining, 10),
          reset: parseInt(reset, 10)
        };
      }
    }

    log = {
      id: logId,
      timestamp: new Date().toISOString(),
      service: options.service,
      endpoint: options.endpoint,
      method: (options.method || 'GET') as string,
      url: urlString,
      requestHeaders,
      requestQuery: Object.keys(requestQuery).length > 0 ? requestQuery : undefined,
      requestBody: options.body as string | undefined,
      responseStatus: response.status,
      responseHeaders,
      responseTime,
      rateLimit
    };

    apiLogStore.addLog(log);

    console.log(`[API Tracker] ${options.service.toUpperCase()} ${options.method || 'GET'} ${options.endpoint} - ${response.status} (${responseTime}ms)`);
    if (rateLimit) {
      console.log(`[API Tracker] Rate Limit: ${rateLimit.remaining}/${rateLimit.limit}`);
    }

    return response;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    log = {
      id: logId,
      timestamp: new Date().toISOString(),
      service: options.service,
      endpoint: options.endpoint,
      method: (options.method || 'GET') as string,
      url: urlString,
      requestHeaders,
      requestQuery: Object.keys(requestQuery).length > 0 ? requestQuery : undefined,
      requestBody: options.body as string | undefined,
      responseStatus: 0,
      responseHeaders: {},
      responseTime,
      error: errorMessage
    };

    apiLogStore.addLog(log);

    console.error(`[API Tracker] ${options.service.toUpperCase()} ${options.method || 'GET'} ${options.endpoint} - ERROR (${responseTime}ms): ${errorMessage}`);

    throw error;
  }
}
