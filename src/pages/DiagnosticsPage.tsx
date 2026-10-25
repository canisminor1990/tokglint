import { Button, Empty, Flexbox, Switch } from '@lobehub/ui';
import { PageHeader, Surface } from '@lobehub/ui/dashboard';
import { useTranslation } from 'react-i18next';

import { styles } from '../styles';

export function DiagnosticsPage({
  logPath,
  logContent,
  recording,
  pending,
  onToggleRecording,
  onReloadLog,
  onCopyLog,
}: {
  logPath: string;
  logContent: string;
  recording: boolean;
  pending: boolean;
  onToggleRecording: (enabled: boolean) => void;
  onReloadLog: () => void;
  onCopyLog: () => void;
}) {
  const { t } = useTranslation();
  const saveTitle = pending ? t('app.saving') : undefined;
  const hasLog = logContent.length > 0;

  return (
    <div className={styles.page}>
      <PageHeader description={t('diagnostics.description')} title={t('diagnostics.title')} />
      <Surface
        description={
          logPath ? t('diagnostics.writePath', { path: logPath }) : t('diagnostics.writeDefault')
        }
        title={t('diagnostics.recording')}
        extra={
          <Switch
            aria-label={t('diagnostics.recording')}
            checked={recording}
            disabled={pending}
            title={saveTitle}
            onChange={(checked) => onToggleRecording(checked)}
          />
        }
      >
        <Flexbox horizontal gap={8} wrap="wrap">
          <Button
            disabled={pending}
            htmlType="button"
            title={saveTitle}
            type="fill"
            onClick={onReloadLog}
          >
            {t('diagnostics.reload')}
          </Button>
          <Button
            disabled={pending || !hasLog}
            htmlType="button"
            title={hasLog ? saveTitle : t('diagnostics.nothingToCopy')}
            type="fill"
            onClick={onCopyLog}
          >
            {t('diagnostics.copy')}
          </Button>
        </Flexbox>
      </Surface>
      <Surface title={t('diagnostics.content')}>
        {hasLog ? (
          <pre className={styles.log}>{logContent}</pre>
        ) : (
          <Empty
            title={recording ? t('diagnostics.emptyRecording') : t('diagnostics.emptyOff')}
            description={
              recording
                ? t('diagnostics.emptyRecordingDescription')
                : t('diagnostics.emptyOffDescription')
            }
          />
        )}
      </Surface>
    </div>
  );
}
