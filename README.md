<a name="readme-top"></a>

<div align="center">

<h1>Tokglint</h1>

<h3>A Windows taskbar widget for AI coding usage</h3>

One process: a system tray, a taskbar widget, and a settings window.
Track limits, balances, and reset times for Claude Code, Codex, Cursor, and more.

[Install](#-installation) · [Providers](#-providers) · [Build](#-build-from-source)

<!-- SHIELD GROUP -->

[![][windows-shield]](#-requirements)
[![][winget-shield]](#-installation)

</div>

<details>
<summary><kbd>Table of contents</kbd></summary>

#### TOC

- [✨ Features](#-features)
- [📋 Requirements](#-requirements)
- [🚀 Installation](#-installation)
- [⌨️ Usage](#️-usage)
- [🔌 Providers](#-providers)
  - [OpenCode](#opencode)
  - [Cursor](#cursor)
  - [Grok](#grok)
  - [Copilot](#copilot)
  - [Grok Bot](#grok-bot)
  - [AIHubMix](#aihubmix)
- [🔒 Data and privacy](#-data-and-privacy)
- [🩺 Troubleshooting](#-troubleshooting)
- [🛠️ Build from source](#️-build-from-source)

####

</details>

## ✨ Features

Tokglint keeps usage in the Windows taskbar. The widget is drawn in Rust.
The settings window is a React app in the same process, so a saved change
reaches the widget immediately.

- Shows the current reading and the time left until that limit resets
- Counts usage up from zero, or down from the full allowance
- Reads Claude Code, Codex, Antigravity, OpenCode, Cursor, Grok, GitHub Copilot, Grok Bot, and AIHubMix
- Keeps more than one config directory for Claude Code and Codex
- Lives in the taskbar, with the tray for settings, refresh, language, and updates
- Docks to the taskbar, and can stay locked there
- Starts with Windows, and refreshes on an interval you choose
- Speaks English and Simplified Chinese, or follows the system language
- Collects no analytics or telemetry

A missing reading stays `--`. A failed read keeps its error.

The taskbar widget and its embedding are based on
[Claude Code Usage Monitor][monitor-link] (MIT).

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 📋 Requirements

- Windows 10 or Windows 11
- At least one supported provider installed and signed in

Claude Code is on by default. Its credentials can come from the CLI, the
Claude desktop app, or WSL. Every other provider stays off until you enable
it under **Providers**.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🚀 Installation

Install the latest release with WinGet:

```powershell
winget install CanisMinor.Tokglint
```

Or download `Tokglint.exe` from the GitHub release for this repository.
The NSIS setup and the MSI install the same app and can sit beside the
portable executable. The in-app updater downloads `Tokglint.exe` and checks
the `sha256:` digest published with that release. A WinGet install can also
update with:

```powershell
winget upgrade --id CanisMinor.Tokglint --exact
```

After installation, the tray icon and the widget are what you see.
Open settings from the tray. Closing the settings window leaves the widget running.
Starting Tokglint again while it is already running opens settings on the existing process.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## ⌨️ Usage

Start the app:

```powershell
Tokglint.exe
```

Open settings directly:

```powershell
Tokglint.exe --settings
```

`--dashboard` does the same thing.

Left-click the Tokglint tray icon to open settings. Right-click it for the menu:
refresh, update frequency, language, startup, updates, and exit.
Hover a provider icon for the latest reading. In the default layout, right-click
the widget for its menu.

Settings has five pages:

| Page        | What it is for                                                                     |
| ----------- | ---------------------------------------------------------------------------------- |
| Overview    | Whether the widget is connected, and whether each enabled provider has a reading   |
| Providers   | Which providers appear on the widget, plus Claude and Codex config directories     |
| Widget      | Usage direction, taskbar lock, tray icons, avatars, reset time, spacing, and order |
| General     | Refresh interval, startup, and language                                            |
| Diagnostics | Optional log of why a read did not update                                          |

**Widget > Usage direction** switches between what has been used and what is left.
Used is the default. Remaining makes a fresh limit read 100% and drain as you work.
The same direction is used on the widget.

**General > Refresh interval** defaults to 15 minutes. Any whole number of minutes
from 1 to 35,791 is accepted. The tray menu also offers 1 minute, 5 minutes,
15 minutes, and 1 hour. **Start with Windows** launches the tray and the widget
after you sign in.

The settings window and the widget share one language: System default, English,
or 简体中文. Other `zh-*` system locales use Simplified Chinese.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🔌 Providers

Turn a provider on under **Providers**. Claude Code and Codex can each watch
more than one config directory. An empty directory uses that tool's local default.
The other providers use the single account already signed in on this computer,
except AIHubMix, which uses a token you paste.

| Provider    | Setup                                                                                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code | Sign in with the Claude Code CLI or desktop app. Windows and WSL credentials are detected automatically.                           |
| Codex       | Install and sign in to the Codex CLI, then enable Codex in **Providers**.                                                          |
| Antigravity | Sign in to Antigravity, then enable it in **Providers**.                                                                           |
| OpenCode    | Connect an OpenCode Go account, add the credentials below, then enable OpenCode in **Providers**.                                  |
| Cursor      | Sign in to Cursor, then enable it in **Providers**. The local session is detected automatically.                                   |
| Grok        | Run `grok login`, then enable Grok in **Providers**. The signed-in session is detected automatically.                              |
| Copilot     | Sign in with the Copilot CLI (`copilot`, then `/login`) or the GitHub CLI (`gh auth login`), then enable Copilot in **Providers**. |
| Grok Bot    | Sign in with the Grok Bot desktop app, then enable Grok Bot in **Providers**.                                                      |
| AIHubMix    | Paste a system access token under **Providers**, then enable AIHubMix.                                                             |

### OpenCode

Set `OPENCODE_GO_WORKSPACE_ID` and `OPENCODE_GO_AUTH_COOKIE`, or create
`%APPDATA%\opencode-go\config.json`:

```json
{
  "authCookie": "__Host-console_session=your-session-cookie-value",
  "workspaceId": "wrk_01..."
}
```

The workspace ID is the `wrk_…` segment of the OpenCode Go console URL.
Copy the `__Host-console_session` cookie from a signed-in `opencode.ai` browser
session, including its name as shown above. A full Cookie header that already
contains `__Host-console_session`, or the legacy `auth` cookie, is accepted
unchanged. Set `OPENCODE_GO_CONFIG_FILE` to read a different file.
Tokglint asks the console JSON API for usage with that workspace ID and cookie.

### Cursor

`CURSOR_SESSION_TOKEN` overrides the session detected from the local Cursor login.
Cursor can show an Auto window and an API window.

### Grok

Usage comes from the session the CLI stores in `%USERPROFILE%\.grok\auth.json`,
through the same billing endpoint the CLI uses for its own usage panel.
Set `GROK_HOME` when the CLI keeps that directory somewhere else.
Only xAI sign-in entries are used. A stored API key does not expose the shared
allowance. Grok reports one pool for the billing period, so the widget shows it
on the long window and leaves the short window empty. Once on-demand spending
starts, that spending replaces the pool on the same row.

### Copilot

Usage comes from `api.github.com/copilot_internal/user`, the endpoint Copilot's
own editors and CLI read. Tokglint tries the first GitHub login that endpoint
accepts, in this order: `COPILOT_GITHUB_TOKEN`, `GH_TOKEN`, or `GITHUB_TOKEN`,
then the Copilot CLI login, then the GitHub CLI login. Both CLI logins are read
from Windows Credential Manager. Copilot spends one premium-request pool per
calendar month, so the widget shows it on the long window and leaves the short
window empty.

### Grok Bot

Sign in with the Grok Bot desktop app. Tokglint reads the short-lived access
token that app stores in its profile, and leaves renewal to Grok Bot.
The profile defaults to `%APPDATA%\Grok Bot`. Set `GROK_BOT_PROFILE` when the
profile lives somewhere else.

### AIHubMix

On the AIHubMix settings site, create a **system access token** and paste it
into **Providers**. That token reads the account balance. One dollar is
500,000 quota units. **Usage limit** is an optional dollar cap for the progress
bar and the tooltip. Leave it empty and the tooltip shows the balance alone.
The amount on the widget stays the account balance.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🔒 Data and privacy

Tokglint reads local sign-in material for the providers you enable, and sends
usage requests straight to those providers' own services. It has no backend,
collects no telemetry, and does not upload credentials or project files.

Provider credential files are read in place. When Grok rejects a stored token,
Tokglint asks the Grok CLI to refresh its own session. The AIHubMix token is
saved in Tokglint settings. An OpenCode Go cookie saved in a JSON file is plain
text and should be protected like a browser session cookie.

Settings, themes, and the usage cache live in `%APPDATA%\Tokglint`.
The first launch renames an existing `%APPDATA%\ClaudeCodeUsageMonitor` folder
to that path.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🩺 Troubleshooting

Hover the tray icon for the latest failure, or open **Overview** and **Providers**.
Missing credentials, a rejected login, a network failure, an HTTP error, and an
unexpected response each have their own message. Sign in again with the app or
CLI that owns the account, then refresh.

Open **Diagnostics** and turn logging on before you reproduce the problem.
You can reload or copy the log from that page. Logging stays off until you enable it.

You can also start a diagnostic session from the command line:

```powershell
Tokglint.exe --diagnose
```

`--diagnose-append` keeps the existing log. Otherwise a new `--diagnose`
session replaces it. The log is `%TEMP%\tokglint.log`.
Application settings are `%APPDATA%\Tokglint\settings.json`.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🛠️ Build from source

Install [Node.js 22](https://nodejs.org/), pnpm, and [Rust via rustup](https://www.rust-lang.org/tools/install).
The release workflow uses the stable Rust toolchain.

```powershell
pnpm install
pnpm dev:app
```

`pnpm dev:app` starts the desktop app and the Vite dev server.
`pnpm dev` and `pnpm build` build only the frontend. Tauri calls them itself.
`pnpm build:app` type-checks and builds the frontend, compiles the app, and
copies the result to `release\` at the repository root:

- `Tokglint.exe`, the portable build
- The NSIS setup and the MSI, when the bundler produced them

```text
tokglint/
  src/                 React settings (@lobehub/ui)
  src-tauri/src/
    lib.rs             Process entry: settings window and widget thread
    settings.rs        Settings JSON for React
    engine/            Widget, tray, usage polling, and theme drawing
  locales/             English and Simplified Chinese
```

Pushing to `main` runs `.github/workflows/release.yml`.
semantic-release publishes a stable GitHub release when a gitmoji
conventional commit requires one, and writes that version into
`package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`.
The workflow builds on `windows-latest`. That release contains exactly one
`Tokglint.exe`.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

---

The taskbar widget is based on [Claude Code Usage Monitor][monitor-link],
which is [MIT][monitor-license] licensed.

<!-- LINK GROUP -->

[back-to-top]: https://img.shields.io/badge/-BACK_TO_TOP-151515?style=flat-square
[monitor-license]: https://github.com/CodeZeno/Claude-Code-Usage-Monitor/blob/main/LICENSE
[monitor-link]: https://github.com/CodeZeno/Claude-Code-Usage-Monitor
[windows-shield]: https://img.shields.io/badge/platform-Windows-0078D4?logo=windows&logoColor=white&labelColor=black&style=flat-square
[winget-shield]: https://img.shields.io/badge/WinGet-CanisMinor.Tokglint-60A5FA?labelColor=black&style=flat-square
