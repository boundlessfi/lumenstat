// Links an API tenant to the Umami team that owns the same project's websites,
// so the dashboard shows web and API data for one project together.
// Usage: node src/cli/tenant-link.ts <tenant id> <umami team id | none>
import { createPool } from '../db.ts';
import { Store } from '../store.ts';

const [tenantId, teamArg] = process.argv.slice(2);
if (!tenantId || !teamArg) {
  console.error('Usage: node src/cli/tenant-link.ts <tenant id> <umami team id | none>');
  process.exit(1);
}

const umamiTeamId = teamArg === 'none' ? null : teamArg;
const pool = createPool(process.env.DATABASE_URL ?? '');
try {
  const linked = await new Store(pool).linkUmamiTeam(tenantId, umamiTeamId);
  console.log(JSON.stringify({ tenantId, umamiTeamId, linked }));
  if (!linked) process.exitCode = 1;
} finally {
  await pool.end();
}
