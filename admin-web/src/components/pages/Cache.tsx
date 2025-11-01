import React, { useEffect, useState } from 'react';
import {
  getCacheInfo,
  getCacheKeys,
  getCacheKeyValue,
  deleteCacheKey,
  deleteCachePattern,
  flushCache
} from '../../services/apiClient';
import {
  CacheInfoResponse,
  CacheKeysResponse,
  CacheKeyValueResponse
} from '../../types';
import styles from './Cache.module.css';

export const Cache: React.FC = () => {
  const [cacheInfo, setCacheInfo] = useState<CacheInfoResponse | null>(null);
  const [keysData, setKeysData] = useState<CacheKeysResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // フィルター状態
  const [pattern, setPattern] = useState('*');
  const [searchPattern, setSearchPattern] = useState('*');

  // キー詳細表示用
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [keyValue, setKeyValue] = useState<CacheKeyValueResponse | null>(null);
  const [loadingKeyValue, setLoadingKeyValue] = useState(false);

  const loadData = async (isInitialLoad = false) => {
    try {
      // 初回読み込み時のみローディング表示
      if (isInitialLoad) {
        setLoading(true);
      }
      setError(null);
      const [info, keys] = await Promise.all([
        getCacheInfo(),
        getCacheKeys(searchPattern, 100)
      ]);
      console.log('[Cache] API Response - info:', JSON.stringify(info, null, 2));
      console.log('[Cache] API Response - keys:', JSON.stringify(keys, null, 2));
      setCacheInfo(info);
      setKeysData(keys);
    } catch (err) {
      console.error('Failed to load cache data:', err);
      setError(err instanceof Error ? err.message : 'データの読み込みに失敗しました');
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  };

  const handleSearch = () => {
    setSearchPattern(pattern);
  };

  const handleKeyClick = async (key: string) => {
    setSelectedKey(key);
    setLoadingKeyValue(true);
    try {
      const value = await getCacheKeyValue(key);
      setKeyValue(value);
    } catch (err) {
      console.error('Failed to load key value:', err);
      alert('キーの値の取得に失敗しました');
    } finally {
      setLoadingKeyValue(false);
    }
  };

  const handleDeleteKey = async (key: string) => {
    if (!confirm(`キー "${key}" を削除しますか?`)) {
      return;
    }

    try {
      await deleteCacheKey(key);
      setSelectedKey(null);
      setKeyValue(null);
      await loadData(true); // 削除後は初回読み込みとして扱う
    } catch (err) {
      console.error('Failed to delete key:', err);
      alert('キーの削除に失敗しました');
    }
  };

  const handleDeletePattern = async () => {
    const patternInput = prompt(`削除するパターンを入力してください（例: youtube:*）`, 'youtube:*');
    if (!patternInput) {
      return;
    }

    if (!confirm(`パターン "${patternInput}" に一致するすべてのキーを削除しますか?`)) {
      return;
    }

    try {
      await deleteCachePattern(patternInput);
      await loadData(true); // パターン削除後は初回読み込みとして扱う
    } catch (err) {
      console.error('Failed to delete pattern:', err);
      alert('パターン削除に失敗しました');
    }
  };

  const handleFlushCache = async () => {
    if (!confirm('すべてのキャッシュをフラッシュしますか? この操作は取り消せません。')) {
      return;
    }

    if (!confirm('本当によろしいですか? すべてのキャッシュデータが削除されます。')) {
      return;
    }

    try {
      await flushCache();
      setSelectedKey(null);
      setKeyValue(null);
      await loadData(true); // フラッシュ後は初回読み込みとして扱う
    } catch (err) {
      console.error('Failed to flush cache:', err);
      alert('キャッシュフラッシュに失敗しました');
    }
  };

  useEffect(() => {
    loadData(true); // 初回読み込み
    const interval = setInterval(() => loadData(false), 30000); // 30秒ごとにバックグラウンド更新
    return () => clearInterval(interval);
  }, [searchPattern]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}日 ${hours}時間 ${minutes}分`;
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>キャッシュ/DB管理</h1>
        <div className={styles.headerButtons}>
          <button onClick={loadData} className={styles.refreshButton}>
            🔄 更新
          </button>
          <button onClick={handleDeletePattern} className={styles.deletePatternButton}>
            🗑️ パターン削除
          </button>
          <button onClick={handleFlushCache} className={styles.flushButton}>
            ⚠️ 全削除
          </button>
        </div>
      </header>

      {/* Redis接続状態 */}
      {cacheInfo && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Redis 接続状態</h2>

          {!cacheInfo.connected ? (
            <div className={styles.disconnected}>
              <div className={styles.disconnectedIcon}>❌</div>
              <div className={styles.disconnectedText}>Redisに接続されていません</div>
              <div className={styles.disconnectedSubtext}>
                キャッシュ機能は無効化されています。Redisサーバーを起動してください。
              </div>
            </div>
          ) : (
            <>
              <div className={styles.connected}>
                <div className={styles.connectedIcon}>✅</div>
                <div className={styles.connectedText}>Redis 接続中</div>
              </div>

              {cacheInfo.info && (
                <div className={styles.statsGrid}>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>キー数</div>
                    <div className={styles.statValue}>{cacheInfo.info.dbSize}</div>
                    <div className={styles.statSubtext}>登録されているキー</div>
                  </div>

                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>メモリ使用量</div>
                    <div className={styles.statValue}>{cacheInfo.info.memory.usedHuman}</div>
                    <div className={styles.statSubtext}>
                      最大: {cacheInfo.info.memory.maxHuman || '無制限'}
                    </div>
                  </div>

                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>稼働時間</div>
                    <div className={styles.statValue}>
                      {formatUptime(cacheInfo.info.stats.uptimeSeconds)}
                    </div>
                    <div className={styles.statSubtext}>Redis起動時間</div>
                  </div>

                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>処理済みコマンド</div>
                    <div className={styles.statValue}>
                      {cacheInfo.info.stats.totalCommandsProcessed.toLocaleString()}
                    </div>
                    <div className={styles.statSubtext}>
                      接続数: {cacheInfo.info.stats.totalConnectionsReceived}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* キー検索 */}
      {cacheInfo?.connected && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>キー検索</h2>

          <div className={styles.searchBar}>
            <input
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="検索パターン（例: youtube:*, twitch:*, *）"
              className={styles.searchInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
            />
            <button onClick={handleSearch} className={styles.searchButton}>
              🔍 検索
            </button>
          </div>

          {keysData && (
            <div className={styles.searchResults}>
              <div className={styles.searchSummary}>
                {keysData.total}件のキーが見つかりました（表示: {keysData.keys.length}件）
              </div>

              {keysData.keys.length === 0 ? (
                <div className={styles.noData}>キーが見つかりませんでした</div>
              ) : (
                <div className={styles.keysList}>
                  {keysData.keys.map((keyInfo) => (
                    <div
                      key={keyInfo.key}
                      className={`${styles.keyCard} ${selectedKey === keyInfo.key ? styles.keyCardSelected : ''}`}
                      onClick={() => handleKeyClick(keyInfo.key)}
                    >
                      <div className={styles.keyHeader}>
                        <span className={styles.keyName}>{keyInfo.key}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteKey(keyInfo.key);
                          }}
                          className={styles.deleteKeyButton}
                        >
                          🗑️
                        </button>
                      </div>
                      <div className={styles.keyMeta}>
                        <span className={styles.keyType}>型: {keyInfo.type}</span>
                        <span className={styles.keyTtl}>
                          TTL: {keyInfo.ttl === null ? '無期限' : `${keyInfo.ttl}秒`}
                        </span>
                        {keyInfo.size !== null && (
                          <span className={styles.keySize}>
                            サイズ: {(keyInfo.size / 1024).toFixed(2)} KB
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* キー詳細 */}
      {selectedKey && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>キー詳細: {selectedKey}</h2>

          {loadingKeyValue ? (
            <div className={styles.loading}>読み込み中...</div>
          ) : keyValue ? (
            <div className={styles.keyDetail}>
              <div className={styles.detailMeta}>
                <div className={styles.detailMetaItem}>
                  <span className={styles.detailLabel}>型:</span>
                  <span className={styles.detailValue}>{keyValue.type}</span>
                </div>
                <div className={styles.detailMetaItem}>
                  <span className={styles.detailLabel}>TTL:</span>
                  <span className={styles.detailValue}>
                    {keyValue.ttl === null ? '無期限' : `${keyValue.ttl}秒`}
                  </span>
                </div>
              </div>

              <div className={styles.detailValue}>
                <div className={styles.detailLabel}>値:</div>
                <pre className={styles.valueDisplay}>
                  {typeof keyValue.value === 'object'
                    ? JSON.stringify(keyValue.value, null, 2)
                    : String(keyValue.value)}
                </pre>
              </div>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
};
