/* eslint-disable @typescript-eslint/no-require-imports -- lobe-i18n loads this file synchronously */
const { defineConfig } = require('@lobehub/i18n-cli');

module.exports = defineConfig({
  entry: 'locales/en_US',
  entryLocale: 'en_US',
  keyStyle: 'auto',
  temperature: 1,
  modelName: 'gpt-5-mini',
  output: 'locales',
  outputLocales: ['zh_CN'],
  saveImmediately: true,
  experimental: {
    jsonMode: true,
  },
  reference:
    'Tokglint is a desktop usage monitor. Keep product names, CLI commands, environment variables, and placeholders such as {name} and {version} unchanged.',
});
