<!-- lobe-design-init: version=5.8.0 fingerprint=c37d17f39da9 -->

# 组件盘点

原子层用 `@lobehub/ui`。页面骨架用 `@lobehub/ui/dashboard` 的 `ConsoleShell`、`PageHeader`、`Surface`、`MetricStrip`。取值走 `cssVar` / `createStaticStyles`。不要自建 Button、Switch、Modal、Table。

## 薄包装

无。没有只透传上游组件的本地包装。

## 与 lobe-ui 重复

无。不要新增与上游同名的原子组件。

## 业务组件

### SettingRow 与 SettingControl

场景：一条设置。左边是标题和说明，右边是开关、数字或选择。

注意：控件放进 SettingControl，让它带上这一行的标签。开关只表示会立即保存的二值项。恢复默认只在值偏离默认时出现。

### UsageMeters

场景：只出现在概览。每个已开启的提供商单独一张卡，头像和名字在卡片标题，进度条在卡内。两列排列。提供商页只放开关和凭据，不放用量。

注意：条的数值跟挂件同一套方向（已用或剩余）。没有读数时只写等待，不画空条。Cursor 用 Auto / API，Grok Bot 的包含用量和按量金额分开画。

### ProviderIcon

场景：提供商身份，出现在概览和提供商列表。

注意：只表示提供商是谁，不拿来当按钮。未知提供商不要画一个自造图标冒充品牌。设置页用 `@lobehub/icons` 的 Avatar。挂件标志用 `@lobehub/icons-static-avatar` 里的同名 webp，不要另做一张。Grok Bot 用 GrokBot，不要用 Grok。AIHubMix 用 AiHubMix。

### AccountEditor

场景：Claude 或 Codex 有多个本机配置目录时，编辑启用哪些、默认哪一个。

注意：删除要确认，并说明挂件将不再读取该目录。保存进行中不要连点。只有一个配置目录的提供商不要套这个编辑器。
