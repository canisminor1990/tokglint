import { Flexbox, InputNumber, Select, Switch, Text } from '@lobehub/ui';
import { PageHeader, Surface } from '@lobehub/ui/dashboard';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SettingControl, SettingRow } from '../components/SettingRow';
import { styles } from '../styles';
import {
  DEFAULT_POLL_MINUTES,
  LANGUAGES,
  MAX_POLL_MINUTES,
  POLL_1_MIN,
  type Settings,
} from '../types';

// lobe-design-ignore DETAIL-NO-EMPTY: 语言是固定选项，不是会空掉的数据集

export function GeneralPage({
  settings,
  startupEnabled,
  pending,
  onChangePollMinutes,
  onToggleStartup,
  onChange,
}: {
  settings: Settings;
  startupEnabled: boolean;
  pending: boolean;
  onChangePollMinutes: (minutes: number) => void;
  onToggleStartup: (enabled: boolean) => void;
  onChange: (patch: Partial<Settings>) => void;
}) {
  const { t } = useTranslation();
  const savedMinutes = Math.max(1, Math.round(settings.pollIntervalMs / POLL_1_MIN));
  const [minutes, setMinutes] = useState(savedMinutes);
  const saveTitle = pending ? t('app.saving') : undefined;
  const language = settings.language ?? 'system';

  useEffect(() => {
    setMinutes(savedMinutes);
  }, [savedMinutes]);

  return (
    <div className={styles.page}>
      <PageHeader description={t('general.description')} title={t('general.title')} />
      <Surface description={t('general.refreshDescription')} title={t('general.refresh')}>
        <SettingRow
          title={t('general.pollInterval')}
          description={t('general.pollIntervalDescription', {
            defaultMinutes: DEFAULT_POLL_MINUTES,
            maxMinutes: MAX_POLL_MINUTES,
          })}
        >
          <Flexbox horizontal align="center" gap={8}>
            <SettingControl>
              <InputNumber
                disabled={pending}
                max={MAX_POLL_MINUTES}
                min={1}
                style={{ width: 110 }}
                title={saveTitle}
                value={minutes}
                onBlur={() => {
                  if (minutes >= 1 && minutes !== savedMinutes) onChangePollMinutes(minutes);
                }}
                onChange={(value) => {
                  if (typeof value === 'number') setMinutes(value);
                }}
              />
            </SettingControl>
            <Text as="span" type="secondary">
              {t('general.minutes')}
            </Text>
            {minutes !== savedMinutes ? <Text type="secondary">{t('general.unsaved')}</Text> : null}
          </Flexbox>
        </SettingRow>
        <SettingRow description={t('general.startupDescription')} title={t('general.startup')}>
          <SettingControl>
            <Switch
              checked={startupEnabled}
              disabled={pending}
              title={saveTitle}
              onChange={(checked) => onToggleStartup(checked)}
            />
          </SettingControl>
        </SettingRow>
      </Surface>
      <Surface padded>
        <SettingRow description={t('general.languageDescription')} title={t('general.language')}>
          <SettingControl>
            <Select
              disabled={pending}
              style={{ width: 220 }}
              value={language}
              options={LANGUAGES.map((item) => ({
                value: item.value,
                label: item.labelKey ? t(item.labelKey) : item.label,
              }))}
              onChange={(value) => onChange({ language: String(value || 'system') })}
            />
          </SettingControl>
        </SettingRow>
      </Surface>
    </div>
  );
}
