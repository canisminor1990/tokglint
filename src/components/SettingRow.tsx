import { Flexbox, Text } from '@lobehub/ui';
import {
  cloneElement,
  createContext,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useId,
} from 'react';

import { styles } from '../styles';

const SettingLabelContext = createContext<{ descId?: string; titleId: string } | null>(null);

export function SettingControl({ children }: { children: ReactElement<Record<string, unknown>> }) {
  const ids = use(SettingLabelContext);
  if (!ids || !isValidElement(children)) return children;
  return cloneElement(children, {
    'aria-labelledby': ids.titleId,
    ...(ids.descId ? { 'aria-describedby': ids.descId } : {}),
  });
}

export function SettingRow({
  title,
  description,
  mark,
  children,
}: {
  title: string;
  description?: string;
  mark?: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  const descId = useId();

  return (
    <SettingLabelContext value={{ titleId, descId: description ? descId : undefined }}>
      <Flexbox
        horizontal
        align="flex-start"
        className={styles.row}
        gap={16}
        justify="space-between"
        wrap="wrap"
      >
        <Flexbox horizontal align="center" className={styles.rowMain} gap={12}>
          {mark ? <div className={styles.mark}>{mark}</div> : null}
          <Flexbox className={styles.rowMain} gap={2}>
            <span id={titleId}>
              <Text as="span" weight={500}>
                {title}
              </Text>
            </span>
            {description ? (
              <span id={descId}>
                <Text as="span" type="secondary">
                  {description}
                </Text>
              </span>
            ) : null}
          </Flexbox>
        </Flexbox>
        <div className={styles.rowControl}>{children}</div>
      </Flexbox>
    </SettingLabelContext>
  );
}
