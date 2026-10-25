import { Button, confirmModal, Input, Select, Switch, Text } from '@lobehub/ui';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { styles } from '../styles';
import type { AccountProfile, ProviderAccounts } from '../types';

const confirm = confirmModal;

function DraftInput({
  label,
  value,
  placeholder,
  disabled,
  onCommit,
  className,
}: {
  label: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  onCommit: (value: string) => void;
  className?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <label className={className ?? styles.field} htmlFor={id}>
      <Text as="span" type="secondary">
        {label}
      </Text>
      <Input
        disabled={disabled}
        id={id}
        placeholder={placeholder}
        value={draft}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onBlur={() => {
          if (draft !== value) onCommit(draft);
        }}
      />
    </label>
  );
}

export function AccountEditor({
  provider,
  accounts,
  pending,
  onChange,
}: {
  provider: 'claude' | 'codex';
  accounts: ProviderAccounts;
  pending: boolean;
  onChange: (next: ProviderAccounts) => Promise<void>;
}) {
  const { t } = useTranslation();
  const defaultId = useId();
  const enabledProfiles = accounts.profiles.filter((profile) => profile.enabled);
  const directoryExample = provider === 'claude' ? '~/.claude' : '~/.codex';

  const commit = (next: ProviderAccounts) => {
    void onChange(next).catch(() => undefined);
  };

  const updateProfile = (index: number, patch: Partial<AccountProfile>) => {
    const profiles = accounts.profiles.map((profile, profileIndex) =>
      profileIndex === index ? { ...profile, ...patch } : profile,
    );
    commit({ ...accounts, profiles });
  };

  const askRemove = (index: number) => {
    const profile = accounts.profiles[index];
    if (!profile) return;
    const name = profile.name || profile.id;
    confirm({
      title: t('accounts.deleteTitle', { name }),
      content: t('accounts.deleteContent'),
      okText: t('accounts.deleteOk'),
      cancelText: t('accounts.cancel'),
      okButtonProps: { danger: true },
      onOk: () => {
        const profiles = accounts.profiles.filter((_, profileIndex) => profileIndex !== index);
        const selected =
          profiles.find((item) => item.id === accounts.selected)?.id ??
          profiles.find((item) => item.enabled)?.id ??
          profiles[0]?.id ??
          '';
        return onChange({ ...accounts, profiles, selected });
      },
    });
  };

  if (accounts.profiles.length === 0) {
    return <Text type="secondary">{t('accounts.empty')}</Text>;
  }

  return (
    <div className={styles.accountList}>
      <div className={styles.field}>
        <span id={defaultId}>
          <Text as="span">{t('accounts.defaultAccount')}</Text>
        </span>
        {enabledProfiles.length === 0 ? (
          <Text type="secondary">{t('accounts.needEnabled')}</Text>
        ) : (
          <Select
            aria-labelledby={defaultId}
            disabled={pending}
            style={{ width: 220 }}
            value={accounts.selected}
            options={enabledProfiles.map((profile) => ({
              value: profile.id,
              label: profile.name || profile.id,
            }))}
            onChange={(value) =>
              commit({ ...accounts, selected: String(value ?? accounts.selected) })
            }
          />
        )}
      </div>
      {accounts.profiles.map((profile, index) => {
        const onlyOne = accounts.profiles.length <= 1;
        const removeTitle = onlyOne
          ? t('accounts.keepOne')
          : pending
            ? t('app.saving')
            : t('accounts.delete');
        return (
          <div className={styles.account} key={profile.id}>
            <div className={styles.nameRow}>
              <label className={styles.switchLabel}>
                <Switch
                  checked={profile.enabled}
                  disabled={pending}
                  onChange={(checked) => updateProfile(index, { enabled: checked })}
                />
                <Text as="span">{t('accounts.monitor')}</Text>
              </label>
              <Button
                danger
                disabled={pending || onlyOne}
                htmlType="button"
                title={removeTitle}
                type="fill"
                onClick={() => askRemove(index)}
              >
                {t('accounts.delete')}
              </Button>
            </div>
            <DraftInput
              disabled={pending}
              label={t('accounts.name')}
              placeholder={t('accounts.namePlaceholder')}
              value={profile.name}
              onCommit={(name) => updateProfile(index, { name })}
            />
            <DraftInput
              disabled={pending}
              label={t('accounts.directory')}
              placeholder={directoryExample}
              value={profile.configDir}
              onCommit={(configDir) => updateProfile(index, { configDir })}
            />
            <DraftInput
              disabled={pending}
              label={t('accounts.credentials')}
              placeholder="auth.json"
              value={profile.credentialsPath}
              onCommit={(credentialsPath) => updateProfile(index, { credentialsPath })}
            />
            <Text type="secondary">{t('accounts.credentialsHint')}</Text>
          </div>
        );
      })}
    </div>
  );
}
