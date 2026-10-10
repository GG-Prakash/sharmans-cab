// One tiny SQL interface over two drivers:
//  - DATABASE_URL set  → real Postgres via postgres.js (Neon, Supabase, RDS, Vercel Postgres…)
//  - otherwise         → PGlite: embedded Postgres (WASM) persisted to .data/pglite. Zero install for dev.
// Both speak the same SQL with $1-style parameters, so every query is written once.
import { MIGRATIONS } from "./migrations";

export type Row = Record<string, unknown>;
export interface Queryable {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
}
export interface Db extends Queryable {
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  driver: "postgres" | "pglite";
}

async function createPostgres(url: string): Promise<Db> {
  const { default: postgres } = await import("postgres");
  const sql = postgres(url, {
    max: Number(process.env.DATABASE_POOL_MAX || 5),
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // safe behind PgBouncer / Neon pooler
    onnotice: () => {},
  });
  // Both the pool and a transaction handle expose .unsafe(sql, params).
  type Unsafe = { unsafe: (q: string, p: unknown[]) => Promise<unknown> };
  const wrap = (s: Unsafe): Queryable => ({
    async query<T>(q: string, params: unknown[] = []) {
      return (await s.unsafe(q, params)) as T[];
    },
  });
  return {
    driver: "postgres",
    ...wrap(sql as unknown as Unsafe),
    tx: <T,>(fn: (q: Queryable) => Promise<T>) => sql.begin((t) => fn(wrap(t as unknown as Unsafe))) as Promise<T>,
  };
}

async function createPglite(dir: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = await PGlite.create(dir);
  type Q = { query: (q: string, p?: unknown[]) => Promise<{ rows: unknown[] }> };
  const wrap = (s: Q): Queryable => ({
    async query<T>(q: string, params: unknown[] = []) {
      return (await s.query(q, params)).rows as T[];
    },
  });
  return {
    driver: "pglite",
    ...wrap(pg),
    tx: (fn) => pg.transaction((t) => fn(wrap(t))),
  };
}

async function migrate(db: Db) {
  await db.tx(async (q) => {
    // Lock first: concurrent cold starts racing on CREATE TABLE IF NOT EXISTS can fail with a duplicate-type error.
    if (db.driver === "postgres") await q.query(`SELECT pg_advisory_xact_lock(918273645)`);
    await q.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (version int PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
    );
    const done = new Set(
      (await q.query<{ version: number }>(`SELECT version FROM schema_migrations`)).map((r) => Number(r.version)),
    );
    for (const m of MIGRATIONS) {
      if (done.has(m.version)) continue;
      for (const stmt of m.statements) await q.query(stmt);
      await q.query(`INSERT INTO schema_migrations (version) VALUES ($1)`, [m.version]);
    }
  });
}

export class DbConfigError extends Error {}

async function init(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  let db: Db;
  if (url) {
    db = await createPostgres(url);
  } else {
    if (process.env.VERCEL) {
      // Serverless hosts have no persistent disk: an embedded DB there would silently lose leads.
      throw new DbConfigError(
        "DATABASE_URL is not set. Add a Postgres connection string in the hosting project's environment variables.",
      );
    }
    db = await createPglite(process.env.PGLITE_DIR || ".data/pglite");
  }
  await migrate(db);
  return db;
}

// One instance per server process (survives Next.js dev hot reloads).
const g = globalThis as unknown as { __scDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!g.__scDb) {
    g.__scDb = init().catch((e) => {
      g.__scDb = undefined; // allow a retry on the next request
      throw e;
    });
  }
  return g.__scDb;
}

/**
 * Test hook: a fresh, empty database. In-memory PGlite by default; set
 * TEST_DATABASE_URL to run the same suite against a real (throwaway!) Postgres.
 */
export async function useTestDb() {
  g.__scDb = undefined;
  if (process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    const db = await getDb();
    await db.query(`DROP TABLE IF EXISTS lead_events, leads, schema_migrations CASCADE`);
    g.__scDb = undefined;
  } else {
    delete process.env.DATABASE_URL;
    process.env.PGLITE_DIR = "memory://";
  }
  return getDb();
}
