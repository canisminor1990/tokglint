import {
  AiHubMix,
  Antigravity,
  ClaudeCode,
  Codex,
  Cursor,
  GithubCopilot,
  Grok,
  GrokBot,
  OpenCode,
} from '@lobehub/icons';

import type { ProviderKey } from '../types';

const AVATAR = { shape: 'square' as const, size: 32 };

export function ProviderIcon({ provider }: { provider: ProviderKey }) {
  switch (provider) {
    case 'claude': {
      return <ClaudeCode.Avatar {...AVATAR} />;
    }
    case 'codex': {
      return <Codex.Avatar {...AVATAR} />;
    }
    case 'antigravity': {
      return <Antigravity.Avatar {...AVATAR} color="#000" />;
    }
    case 'opencode': {
      return <OpenCode.Avatar {...AVATAR} />;
    }
    case 'cursor': {
      return <Cursor.Avatar {...AVATAR} />;
    }
    case 'grok': {
      return <Grok.Avatar {...AVATAR} />;
    }
    case 'grok_bot': {
      return <GrokBot.Avatar {...AVATAR} />;
    }
    case 'aihubmix': {
      return <AiHubMix.Avatar {...AVATAR} />;
    }
    case 'copilot': {
      return <GithubCopilot.Avatar {...AVATAR} />;
    }
    default: {
      return null;
    }
  }
}
