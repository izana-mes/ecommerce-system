import mysql from "mysql2/promise";
import { Pool, PoolClient } from "pg";

type AnyParams = any[];
type DbClient = "mysql" | "postgres";

export interface DbConnection {
  execute<T = any>(sql: string, params?: AnyParams): Promise<[T, any?]>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  end(): Promise<void>;
}

const POSTGRES_URL_ENV_KEYS = [
  "DATABASE_URL",
  "RENDER_DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
] as const;
const MYSQL_URL_ENV_KEYS = ["MYSQL_URL", "MYSQL_DATABASE_URL", "JAWSDB_URL"] as const;

function firstEnv(keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

function getDbClient(): DbClient {
  const client = (process.env.DB_CLIENT || "").toLowerCase();
  if (client === "postgres" || client === "postgresql" || client === "pg") {
    return "postgres";
  }
  if (client === "mysql") {
    return "mysql";
  }

  // Auto-detect when DB_CLIENT is not set (common on hosted envs).
  const pgUrl = getPostgresConnectionString();
  const mysqlUrl = getMysqlConnectionString();
  const portHint = String(process.env.DB_PORT || process.env.PGPORT || "").trim();
  const hasSharedDbParts = hasEnvValue("DB_HOST") && hasEnvValue("DB_USER") && hasEnvValue("DB_NAME");
  const hasPgConfig =
    Boolean(pgUrl) ||
    hasEnvValue("PGHOST") ||
    hasEnvValue("PGUSER") ||
    hasEnvValue("PGDATABASE") ||
    (hasSharedDbParts && portHint === "5432");
  const hasMysqlConfig =
    Boolean(mysqlUrl) ||
    hasEnvValue("MYSQL_HOST") ||
    hasEnvValue("MYSQL_USER") ||
    hasEnvValue("MYSQL_DATABASE") ||
    (hasSharedDbParts && portHint === "3306");

  if (hasMysqlConfig && !hasPgConfig) {
    return "mysql";
  }
  if (hasPgConfig && !hasMysqlConfig) {
    return "postgres";
  }

  // Prefer Postgres when DB settings are generic or ambiguous.
  return "postgres";
}

function getPostgresConnectionString(): string | undefined {
  return firstEnv(POSTGRES_URL_ENV_KEYS);
}

function getMysqlConnectionString(): string | undefined {
  return firstEnv(MYSQL_URL_ENV_KEYS);
}

function isCloudRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL === "1" ||
    /^(1|true)$/i.test((process.env.RENDER || "").trim())
  );
}

function hasEnvValue(key: string): boolean {
  return Boolean(process.env[key] && process.env[key]!.trim().length > 0);
}

function hasExplicitDbConfig(client: DbClient): boolean {
  if (client === "postgres") {
    return (
      Boolean(getPostgresConnectionString()) ||
      (hasEnvValue("DB_HOST") && hasEnvValue("DB_USER") && hasEnvValue("DB_NAME")) ||
      (hasEnvValue("PGHOST") && hasEnvValue("PGUSER") && hasEnvValue("PGDATABASE"))
    );
  }
  return (
    Boolean(getMysqlConnectionString()) ||
    (hasEnvValue("DB_HOST") && hasEnvValue("DB_USER") && hasEnvValue("DB_NAME"))
  );
}

function missingDbConfigMessage(client: DbClient): string {
  if (client === "postgres") {
    return "Missing PostgreSQL configuration. Set DB_CLIENT=postgres and DATABASE_URL (recommended) or DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME.";
  }
  return "Missing DB configuration. Set MYSQL_URL (recommended) or DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME.";
}

