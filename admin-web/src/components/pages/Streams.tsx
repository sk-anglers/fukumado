import React, { useState, useEffect } from 'react';
import { Card, Button, Loader } from '../common';
import { getStreamDetails, triggerStreamSync } from '../../services/apiClient';
import { StreamDetails, YouTubeLiveStream, TwitchLiveStream } from '../../types';
import styles from './Streams.module.css';

export const Streams: React.FC = () => {
  const [details, setDetails] = useState<StreamDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'youtube' | 'twitch'>('youtube');

  useEffect(() => {
    loadStreamDetails();
    // 30秒ごとに自動更新
    const interval = setInterval(loadStreamDetails, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadStreamDetails = async () => {
    try {
      const data = await getStreamDetails();
      console.log('[Streams] Loaded stream details:', data);
      setDetails(data);
    } catch (error) {
      console.error('[Streams] Failed to load stream details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async () => {
    if (isSyncing) return;

    try {
      setIsSyncing(true);
      await triggerStreamSync();
      alert('同期を開始しました。完了までしばらくお待ちください。');
      // 5秒後にリロード
      setTimeout(() => {
        loadStreamDetails();
        setIsSyncing(false);
      }, 5000);
    } catch (error) {
      console.error('Failed to trigger sync:', error);
      alert('同期の開始に失敗しました');
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return <Loader text="配信情報を読み込んでいます..." />;
  }

  if (!details) {
    return (
      <div className={styles.error}>
        <p>配信情報の取得に失敗しました</p>
        <Button onClick={loadStreamDetails}>再読み込み</Button>
      </div>
    );
  }

  const { stats, streams } = details;

  return (
    <div className={styles.streams}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>配信管理</h1>
        <Button
          variant="primary"
          onClick={handleSync}
          disabled={isSyncing}
        >
          {isSyncing ? '同期中...' : '手動同期'}
        </Button>
      </div>

      {/* 統計情報 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>配信統計</h2>
        <div className={styles.statsGrid}>
          <Card className={styles.statCard}>
            <div className={styles.statIcon}>
              {stats.isRunning ? '🟢' : '🔴'}
            </div>
            <div className={styles.statContent}>
              <div className={styles.statLabel}>同期サービス</div>
              <div className={styles.statValue}>
                {stats.isRunning ? '稼働中' : '停止中'}
              </div>
            </div>
          </Card>

          <Card className={styles.statCard}>
            <div className={styles.statIcon}>👥</div>
            <div className={styles.statContent}>
              <div className={styles.statLabel}>接続ユーザー数</div>
              <div className={styles.statValue}>{stats.userCount}</div>
            </div>
          </Card>

          <Card className={styles.statCard}>
            <div className={styles.statIcon}>📺</div>
            <div className={styles.statContent}>
              <div className={styles.statLabel}>YouTube配信</div>
              <div className={styles.statValue}>{stats.youtubeStreamCount}</div>
            </div>
          </Card>

          <Card className={styles.statCard}>
            <div className={styles.statIcon}>🎮</div>
            <div className={styles.statContent}>
              <div className={styles.statLabel}>Twitch配信</div>
              <div className={styles.statValue}>{stats.twitchStreamCount}</div>
            </div>
          </Card>

          <Card className={styles.statCard}>
            <div className={styles.statIcon}>🎬</div>
            <div className={styles.statContent}>
              <div className={styles.statLabel}>総配信数</div>
              <div className={styles.statValue}>{stats.totalStreamCount}</div>
            </div>
          </Card>
        </div>
      </section>

      {/* 配信リスト */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>配信リスト</h2>

        {/* タブ */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'youtube' ? styles.active : ''}`}
            onClick={() => setActiveTab('youtube')}
          >
            YouTube ({streams.youtube.length})
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'twitch' ? styles.active : ''}`}
            onClick={() => setActiveTab('twitch')}
          >
            Twitch ({streams.twitch.length})
          </button>
        </div>

        {/* YouTube配信リスト */}
        {activeTab === 'youtube' && (
          <div className={styles.streamList}>
            {streams.youtube.length === 0 ? (
              <Card>
                <p className={styles.emptyMessage}>
                  現在配信中のYouTubeストリームはありません
                </p>
              </Card>
            ) : (
              streams.youtube.map((stream: YouTubeLiveStream) => (
                <Card key={stream.id} className={styles.streamCard}>
                  <div className={styles.streamHeader}>
                    <img
                      src={stream.thumbnailUrl}
                      alt={stream.title}
                      className={styles.thumbnail}
                    />
                    <div className={styles.streamInfo}>
                      <h3 className={styles.streamTitle}>{stream.title}</h3>
                      <div className={styles.channelInfo}>
                        <span className={styles.channelName}>
                          {stream.channelTitle}
                        </span>
                        <span className={styles.streamId}>ID: {stream.id}</span>
                      </div>
                      <div className={styles.streamMeta}>
                        <span className={styles.metaItem}>
                          📅 {new Date(stream.publishedAt).toLocaleString('ja-JP')}
                        </span>
                      </div>
                    </div>
                  </div>
                  {stream.description && (
                    <div className={styles.streamDescription}>
                      {stream.description.substring(0, 200)}
                      {stream.description.length > 200 && '...'}
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>
        )}

        {/* Twitch配信リスト */}
        {activeTab === 'twitch' && (
          <div className={styles.streamList}>
            {streams.twitch.length === 0 ? (
              <Card>
                <p className={styles.emptyMessage}>
                  現在配信中のTwitchストリームはありません
                </p>
              </Card>
            ) : (
              streams.twitch.map((stream: TwitchLiveStream) => (
                <Card key={stream.id} className={styles.streamCard}>
                  <div className={styles.streamHeader}>
                    <img
                      src={stream.thumbnailUrl.replace('{width}', '320').replace('{height}', '180')}
                      alt={stream.title}
                      className={styles.thumbnail}
                    />
                    <div className={styles.streamInfo}>
                      <h3 className={styles.streamTitle}>{stream.title}</h3>
                      <div className={styles.channelInfo}>
                        <span className={styles.channelName}>
                          {stream.displayName}
                        </span>
                        <span className={styles.streamId}>@{stream.login}</span>
                      </div>
                      <div className={styles.streamMeta}>
                        <span className={styles.metaItem}>
                          👁 {stream.viewerCount.toLocaleString()} 視聴者
                        </span>
                        <span className={styles.metaItem}>
                          📅 {new Date(stream.startedAt).toLocaleString('ja-JP')}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </section>

      {/* 最終更新時刻 */}
      <div className={styles.lastUpdate}>
        最終更新: {new Date(details.timestamp).toLocaleString('ja-JP')}
      </div>
    </div>
  );
};
