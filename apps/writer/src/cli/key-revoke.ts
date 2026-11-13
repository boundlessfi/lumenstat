// Revokes a metrics API read key by its id.
// Usage: node src/cli/key-revoke.ts <api key id>
import { createPool } from '../db.ts';
import { Store } from '../store.ts';

const apiKeyId = process.argv[2];
if (!apiKeyId) {
  console.error('Usage: node src/cli/key-revoke.ts <api key id>');
  process.exit(1);
}

const pool = createPool(process.env.DATABASE_URL ?? '');
try {
  const revoked = await new Store(pool).revokeApiKey(apiKeyId);
  console.log(JSON.stringify({ apiKeyId, revoked }));
  if (!revoked) process.exitCode = 1;
} finally {
  await pool.end();
}
