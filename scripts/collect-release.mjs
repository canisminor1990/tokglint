import { cpSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const portableName = 'Tokglint.exe';
const root = path.join(fileURLToPath(new URL('.', import.meta.url)), '..');
const built = path.join(root, 'src-tauri', 'target', 'release');
const output = path.join(root, 'release');

function requireDirectory(directory) {
  if (!statSync(directory, { throwIfNoEntry: false })?.isDirectory()) {
    console.error(`Missing build output: ${directory}`);
    process.exit(1);
  }
}

function collectInstallers(directory, found) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectInstallers(entryPath, found);
    else if (/\.(?:exe|msi)$/i.test(entry.name)) found.push(entryPath);
  }
}

requireDirectory(built);

const applications = readdirSync(built).filter((name) => name.endsWith('.exe'));
const portable = applications.find((name) => name === portableName) ?? applications[0];
if (!portable) {
  console.error(`No executable in ${built}`);
  process.exit(1);
}

const installers = [];
const bundle = path.join(built, 'bundle');
if (statSync(bundle, { throwIfNoEntry: false })?.isDirectory()) {
  collectInstallers(bundle, installers);
}

rmSync(output, { recursive: true, force: true });
mkdirSync(output);

const copied = [portableName];
cpSync(path.join(built, portable), path.join(output, portableName));
for (const installer of installers) {
  const name = path.basename(installer);
  cpSync(installer, path.join(output, name));
  copied.push(name);
}

console.log(copied.map((name) => `release/${name}`).join('\n'));
