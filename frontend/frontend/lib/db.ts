import mysql from "mysql2/promise";
import { Pool, PoolClient } from "pg";

type AnyParams = any[];

export interface DbConnection {
  execute<T = any>(sql: string, params?: AnyParams): Promise<[T, any?]>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  end(): Promise<void>;
}

function getDbClient(): "mysql" | "postgres" {
  const client = (process.env.DB_CLIENT || "").toLowerCase();
  if (client === "postgres" || client === "postgresql" || client === "pg") {
    return "postgres";
  }
  return "mysql";
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
    },
  };
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
    },
  };
}

const pgPool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "postgres",
});

export async function getConnection(): Promise<DbConnection> {
  const client = getDbClient();

  try {
    if (client === "postgres") {
      const pgClient = await pgPool.connect();
      return createPostgresAdapter(pgClient);
    }

    const mysqlConn = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "Password@123456",
      database: process.env.DB_NAME || "mydb",
    });
    return createMysqlAdapter(mysqlConn);
  } catch (error: any) {
    const host = process.env.DB_HOST || "localhost";
    const port = process.env.DB_PORT || (client === "postgres" ? "5432" : "3306");
    const user = process.env.DB_USER || (client === "postgres" ? "postgres" : "root");
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
