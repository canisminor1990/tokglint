# Tokglint

Windows desktop app: one process with a system tray, a taskbar widget,
and a React settings window. The settings window is a web UI.
The widget is drawn in Rust. Do not redraw it in React.

## Name

The user-facing name is **Tokglint**.
Claude Code, Codex, Cursor, and the other tools are monitored providers,
not the name of this app.

Identity lives in `src-tauri/src/identity.rs`.
Change it there, then keep the installers, window class, mutexes,
startup entry, `%APPDATA%\Tokglint`, and the `tokglint.log` diagnostic log
in sync. The old `ClaudeCodeUsageMonitor` directory is read only for the
one-time migration. Do not write that name back into new code.

- The executable and the portable update asset must be named `Tokglint.exe`.
  The in-app updater looks up that exact name and checks the `sha256:` digest
  returned by GitHub.
- The Cargo package name is `tokglint`. The Rust library crate is `tokglint`.
  The executable name comes from `mainBinaryName` in `tauri.conf.json`
  and from `[[bin]] name = "Tokglint"`.
- The identifier is `com.canisminor.tokglint`.
  Changing it makes Windows treat the install as a different app.
- The WinGet package id is `CanisMinor.Tokglint`.

## Build

`pnpm dev` and `pnpm build` build only the frontend.
Tauri calls them through `beforeDevCommand` and `beforeBuildCommand`.
Do not point those two scripts at the Tauri CLI, or the commands recurse.

- `pnpm dev:app` starts the desktop app and Vite.
- `pnpm build` type-checks and builds the frontend into `dist/`.
- `pnpm build:app` runs that frontend build, compiles and bundles the app,
  then `scripts/collect-release.mjs` copies the final files to `release/`
  at the repository root.

Do not commit `release/`, `dist/`, `node_modules/`, or `src-tauri/target/`.

## Release

Pushing to `main` runs `.github/workflows/release.yml`.
semantic-release reads `.releaserc.mjs` and publishes when a commit since
the last `vX.Y.Z` tag requires a release. Commits use gitmoji conventional
form, enforced by commitlint, for example `✨ feat: ...` or `🐛 fix: ...`.
`feat` releases a minor version. `fix`, `perf`, `style`, `refactor`, and
`build` release a patch. `docs`, `test`, `ci`, and `chore` stay unpublished.

The workflow builds on `windows-latest`. It writes that version into
`package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`,
and publishes a stable GitHub release. The updater loads releases from
`repository` in `src-tauri/Cargo.toml`:
`https://github.com/canisminor1990/tokglint`. The release contains exactly
one `Tokglint.exe`. Installers may sit beside it. Publish it as a stable
release; the updater follows stable releases only.

The first run tags the previous commit with the `package.json` version when
`main` has no `vX.Y.Z` tag, so later releases continue from that version.

## Skills

Read the one file that matches the task. Do not read the other skills, and do not open a skill's linked files until that skill tells you to.

| Task                                                                             | Read                                                                                                      |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Add a provider, poller, or account                                               | `.agents/skills/add-provider/SKILL.md`                                                                    |
| Change the taskbar widget: meters, layout, width, or a click on a provider block | `.agents/skills/edit-widget/SKILL.md`                                                                     |
| Change a notification-area icon: badge, digits, color, or tray click             | `.agents/skills/edit-tray-icon/SKILL.md`                                                                  |
| Settings-window pages, layout, or copy                                           | The lobe-design block below. Then read `.agents/skills/lobe-design/SKILL.md` and only the stage it lists. |

The widget and the tray icons are theme JSON drawn in Rust. The settings window is the React UI.

<!-- lobe-design:begin · managed by scripts/bootstrap.mjs · 不要手动编辑本块 -->

<!-- lobe-design:mode=compact lang=en -->

## UI design guide (lobe-design · compact)

UI work (new pages, interaction, visuals, design-system cleanup, screenshot restore, pre-launch review) goes through **lobe-design**: `https://github.com/lobehub/lobe-design-skill` (skill version 5.8.0).

```bash
export LOBE_DESIGN="./.agents/skills/lobe-design" # global install: ${HOME}/.claude/skills/lobe-design
```

- **Entry**: read `$LOBE_DESIGN/SKILL.md`; run `node "$LOBE_DESIGN/scripts/route.mjs" "<request verbatim>"` first, then enter one stage at a time and load only what it lists.
- **Read the project layer first**: `.agents/ux/product.md` (platform and applicability), `.agents/ux/components.md` (which component to use); run 05-init to create any missing one.
- **Platform: web**: atoms come from `@lobehub/ui`; values come from `cssVar` tokens.
- **Precedence**: platform and applicability in `product.md` (rules marked not applicable, platform-scoped rules) override the skill's generic rules; other conflicts follow the skill. A project rule that contradicts a universal principle (accessibility, P-xx archetypes) must state its reason.
- **After code changes**: run `node "$LOBE_DESIGN/scripts/lint-lobe.mjs" <changed paths>` (rule set follows the platform in product.md); every FAIL must be fixed.
- **Record corrections**: in `.agents/ux/lobe-design-rules.md`; criteria, layering and upstreaming are in `$LOBE_DESIGN/learnings/README.md` and `$LOBE_DESIGN/CONTRIBUTING.md`.
- **After install or upgrade**: run 05-init (two rounds); `node "$LOBE_DESIGN/scripts/project-scan.mjs" --check` reports a missing or stale project layer.

> Managed by `$LOBE_DESIGN/scripts/bootstrap.mjs`; rerun to update. Pass `--full` for the detailed (Chinese) version with self-iteration and upstreaming rules.

<!-- lobe-design:end -->
