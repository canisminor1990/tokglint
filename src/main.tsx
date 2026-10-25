import '@lobehub/ui/theme.css';
import '@lobehub/ui/style.css';
import './i18n';

import { setLobeTheme } from '@lobehub/ui';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { SWRConfig } from 'swr';

import { setWindowChrome } from './api';
import App from './App';

function tokenRgb(name: string): [number, number, number] | null {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const match = /^#([\da-f]{6})$/i.exec(value);
  if (!match) return null;
  const hex = Number.parseInt(match[1], 16);
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
const applySystemTheme = () => {
  const appearance = colorScheme.matches ? 'dark' : 'light';
  setLobeTheme({ appearance });
  const background = tokenRgb('--lobe-color-bg-layout');
  const text = tokenRgb('--lobe-color-text');
  if (background && text) void setWindowChrome(background, text, appearance === 'dark');
};

applySystemTheme();
colorScheme.addEventListener('change', applySystemTheme);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <SWRConfig value={{ dedupingInterval: 1000, revalidateOnFocus: true }}>
      <App />
    </SWRConfig>
  </React.StrictMode>,
);
