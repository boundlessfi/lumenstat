import { Card, Text } from '@/lib/sds';

export function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card>
      <div className="stack" style={{ gap: 6 }}>
        <Text as="div" size="sm" addlClassName="muted">
          {label}
        </Text>
        <Text as="div" size="xl" weight="semi-bold">
          {value}
        </Text>
        {note ? (
          <Text as="div" size="xs" addlClassName="muted">
            {note}
          </Text>
        ) : null}
      </div>
    </Card>
  );
}