function resolvePgConfig() {
  const connectionString = getPostgresConnectionString();
  if (connectionString) {
    const sslModeRequired =
      /(^|[?&])sslmode=require(&|$)/i.test(connectionString) ||
      /^(1|true|required|require)$/i.test((process.env.DB_SSL || "").trim()) ||
      /^(1|true|required|require)$/i.test((process.env.PGSSLMODE || "").trim());
    return {
      connectionString,
      ...(sslModeRequired ? { ssl: { rejectUnauthorized: false } } : {})};
  }

  return {
    host: process.env.DB_HOST || process.env.PGHOST || "localhost",
    port: Number(process.env.DB_PORT || process.env.PGPORT || 5432),
    user: process.env.DB_USER || process.env.PGUSER || "postgres",
    password: process.env.DB_PASSWORD || process.env.PGPASSWORD || "",
    database: process.env.DB_NAME || process.env.PGDATABASE || "postgres"};
}

export function getDbRuntimeInfo(): { client: DbClient; host: string; port: string; user: string } {
  const client = getDbClient();
  const connectionString = getPostgresConnectionString();

  if (client === "postgres" && connectionString) {
    try {
      const parsed = new URL(connectionString);
      const host = parsed.hostname || process.env.DB_HOST || "localhost";
      const port = parsed.port || process.env.DB_PORT || "5432";
      const user = decodeURIComponent(parsed.username || process.env.DB_USER || "postgres");
      return { client, host, port, user };
    } catch {
      // Fall through to env-based reporting below if URL parsing fails.
    }
  }

  const host = process.env.DB_HOST || process.env.PGHOST || "<not-set>";
  const port = process.env.DB_PORT || process.env.PGPORT || "<not-set>";
  const user = process.env.DB_USER || process.env.PGUSER || "<not-set>";
  return { client, host, port, user };
}

function convertQuestionToDollarParams(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });
}

function createPostgresAdapter(client: PoolClient): DbConnection {
  return {
    async execute<T = any>(sql: string, params: AnyParams = []): Promise<[T, any?]> {
      const mappedSql = convertQuestionToDollarParams(sql);
      const result = await client.query(mappedSql, params);
      return [result.rows as T, result];
    },
    async beginTransaction() {
      await client.query("BEGIN");
    },
    async commit() {
      await client.query("COMMIT");
    },
    async rollback() {
      await client.query("ROLLBACK");
    },
    async end() {
      client.release();
    }};
}

function createMysqlAdapter(conn: mysql.Connection): DbConnection {
  return {
    async execute<T = any>(sql: string, params: AnyParams = []): Promise<[T, any?]> {
      const [rows, meta] = await conn.execute(sql, params);
      return [rows as T, meta];
    },
    async beginTransaction() {
      await conn.beginTransaction();
    },
    async commit() {
      await conn.commit();
    },
    async rollback() {
      await conn.rollback();
    },
    async end() {
      await conn.end();
    }};
}

let pgPool: Pool | null = null;

function getPgPool(): Pool {
  if (!pgPool) {
    pgPool = new Pool(resolvePgConfig());
  }
  return pgPool;
}

export async function getConnection(): Promise<DbConnection> {
  const client = getDbClient();

  try {
    if (isCloudRuntime() && !hasExplicitDbConfig(client)) {
      throw new Error(missingDbConfigMessage(client));
    }

    if (client === "postgres") {
      const pgClient = await getPgPool().connect();
      return createPostgresAdapter(pgClient);
    }

    const mysqlUrl = getMysqlConnectionString();
    if (mysqlUrl) {
      const mysqlConn = await mysql.createConnection(mysqlUrl);
      return createMysqlAdapter(mysqlConn);
    }

    const mysqlConn = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "mydb"});
    return createMysqlAdapter(mysqlConn);
  } catch (error: any) {
    const { host, port, user } = getDbRuntimeInfo();
    console.error("Database connection error", error?.message || error);
    throw new Error(
      `Database connection failed (${client}) host=${host} port=${port} user=${user}: ${error?.message || error}`
    );
  }
}

export async function query(sql: string, params: AnyParams = []) {
  let conn: DbConnection | undefined;
  try {
    conn = await getConnection();
    const [result] = await conn.execute(sql, params);
    return result;
  } finally {
    if (conn) {
      await conn.end();
    }
  }
}
