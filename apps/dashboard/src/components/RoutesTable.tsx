'use client';

import { Table } from '@stellar/design-system';
import { count, ms } from '@/lib/format';
import type { ApiRoute } from '@/lib/server/writer';

export function RoutesTable({ routes }: { routes: ApiRoute[] }) {
  return (
    <Table
      id="routes"
      breakpoint={900}
      hideNumberColumn
      pageSize={25}
      emptyMessage="No API traffic in this range"
      data={routes.map(r => ({ ...r, id: `${r.service} ${r.method} ${r.route}` }))}
      columnLabels={[
        { id: 'route', label: 'Route' },
        { id: 'service', label: 'Service' },
        { id: 'requests', label: 'Requests' },
        { id: '2xx', label: '2xx' },
        { id: '4xx', label: '4xx' },
        { id: '5xx', label: '5xx' },
        { id: 'p50', label: 'p50' },
        { id: 'p95', label: 'p95' },
        { id: 'p99', label: 'p99' },
      ]}
      renderItemRow={r => (
        <>
          <td className="mono">
            {r.method} {r.route}
          </td>
          <td className="muted">{r.service}</td>
          <td className="num">{count(r.requests)}</td>
          <td className="num">{count(r.status['2xx'])}</td>
          <td className="num">{count(r.status['4xx'])}</td>
          <td className={r.status['5xx'] > 0 ? 'num error-text' : 'num'}>{count(r.status['5xx'])}</td>
          <td className="num">{ms(r.p50Ms)}</td>
          <td className="num">{ms(r.p95Ms)}</td>
          <td className="num">{ms(r.p99Ms)}</td>
        </>
      )}
    />
  );
}
