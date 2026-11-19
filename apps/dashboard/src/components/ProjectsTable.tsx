'use client';

import { Button, Table } from '@stellar/design-system';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { count, ms, percent } from '@/lib/format';

export interface ProjectRow {
  id: string;
  name: string;
  websites: number;
  visitors: number;
  pageviews: number;
  apiRequests: number | null;
  errorRate: number | null;
  p95Ms: number | null;
}

const MAX_COMPARE = 4;

export function ProjectsTable({ rows, range }: { rows: ProjectRow[]; range: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSelected(current =>
      current.includes(id) ? current.filter(x => x !== id) : current.length < MAX_COMPARE ? [...current, id] : current,
    );

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="muted">Select two to four projects to compare them side by side.</span>
        <Button
          variant="primary"
          size="md"
          disabled={selected.length < 2}
          onClick={() => router.push(`/ops/compare?ids=${selected.join(',')}&range=${range}`)}
        >
          {`Compare selected (${selected.length})`}
        </Button>
      </div>
      <div className="data-table" data-num-from={1}>
        <Table
          id="projects"
          breakpoint={900}
          hideNumberColumn
          emptyMessage="No projects have enrolled yet"
          data={rows}
          columnLabels={[
            { id: 'name', label: 'Project' },
            { id: 'websites', label: 'Sites' },
            { id: 'visitors', label: 'Visitors' },
            { id: 'pageviews', label: 'Page views' },
            { id: 'api', label: 'API requests' },
            { id: '5xx', label: 'API 5xx' },
            { id: 'p95', label: 'API p95' },
          ]}
          renderItemRow={row => (
            <>
              <td>
                <div className="table-name">
                  <input
                    type="checkbox"
                    aria-label={`Select ${row.name} to compare`}
                    checked={selected.includes(row.id)}
                    onChange={() => toggle(row.id)}
                  />
                  <Link href={`/p/${row.id}/overview?range=${range}`}>{row.name}</Link>
                </div>
              </td>
              <td className="num">{count(row.websites)}</td>
              <td className="num">{count(row.visitors)}</td>
              <td className="num">{count(row.pageviews)}</td>
              <td className="num">{row.apiRequests === null ? 'not linked' : count(row.apiRequests)}</td>
              <td className="num">{percent(row.errorRate, 2)}</td>
              <td className="num">{ms(row.p95Ms)}</td>
            </>
          )}
        />
      </div>
    </div>
  );
}
