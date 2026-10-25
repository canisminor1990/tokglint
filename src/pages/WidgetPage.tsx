import { Button, Flexbox, Segmented, Slider, Switch, Text } from '@lobehub/ui';
import { PageHeader, Surface } from '@lobehub/ui/dashboard';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ProviderIcon } from '../components/ProviderIcon';
import { SettingControl, SettingRow } from '../components/SettingRow';
import { styles } from '../styles';
import { orderedProviders, type ProviderKey, PROVIDERS, type Settings } from '../types';

export function WidgetPage({
  settings,
  pending,
  onChange,
}: {
  settings: Settings;
  pending: boolean;
  onChange: (patch: Partial<Settings>) => void;
}) {
  const { t } = useTranslation();
  const saveTitle = pending ? t('app.saving') : undefined;
  const savedGap = Math.min(48, Math.max(0, Math.round(settings.widgetGap ?? 8)));
  const [gap, setGap] = useState(savedGap);
  const order = orderedProviders(settings.providerOrder);

  useEffect(() => {
    setGap(savedGap);
  }, [savedGap]);

  const moveProvider = (key: ProviderKey, direction: -1 | 1) => {
    const next = [...order];
    const index = next.indexOf(key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= next.length) return;
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onChange({ providerOrder: next });
  };

  return (
    <div className={styles.page}>
      <PageHeader description={t('widget.description')} title={t('widget.title')} />
      <Surface description={t('widget.displayDescription')} title={t('widget.display')}>
        <SettingRow description={t('widget.directionDescription')} title={t('widget.direction')}>
          <SettingControl>
            <Segmented
              disabled={pending}
              value={settings.usageCountdown ? 'remaining' : 'used'}
              options={[
                { label: t('widget.used'), value: 'used' },
                { label: t('widget.remaining'), value: 'remaining' },
              ]}
              onChange={(value) => onChange({ usageCountdown: value === 'remaining' })}
            />
          </SettingControl>
        </SettingRow>
        <SettingRow
          description={t('widget.lockTaskbarDescription')}
          title={t('widget.lockTaskbar')}
        >
          <SettingControl>
            <Switch
              checked={settings.lockTaskbar}
              disabled={pending}
              title={saveTitle}
              onChange={(checked) => onChange({ lockTaskbar: checked })}
            />
          </SettingControl>
        </SettingRow>
        <SettingRow description={t('widget.trayIconsDescription')} title={t('widget.trayIcons')}>
          <SettingControl>
            <Switch
              checked={settings.showTrayIcons}
              disabled={pending}
              title={saveTitle}
              onChange={(checked) => onChange({ showTrayIcons: checked })}
            />
          </SettingControl>
        </SettingRow>
        <SettingRow description={t('widget.avatarDescription')} title={t('widget.avatar')}>
          <SettingControl>
            <Switch
              checked={settings.showAvatar}
              disabled={pending}
              title={saveTitle}
              onChange={(checked) => onChange({ showAvatar: checked })}
            />
          </SettingControl>
        </SettingRow>
        <SettingRow description={t('widget.resetDescription')} title={t('widget.reset')}>
          <SettingControl>
            <Switch
              checked={settings.showReset}
              disabled={pending}
              title={saveTitle}
              onChange={(checked) => onChange({ showReset: checked })}
            />
          </SettingControl>
        </SettingRow>
        <SettingRow description={t('widget.gapDescription')} title={t('widget.gap')}>
          <Flexbox horizontal align="center" gap={12}>
            <SettingControl>
              <Slider
                disabled={pending}
                max={48}
                min={0}
                step={1}
                style={{ width: 160 }}
                title={saveTitle}
                value={gap}
                onChange={(value) => setGap(value)}
                onChangeComplete={(value) => {
                  const next = Math.min(48, Math.max(0, Math.round(value)));
                  setGap(next);
                  if (next !== savedGap) onChange({ widgetGap: next });
                }}
              />
            </SettingControl>
            <Text as="span" type="secondary">
              {t('widget.pixels', { count: gap })}
            </Text>
          </Flexbox>
        </SettingRow>
        <SettingRow description={t('widget.orderDescription')} title={t('widget.order')}>
          <Flexbox className={styles.orderList} gap={8}>
            {order.map((key, index) => {
              const provider = PROVIDERS.find((item) => item.key === key);
              return (
                <Flexbox horizontal align="center" className={styles.orderItem} gap={8} key={key}>
                  <ProviderIcon provider={key} />
                  <Text as="span" className={styles.rowMain}>
                    {provider?.name ?? key}
                  </Text>
                  <Button
                    aria-label={t('widget.moveUp', { name: provider?.name ?? key })}
                    disabled={pending || index === 0}
                    htmlType="button"
                    size="small"
                    type="text"
                    onClick={() => moveProvider(key, -1)}
                  >
                    {t('widget.moveUpAction')}
                  </Button>
                  <Button
                    aria-label={t('widget.moveDown', { name: provider?.name ?? key })}
                    disabled={pending || index === order.length - 1}
                    htmlType="button"
                    size="small"
                    type="text"
                    onClick={() => moveProvider(key, 1)}
                  >
                    {t('widget.moveDownAction')}
                  </Button>
                </Flexbox>
              );
            })}
          </Flexbox>
        </SettingRow>
      </Surface>
    </div>
  );
}
