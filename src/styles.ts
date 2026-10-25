import { createStaticStyles } from '@lobehub/ui';

export const styles = createStaticStyles(({ css, cssVar }) => ({
  addAccount: css`
    margin-block-start: 24px;
  `,
  account: css`
    display: flex;
    flex-direction: column;
    gap: 12px;
  `,
  accountList: css`
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding-block-start: 4px;
  `,
  field: css`
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  `,
  log: css`
    overflow: auto;

    max-height: 360px;
    margin: 0;
    padding: 12px;
    border-radius: ${cssVar.borderRadius};

    font-family: ${cssVar.fontFamilyCode};
    line-height: 1.5;
    color: ${cssVar.colorText};
    overflow-wrap: anywhere;
    white-space: pre-wrap;

    background: ${cssVar.colorFillQuaternary};
  `,
  meter: css`
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  `,
  meterBlock: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-inline-start: 44px;
  `,
  meters: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  `,
  mark: css`
    flex-shrink: 0;
  `,
  orderItem: css`
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
  `,
  orderList: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 280px;
  `,
  nav: css`
    padding-block-start: 8px;
  `,
  nameRow: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
  `,
  providerCardName: css`
    overflow: hidden;
    min-width: 0;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  providerCardTitle: css`
    width: 100%;
    min-width: 0;
  `,
  providerGrid: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;

    @media (width <= 720px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  providerGridTitle: css`
    margin: 0;

    font-size: 16px;
    font-weight: 500;
    line-height: 1.4;
    color: ${cssVar.colorText};
  `,
  providerGridHead: css`
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
  `,
  providerSection: css`
    display: flex;
    flex-direction: column;
    gap: 12px;
  `,
  providerBreak: css`
    margin-block-start: 20px;
    padding-block-start: 20px;
    border-block-start: 1px solid ${cssVar.colorBorder};
  `,
  page: css`
    display: flex;
    flex-direction: column;
    gap: 24px;

    width: 100%;
    min-width: 0;
    max-width: 880px;
    margin-inline: auto;
  `,
  row: css`
    padding-block: 12px;
  `,
  rowControl: css`
    flex: 0 1 auto;
    max-width: 100%;
  `,
  rowMain: css`
    flex: 1 1 220px;
    min-width: 0;
  `,
  shell: css`
    height: 100%;
  `,
  status: css`
    min-width: 4em;
    text-align: end;
  `,
  switchLabel: css`
    display: inline-flex;
    gap: 8px;
    align-items: center;
  `,
  tools: css`
    display: flex;
    gap: 12px;
    align-items: center;
  `,
}));
