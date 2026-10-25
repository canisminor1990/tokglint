# Localization

English and Simplified Chinese are the supported languages. Catalogue files
live at the repository root:

```
locales/
  en_US/common.json
  en_US/settings.json
  zh_CN/common.json
  zh_CN/settings.json
  meta.json
```

`common.json` is the widget and native-menu catalogue. The Rust build reads it.
`settings.json` is the React settings window. i18next loads both languages
from these files, and the language control switches the window and the widget
together. `meta.json` holds the runtime language code, match patterns, order,
and optional Windows font. It is not translated.

The files follow [lobe-i18n](https://github.com/lobehub/lobe-cli-toolbox/tree/master/packages/lobe-i18n)
folder mode. Configuration lives in `.i18nrc.cjs`. Runtime codes stay `en` and
`zh-CN` so saved settings keep working. `zh-TW`, `zh-HK`, and other `zh-*`
system locales resolve to Simplified Chinese.

To refresh Simplified Chinese from the English catalogue:

```shell
pnpm i18n
```

`OPENAI_API_KEY` is required. `OPENAI_PROXY_URL` is optional. The command
translates only keys that differ from `locales/en_US`.

When widget text changes, edit `locales/en_US/common.json`. When settings-window
text changes, edit `locales/en_US/settings.json`. Then run `pnpm i18n`, or
update the matching `zh_CN` file by hand. In `common.json`, `strings` keys are
typed Rust fields and `translations` keys are the English source text.
Placeholders such as `{name}` and `{version}` must match English. Settings
copy uses i18next placeholders such as `{{name}}`. `cargo build` fails when
`common.json` keys, placeholders, or metadata are incomplete.
