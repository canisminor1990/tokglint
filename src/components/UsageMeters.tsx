import { Flexbox, Text } from '@lobehub/ui';
import { Progress } from 'antd';

import { styles } from '../styles';
import { type UsageFact } from '../usage';

export function UsageMeters({ fact }: { fact: UsageFact }) {
  const noteType = fact.tone === 'secondary' ? 'secondary' : fact.tone;

  return (
    <div className={styles.meters}>
      {fact.detail ? (
        <Text as="span" type={noteType}>
          {fact.detail}
        </Text>
      ) : null}
      {fact.meters.map((meter) => (
        <div className={styles.meter} key={meter.id}>
          <Flexbox horizontal align="center" gap={8} justify="space-between">
            <Text as="span" type="secondary">
              {meter.label}
            </Text>
            <Text as="span">{meter.percent}%</Text>
          </Flexbox>
          <Progress
            percent={meter.percent}
            railColor="var(--lobe-color-fill-secondary)"
            showInfo={false}
            size="small"
            status="normal"
            strokeColor="var(--lobe-color-text)"
            style={{ margin: 0 }}
          />
        </div>
      ))}
    </div>
  );
}
