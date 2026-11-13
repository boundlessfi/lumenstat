// Issues a read key for the metrics API.
// Usage: node src/cli/key-create.ts --label "<who it is for>" [--tenant <tenant id>] [--days <n>]
// Without --tenant the key has operator (global) scope.
import { parseArgs } from 'node:util';
import { createPool, migrate } from '../db.ts';
import { Store } from '../store.ts';

const { values } = parseArgs({
  options: {
    label: { type: 'string' },
    tenant: { type: 'string' },
    days: { type: 'string' },
  },
});

if (!values.label) {
  console.error('Usage: node src/cli/key-create.ts --label "<who it is for>" [--tenant <tenant id>] [--days <n>]');
  process.exit(1);
}

const days = values.days ? Number(values.days) : null;
if (days !== null && (!Number.isFinite(days) || days <= 0)) {
  console.error('--days must be a positive number');
  process.exit(1);
}
const expiresAt = days ? new Date(Date.now() + days * 86400e3) : null;

const pool = createPool(process.env.DATABASE_URL ?? '');
try {
  await migrate(pool);
  const { apiKeyId, key } = await new Store(pool).createApiKey(values.label, values.tenant ?? null, expiresAt);
  console.log(JSON.stringify({ apiKeyId, scope: values.tenant ? 'tenant' : 'operator', tenantId: values.tenant ?? null, expiresAt, key }));
} finally {
  await pool.end();
}
