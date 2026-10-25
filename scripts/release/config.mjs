import { semanticRelease } from '@lobehub/lint';
import gitmojiPreset from 'conventional-changelog-gitmoji-config';

const writerOpts = {
  ...gitmojiPreset.writerOpts,
  transform: (commit, context) =>
    gitmojiPreset.writerOpts.transform(
      {
        ...commit,
        notes: commit.notes.map((note) => ({ ...note })),
        references: commit.references.map((reference) => ({ ...reference })),
      },
      context,
    ),
};

const pluginName = (plugin) => (Array.isArray(plugin) ? plugin[0] : plugin);

// semantic-release 25 expects `config` presets to export a factory, while the
// gitmoji preset exports its resolved options as a CommonJS object.
const adaptPlugin = (plugin) => {
  const [name, options = {}] = Array.isArray(plugin) ? plugin : [plugin];
  const rest = Object.fromEntries(Object.entries(options).filter(([key]) => key !== 'config'));

  if (name === '@semantic-release/commit-analyzer') {
    return [name, { ...rest, parserOpts: gitmojiPreset.parserOpts }];
  }

  if (name === '@semantic-release/release-notes-generator') {
    return [name, { ...rest, parserOpts: gitmojiPreset.parserOpts, writerOpts }];
  }

  if (name === '@semantic-release/npm') {
    return [name, { ...rest, npmPublish: false }];
  }

  if (name === '@semantic-release/github') {
    return [name, { ...rest, assets: ['release/*'] }];
  }

  if (name === '@semantic-release/git') {
    const assets = Array.isArray(options.assets) ? options.assets : ['CHANGELOG.md', 'package.json'];
    return [
      name,
      {
        ...rest,
        assets: [
          ...new Set([
            ...assets,
            'src-tauri/tauri.conf.json',
            'src-tauri/Cargo.toml',
            'src-tauri/Cargo.lock',
          ]),
        ],
      },
    ];
  }

  return plugin;
};

export const createReleaseConfig = () => {
  const plugins = semanticRelease.plugins.map((plugin) => adaptPlugin(plugin));
  const execPlugin = [
    '@semantic-release/exec',
    {
      prepareCmd: 'node scripts/release/prepare-desktop.mjs <%= nextRelease.version %>',
    },
  ];
  const npmIndex = plugins.findIndex((plugin) => pluginName(plugin) === '@semantic-release/npm');
  const insertAt = npmIndex === -1 ? plugins.length : npmIndex + 1;
  plugins.splice(insertAt, 0, execPlugin);

  return {
    ...semanticRelease,
    branches: ['main'],
    plugins,
    tagFormat: 'v${version}',
  };
};
