import prisma from './prismaService';

export interface DatabaseStats {
  connections: {
    active: number;
    idle: number;
    total: number;
    maxConnections: number;
  };
  transactions: {
    committed: number;
    rolledBack: number;
  };
  cache: {
    hitRate: number; // %
    blocksHit: number;
    blocksRead: number;
  };
  size: {
    totalMB: number;
  };
  diskOperations: {
    blocksRead: number;
    blocksWritten: number;
    tuplesReturned: number;
    tuplesFetched: number;
    tuplesInserted: number;
    tuplesUpdated: number;
    tuplesDeleted: number;
  };
}

export interface TableStats {
  schemaName: string;
  tableName: string;
  rowCount: number;
  tableSizeMB: number;
  indexSizeMB: number;
  totalSizeMB: number;
  sequentialScans: number;
  indexScans: number;
  tuples: {
    inserted: number;
    updated: number;
    deleted: number;
  };
}

export interface ActiveQuery {
  pid: number;
  user: string;
  database: string;
  state: string;
  query: string;
  duration: number; // seconds
  waitEvent: string | null;
}

export class DatabaseMetricsService {
  /**
   * データベース統計情報を取得
   */
  public async getDatabaseStats(): Promise<DatabaseStats> {
    const dbName = process.env.DATABASE_NAME || 'fukumado_db';

    // 接続数を取得
    const connections = await this.getConnectionStats();

    // データベース統計を取得
    const dbStats: any = await prisma.$queryRaw`
      SELECT
        xact_commit,
        xact_rollback,
        blks_hit,
        blks_read,
        tup_returned,
        tup_fetched,
        tup_inserted,
        tup_updated,
        tup_deleted,
        pg_database_size(datname) as db_size
      FROM pg_stat_database
      WHERE datname = ${dbName}
    `;

    const stat = dbStats[0] || {};

    const blocksHit = Number(stat.blks_hit) || 0;
    const blocksRead = Number(stat.blks_read) || 0;
    const totalBlocks = blocksHit + blocksRead;
    const cacheHitRate = totalBlocks > 0 ? (blocksHit / totalBlocks) * 100 : 100;

    // max_connections を取得
    const maxConnResult: any = await prisma.$queryRaw`
      SHOW max_connections
    `;
    const maxConnections = parseInt(maxConnResult[0]?.max_connections || '100', 10);

    return {
      connections: {
        active: connections.active,
        idle: connections.idle,
        total: connections.total,
        maxConnections,
      },
      transactions: {
        committed: Number(stat.xact_commit) || 0,
        rolledBack: Number(stat.xact_rollback) || 0,
      },
      cache: {
        hitRate: Math.round(cacheHitRate * 100) / 100,
        blocksHit,
        blocksRead,
      },
      size: {
        totalMB: Math.round(Number(stat.db_size || 0) / 1024 / 1024),
      },
      diskOperations: {
        blocksRead,
        blocksWritten: 0, // pg_stat_database には書き込みブロック数がない
        tuplesReturned: Number(stat.tup_returned) || 0,
        tuplesFetched: Number(stat.tup_fetched) || 0,
        tuplesInserted: Number(stat.tup_inserted) || 0,
        tuplesUpdated: Number(stat.tup_updated) || 0,
        tuplesDeleted: Number(stat.tup_deleted) || 0,
      },
    };
  }

  /**
   * 接続統計を取得
   */
  public async getConnectionStats(): Promise<{
    active: number;
    idle: number;
    total: number;
  }> {
    const result: any = await prisma.$queryRaw`
      SELECT
        COUNT(*) FILTER (WHERE state = 'active') as active,
        COUNT(*) FILTER (WHERE state = 'idle') as idle,
        COUNT(*) as total
      FROM pg_stat_activity
      WHERE datname IS NOT NULL
    `;

    return {
      active: Number(result[0]?.active) || 0,
      idle: Number(result[0]?.idle) || 0,
      total: Number(result[0]?.total) || 0,
    };
  }

  /**
   * テーブル統計を取得
   */
  public async getTableStats(): Promise<TableStats[]> {
    const tables: any = await prisma.$queryRaw`
      SELECT
        schemaname as schema_name,
        relname as table_name,
        n_tup_ins as tup_inserted,
        n_tup_upd as tup_updated,
        n_tup_del as tup_deleted,
        seq_scan,
        idx_scan,
        pg_total_relation_size(relid) as total_size,
        pg_relation_size(relid) as table_size,
        pg_indexes_size(relid) as index_size
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
    `;

    return tables.map((table: any) => ({
      schemaName: table.schema_name,
      tableName: table.table_name,
      rowCount: 0, // 正確な行数はCOUNTクエリが必要なので省略
      tableSizeMB: Math.round(Number(table.table_size || 0) / 1024 / 1024 * 100) / 100,
      indexSizeMB: Math.round(Number(table.index_size || 0) / 1024 / 1024 * 100) / 100,
      totalSizeMB: Math.round(Number(table.total_size || 0) / 1024 / 1024 * 100) / 100,
      sequentialScans: Number(table.seq_scan) || 0,
      indexScans: Number(table.idx_scan) || 0,
      tuples: {
        inserted: Number(table.tup_inserted) || 0,
        updated: Number(table.tup_updated) || 0,
        deleted: Number(table.tup_deleted) || 0,
      },
    }));
  }

  /**
   * アクティブなクエリを取得
   */
  public async getActiveQueries(): Promise<ActiveQuery[]> {
    const queries: any = await prisma.$queryRaw`
      SELECT
        pid,
        usename as user,
        datname as database,
        state,
        query,
        EXTRACT(EPOCH FROM (NOW() - query_start)) as duration,
        wait_event as wait_event
      FROM pg_stat_activity
      WHERE state = 'active'
        AND query NOT LIKE '%pg_stat_activity%'
        AND datname IS NOT NULL
      ORDER BY query_start ASC
    `;

    return queries.map((q: any) => ({
      pid: Number(q.pid),
      user: q.user,
      database: q.database,
      state: q.state,
      query: q.query,
      duration: Math.round(Number(q.duration) || 0),
      waitEvent: q.wait_event,
    }));
  }
}
