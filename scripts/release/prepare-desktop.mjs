import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const portableName = 'Tokglint.exe';

export function bumpJsonVersion(text, version) {
  const next = text.replace(/"version"\s*:\s*"[^"]+"/, `"version": "${version}"`);
  if (next === text) throw new Error('No version field found.');
  return next;
}

export function bumpCargoVersion(text, version) {
  const next = text.replace(/^version = "[^"]+"/m, `version = "${version}"`);
  if (next === text) throw new Error('No Cargo package version found.');
  return next;
}

export function bumpLockVersion(text, version) {
  const next = text.replace(
    /(\[\[package\]\]\r?\nname = "tokglint"\r?\nversion = ")[^"]+(")/,
    `$1${version}$2`,
  );
  if (next === text) throw new Error('No tokglint package in Cargo.lock.');
  return next;
}

export function injectRepository(text, url) {
  const line = `repository = "${url}"`;
  if (/^repository\s*=/m.test(text)) {
    return text.replace(/^repository\s*=\s*".*"/m, line);
  }
  const next = text.replace(/^(edition\s*=\s*"2021"\r?\n)/m, `$1${line}\n`);
  if (next === text) throw new Error('Cargo.toml has no edition line to attach repository to.');
  return next;
}

export function repositoryUrlFromRemote(remote) {
  const ssh = /^git@github\.com:(.+?)(?:\.git)?$/u.exec(remote);
  if (ssh) return `https://github.com/${ssh[1]}`;
  const https = /^https:\/\/github\.com\/(.+?)(?:\.git)?$/u.exec(remote);
  if (https) return `https://github.com/${https[1]}`;
  throw new Error(`Cannot derive a GitHub repository URL from ${remote}`);
}

function repositoryUrl() {
  if (process.env.GITHUB_REPOSITORY) return `https://github.com/${process.env.GITHUB_REPOSITORY}`;
  const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim();
  return repositoryUrlFromRemote(remote);
}

function requireVersion(version) {
  if (!/^\d+\.\d+\.\d+$/u.test(version)) {
    throw new Error(`Expected a stable version, received ${version ?? ''}.`);
  }
}

function writeVersion(file, version, bump) {
  writeFileSync(file, bump(readFileSync(file, 'utf8'), version));
}

function assertPortableAsset(root) {
  const releaseDir = path.join(root, 'release');
  const portable = readdirSync(releaseDir).filter((name) => name === portableName);
  if (portable.length !== 1) {
    throw new Error(`The release directory must contain exactly one ${portableName}.`);
  }
}

export function prepareDesktop(version, root = process.cwd()) {
  requireVersion(version);
  const cargoPath = path.join(root, 'src-tauri', 'Cargo.toml');
  writeVersion(path.join(root, 'package.json'), version, bumpJsonVersion);
  writeVersion(path.join(root, 'src-tauri', 'tauri.conf.json'), version, bumpJsonVersion);
  writeVersion(path.join(root, 'src-tauri', 'Cargo.lock'), version, bumpLockVersion);

  const versioned = bumpCargoVersion(readFileSync(cargoPath, 'utf8'), version);
  writeFileSync(cargoPath, injectRepository(versioned, repositoryUrl()));
  try {
    const build = spawnSync('pnpm', ['build:app'], {
      cwd: root,
      shell: true,
      stdio: 'inherit',
    });
    if (build.status !== 0) process.exit(build.status ?? 1);
    assertPortableAsset(root);
  } finally {
    writeFileSync(cargoPath, versioned);
  }
}

const isCli =
  process.argv[1] &&
  path.resolve(fileURLToPath(import.meta.url)).toLowerCase() ===
    path.resolve(process.argv[1]).toLowerCase();

if (isCli) prepareDesktop(process.argv[2]);
