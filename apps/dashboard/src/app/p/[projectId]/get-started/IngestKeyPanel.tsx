'use client';

import { Banner, Button, CopyText, Text } from '@stellar/design-system';
import { useActionState } from 'react';
import { type IngestKeyState, issueIngestKey } from './actions';

export function IngestKeyPanel({ projectId, collectorUrl }: { projectId: string; collectorUrl: string }) {
  const [state, action, pending] = useActionState<IngestKeyState, FormData>(issueIngestKey.bind(null, projectId), {
    key: null,
    error: null,
  });

  const env = [
    `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=${collectorUrl}/v1/traces`,
    `OTEL_EXPORTER_OTLP_TRACES_HEADERS=x-scf-ingest-key=${state.key ?? '<your ingest key>'}`,
  ].join('\n');

  return (
    <div className="stack">
      <pre className="snippet">{env}</pre>
      {state.key ? (
        <Banner variant="success">
          Copy this key now; it is stored only as a hash and will not be shown again. Earlier keys keep working.
        </Banner>
      ) : null}
      {state.error ? <Banner variant="error">{state.error}</Banner> : null}
      <div className="row" style={{ gap: 8 }}>
        <form action={action}>
          <Button variant="secondary" size="sm" type="submit" isLoading={pending}>
            {state.key ? 'Issue another key' : 'Issue an ingest key'}
          </Button>
        </form>
        {state.key ? (
          <CopyText textToCopy={env} doneLabel="Copied">
            <Button variant="tertiary" size="sm" type="button">
              Copy settings
            </Button>
          </CopyText>
        ) : null}
      </div>
      <Text as="p" size="sm" addlClassName="muted">
        A working Node example is in the Lumenstat repo under examples/test-api.
      </Text>
    </div>
  );
}
