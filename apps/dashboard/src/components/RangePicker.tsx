'use client';

import { Select } from '@stellar/design-system';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { RANGES, type RangeKey } from '@/lib/range';

export function RangePicker({ value }: { value: RangeKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <div style={{ minWidth: 200 }}>
      <Select
        id="range"
        fieldSize="md"
        label="Range"
        value={value}
        onChange={event => {
          const next = new URLSearchParams(params.toString());
          next.set('range', event.target.value);
          router.push(`${pathname}?${next.toString()}`);
        }}
      >
        {Object.entries(RANGES).map(([key, range]) => (
          <option key={key} value={key}>
            {range.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
