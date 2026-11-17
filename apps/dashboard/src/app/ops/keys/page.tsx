import type { Metadata } from 'next';
import { Badge, Card, Heading, Text } from '@/lib/sds';
import { umami } from '@/lib/server/umami';
import { requireOperator } from '@/lib/server/viewer';
import { writer } from '@/lib/server/writer';

export const metadata: Metadata = { title: 'Keys and health' };

const COLLECTOR_HEALTH_URL = process.env.COLLECTOR_HEALTH_URL ?? 'http://localhost:13133';

async function collectorHealthy(): Promise<boolean> {
  try {
    return (await fetch(COLLECTOR_HEALTH_URL, { cache: 'no-store' })).ok;
  } catch {
    return false;
  }
}

export default async function KeysPage() {
  await requireOperator();
  const [web, api, collector] = await Promise.all([umami.heartbeat(), writer.healthy(), collectorHealthy()]);
  const checks = [
    { name: 'Web collection (Umami)', ok: web },
    { name: 'API collector', ok: collector },
    { name: 'API metrics store (writer)', ok: api },
  ];

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <Heading as="h1" size="md" weight="semi-bold">
        Keys and health
      </Heading>

      <Card>
        <div className="stack">
          <Heading as="h2" size="xs" weight="semi-bold">
            Service health
          </Heading>
          {checks.map(check => (
            <div key={check.name} className="row" style={{ justifyContent: 'space-between' }}>
              <Text as="span" size="sm">
                {check.name}
              </Text>
              <Badge variant={check.ok ? 'success' : 'error'} isStatus>
                {check.ok ? 'Up' : 'Down'}
              </Badge>
            </div>
          ))}
          <Text as="p" size="xs" addlClassName="muted">
            Checked live on each page load. Uptime history, rejected-traffic counts and backup status come with the monitoring milestone.
          </Text>
        </div>
      </Card>

      <Card>
        <div className="stack">
          <Heading as="h2" size="xs" weight="semi-bold">
            Metrics API keys
          </Heading>
          <Text as="p" size="sm">
            Read-only keys for machine consumers. Keys are shown once, stored only as hashes, and every use is recorded. During the MVP they
            are issued from <code>apps/writer</code>:
          </Text>
          <pre className="snippet">{`npm run key:create -- --label "<who it is for>" [--tenant <tenant id>] [--days 90]
npm run key:revoke -- <api key id>`}</pre>
          <Text as="p" size="xs" addlClassName="muted">
            A key without --tenant reads every project. API ingest keys are self-service: project owners issue them on their Setup page.
            Issuing and revoking read keys from this page is planned for Milestone 1.
          </Text>
        </div>
      </Card>
    </div>
  );
}
