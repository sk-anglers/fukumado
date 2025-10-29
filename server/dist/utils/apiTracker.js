"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackedRequest = trackedRequest;
exports.trackedTwitchRequest = trackedTwitchRequest;
exports.trackedYouTubeRequest = trackedYouTubeRequest;
exports.trackedFetch = trackedFetch;
const undici_1 = require("undici");
const apiLogStore_1 = require("./apiLogStore");
/**
 * HTTP リクエストをトラッキング
 */
async function trackedRequest(url, options, trackOptions) {
    const startTime = Date.now();
    const logId = apiLogStore_1.apiLogStore.generateId();
    // リクエストヘッダーを記録用に変換
    const requestHeaders = {};
    if (options.headers) {
        if (Array.isArray(options.headers)) {
            for (let i = 0; i < options.headers.length; i += 2) {
                requestHeaders[options.headers[i]] = options.headers[i + 1];
            }
        }
        else if (typeof options.headers === 'object') {
            Object.entries(options.headers).forEach(([key, value]) => {
                if (typeof value === 'string') {
                    requestHeaders[key] = value;
                }
            });
        }
    }
    // URLからクエリパラメータを抽出
    const urlObj = new URL(url);
    const requestQuery = {};
    urlObj.searchParams.forEach((value, key) => {
        requestQuery[key] = value;
    });
    let log;
    try {
        const response = await (0, undici_1.request)(url, options);
        const responseTime = Date.now() - startTime;
        // レスポンスヘッダーを記録
        const responseHeaders = {};
        Object.entries(response.headers).forEach(([key, value]) => {
            if (typeof value === 'string') {
                responseHeaders[key] = value;
            }
            else if (Array.isArray(value)) {
                responseHeaders[key] = value.join(', ');
            }
        });
        // レスポンスボディを読み取る（オプション）
        let responseBody = undefined;
        if (trackOptions.includeResponseBody) {
            try {
                const bodyText = await response.body.text();
                responseBody = JSON.parse(bodyText);
                // ボディを再利用可能にするため、新しいResponseを返す必要がある
                // ここでは簡略化のためログのみ記録
            }
            catch (e) {
                // JSON以外の場合やエラーの場合はスキップ
            }
        }
        // Twitchレート制限情報を抽出
        let rateLimit;
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
            method: (options.method || 'GET'),
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
        apiLogStore_1.apiLogStore.addLog(log);
        console.log(`[API Tracker] ${trackOptions.service.toUpperCase()} ${options.method || 'GET'} ${trackOptions.endpoint} - ${response.statusCode} (${responseTime}ms)`);
        if (rateLimit) {
            console.log(`[API Tracker] Rate Limit: ${rateLimit.remaining}/${rateLimit.limit}`);
        }
        return response;
    }
    catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        log = {
            id: logId,
            timestamp: new Date().toISOString(),
            service: trackOptions.service,
            endpoint: trackOptions.endpoint,
            method: (options.method || 'GET'),
            url,
            requestHeaders,
            requestQuery: Object.keys(requestQuery).length > 0 ? requestQuery : undefined,
            requestBody: trackOptions.includeRequestBody ? options.body : undefined,
            responseStatus: 0,
            responseHeaders: {},
            responseTime,
            error: errorMessage
        };
        apiLogStore_1.apiLogStore.addLog(log);
        console.error(`[API Tracker] ${trackOptions.service.toUpperCase()} ${options.method || 'GET'} ${trackOptions.endpoint} - ERROR (${responseTime}ms): ${errorMessage}`);
        throw error;
    }
}
/**
 * Twitch API専用ラッパー
 */
async function trackedTwitchRequest(url, options, endpoint) {
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
async function trackedYouTubeRequest(url, options, endpoint, quotaCost = 1) {
    const response = await trackedRequest(url, options, {
        service: 'youtube',
        endpoint,
        includeResponseBody: false,
        includeRequestBody: options.method === 'POST' || options.method === 'PUT'
    });
    // クォータコストを後から追加
    const logs = apiLogStore_1.apiLogStore.getLogs({ limit: 1 });
    if (logs.logs.length > 0) {
        logs.logs[0].quotaCost = quotaCost;
    }
    return response;
}
/**
 * fetch() API用のトラッキングラッパー
 */
async function trackedFetch(url, options = { service: 'other', endpoint: 'unknown' }) {
    const startTime = Date.now();
    const logId = apiLogStore_1.apiLogStore.generateId();
    const urlString = url.toString();
    // リクエストヘッダーを記録用に変換
    const requestHeaders = {};
    if (options.headers) {
        if (options.headers instanceof Headers) {
            options.headers.forEach((value, key) => {
                requestHeaders[key] = value;
            });
        }
        else if (Array.isArray(options.headers)) {
            for (let i = 0; i < options.headers.length; i += 2) {
                const key = options.headers[i];
                const value = options.headers[i + 1];
                if (typeof key === 'string' && typeof value === 'string') {
                    requestHeaders[key] = value;
                }
            }
        }
        else {
            Object.entries(options.headers).forEach(([key, value]) => {
                if (typeof value === 'string') {
                    requestHeaders[key] = value;
                }
            });
        }
    }
    // URLからクエリパラメータを抽出
    const urlObj = new URL(urlString);
    const requestQuery = {};
    urlObj.searchParams.forEach((value, key) => {
        requestQuery[key] = value;
    });
    let log;
    try {
        const response = await fetch(url, options);
        const responseTime = Date.now() - startTime;
        // レスポンスヘッダーを記録
        const responseHeaders = {};
        response.headers.forEach((value, key) => {
            responseHeaders[key] = value;
        });
        // Twitchレート制限情報を抽出
        let rateLimit;
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
            method: (options.method || 'GET'),
            url: urlString,
            requestHeaders,
            requestQuery: Object.keys(requestQuery).length > 0 ? requestQuery : undefined,
            requestBody: options.body,
            responseStatus: response.status,
            responseHeaders,
            responseTime,
            rateLimit
        };
        apiLogStore_1.apiLogStore.addLog(log);
        console.log(`[API Tracker] ${options.service.toUpperCase()} ${options.method || 'GET'} ${options.endpoint} - ${response.status} (${responseTime}ms)`);
        if (rateLimit) {
            console.log(`[API Tracker] Rate Limit: ${rateLimit.remaining}/${rateLimit.limit}`);
        }
        return response;
    }
    catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        log = {
            id: logId,
            timestamp: new Date().toISOString(),
            service: options.service,
            endpoint: options.endpoint,
            method: (options.method || 'GET'),
            url: urlString,
            requestHeaders,
            requestQuery: Object.keys(requestQuery).length > 0 ? requestQuery : undefined,
            requestBody: options.body,
            responseStatus: 0,
            responseHeaders: {},
            responseTime,
            error: errorMessage
        };
        apiLogStore_1.apiLogStore.addLog(log);
        console.error(`[API Tracker] ${options.service.toUpperCase()} ${options.method || 'GET'} ${options.endpoint} - ERROR (${responseTime}ms): ${errorMessage}`);
        throw error;
    }
}
//# sourceMappingURL=apiTracker.js.map