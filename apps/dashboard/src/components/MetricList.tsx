import { count } from '@/lib/format';
import { Card, Heading, Text } from '@/lib/sds';
import type { Point } from '@/lib/series';

/** A ranked list with proportional bars: pages, referrers, countries, routes... */
export function MetricList({ title, items, empty = 'No data in this range' }: { title: string; items: Point[]; empty?: string }) {
  const max = Math.max(1, ...items.map(item => item.y));

  return (
    <Card>
      <div className="stack">
        <Heading as="h3" size="xs" weight="semi-bold">
          {title}
        </Heading>
        {items.length === 0 ? (
          <Text as="p" size="sm" addlClassName="muted">
            {empty}
          </Text>
        ) : (
          items.map(item => (
            <div className="bar-row" key={item.x}>
              <Text as="span" size="sm" addlClassName="truncate">
                {item.x || '(none)'}
              </Text>
              <Text as="span" size="sm" weight="semi-bold">
                {count(item.y)}
              </Text>
              <div className="bar-track" aria-hidden="true">
                <div className="bar-fill" style={{ width: `${(item.y / max) * 100}%` }} />
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
