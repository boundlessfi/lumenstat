'use client';

import { Table } from '@stellar/design-system';

/** An SDS table for plain text cells, usable from server components. */
export function SimpleTable({
  id,
  columns,
  rows,
  numericFrom = Number.POSITIVE_INFINITY,
  numericColumns,
  emptyMessage = 'Nothing here yet',
}: {
  id: string;
  columns: string[];
  rows: string[][];
  /** Columns at or after this index are right-aligned numbers. */
  numericFrom?: number;
  /** The exact columns that hold right-aligned numbers. Use it when a text column follows them. */
  numericColumns?: number[];
  emptyMessage?: string;
}) {
  const isNumeric = (i: number) => (numericColumns ? numericColumns.includes(i) : i >= numericFrom);
  const numeric = columns.map((_, i) => i).filter(isNumeric);

  return (
    <div className="data-table" data-num={numeric.length > 0 ? numeric.join(' ') : undefined}>
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
              <td key={i} className={isNumeric(i) ? 'num' : undefined}>
                {cell}
              </td>
            ))}
          </>
        )}
      />
    </div>
  );
}
