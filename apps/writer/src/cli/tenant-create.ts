// Creates an API-analytics tenant and its first ingest key.
// Usage: node src/cli/tenant-create.ts "<project name>"
import { createPool, migrate } from '../db.ts';
import { Store } from '../store.ts';

const name = process.argv.slice(2).join(' ').trim();
if (!name) {
  console.error('Usage: node src/cli/tenant-create.ts "<project name>"');
  process.exit(1);
}

const pool = createPool(process.env.DATABASE_URL ?? '');
try {
  await migrate(pool);
  const { tenantId, ingestKey } = await new Store(pool).createTenant(name);
  // The ingest key is shown once. Only its hash is stored.
  console.log(JSON.stringify({ tenantId, name, ingestKey }));
} finally {
  await pool.end();
}
