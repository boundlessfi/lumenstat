'use client';

import { Table } from '@stellar/design-system';

/** An SDS table for plain text cells, usable from server components. */
export function SimpleTable({
  id,
  columns,
  rows,
  numericFrom = Number.POSITIVE_INFINITY,
  emptyMessage = 'Nothing here yet',
}: {
  id: string;
  columns: string[];
  rows: string[][];
  /** Columns at or after this index are right-aligned numbers. */
  numericFrom?: number;
  emptyMessage?: string;
}) {
  return (
    <div className="data-table" data-num-from={Number.isFinite(numericFrom) ? numericFrom : undefined}>
      <Table
        id={id}
        breakpoint={700}
        hideNumberColumn
        emptyMessage={emptyMessage}
        columnLabels={columns.map((label, i) => ({ id: `${id}-col-${i}`, label }))}
        data={rows.map((cells, i) => ({ id: `${id}-row-${i}`, cells }))}
        renderItemRow={row => (
          <>
            {row.cells.map((cell: string, i: number) => (
              <td key={i} className={i >= numericFrom ? 'num' : undefined}>
                {cell}
              </td>
            ))}
          </>
        )}
      />
    </div>
  );
}
