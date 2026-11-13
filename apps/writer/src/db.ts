import { readdir, readFile } from 'node:fs/promises';
import pg from 'pg';

const MIGRATION_LOCK = 727_274;

export function createPool(connectionString: string): pg.Pool {
  return new pg.Pool({ connectionString, max: 10 });
}

/** Applies `db/migrations/*.sql` in order, once each, under an advisory lock. */
export async function migrate(pool: pg.Pool): Promise<string[]> {
  const dir = new URL('../db/migrations/', import.meta.url);
  const files = (await readdir(dir)).filter(f => f.endsWith('.sql')).sort();
  const applied: string[] = [];
  const client = await pool.connect();

  try {
    await client.query('select pg_advisory_lock($1)', [MIGRATION_LOCK]);
    await client.query('create schema if not exists scf_api');
    await client.query(
      'create table if not exists scf_api.schema_migration (name text primary key, applied_at timestamptz not null default now())',
    );

    for (const file of files) {
      const done = await client.query('select 1 from scf_api.schema_migration where name = $1', [file]);
      if (done.rowCount) continue;

      const sql = await readFile(new URL(file, dir), 'utf8');
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into scf_api.schema_migration (name) values ($1)', [file]);
        await client.query('commit');
        applied.push(file);
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    }
  } finally {
    await client.query('select pg_advisory_unlock($1)', [MIGRATION_LOCK]).catch(() => undefined);
    client.release();
  }

  return applied;
}
