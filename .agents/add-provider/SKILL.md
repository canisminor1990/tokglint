---
name: add-provider
description: >-
  Adds a usage provider to Tokglint: poller, settings,
  taskbar themes, tray badge, and the settings window. Use when the user asks
  to add, wire, or register a provider, 提供商, or 服务商, or names a new AI
  account whose usage should appear on the widget.
---

# Add a provider

Append one provider. Do not renumber existing `ProviderId` values, rewrite the theme engine, or restyle providers that already exist.

Copy profile for any new sentence: no 您. Say 挂件 and 提供商. Do not commit, and do not pack the NSIS installer, unless the user asks.

## Before editing

Read the provider's API and decide which meter it is:

- **Windows** — session and/or weekly percentages. Leave `credits` unset. Clone Claude, Codex, or Cursor in the themes.
- **One allowance** — a single spent percentage, no five-hour window. Clone Grok or Copilot.
- **Balance** — remaining and total currency. Fill `CreditsSection` (`percentage` is spent share, `remaining` and `total` are currency units). Clone AIHubMix, including its cap display below. Headline bindings already follow credits for every provider except `grok_bot`.

If `@lobehub/icons` has no avatar, or `@lobehub/icons-static-avatar/avatars/` has no `<id>.webp`, stop and ask. Do not draw, trace, or rasterize a mark. The theme SVG rasterizer only accepts a single root `fill`, one `d`, and `M` / `L` / `Z` separated by whitespace.

## 1. Identity

`src-tauri/src/engine/providers.rs`

- Append the next `#[repr(u8)]` discriminant. Never reuse or reorder.
- `PROVIDER_DESCRIPTORS[self as usize]` must stay true: descriptor index equals the discriminant, no gaps.
- Set `key`, `cache_key`, English `display_name`, English `settings_description`, `default_enabled: false`.
- `native_menu_command_id`: next free `u16`. Already taken: the ids in `PROVIDER_DESCRIPTORS`, plus `67` and `68` (Antigravity pools) and `71` (`IDM_DASHBOARD` in `window.rs`).
- Append the same variant to `ALL` and `WIDGET_ORDER`.
- Grow every fixed array whose length is the provider count: `ALL`, `WIDGET_ORDER`, `PROVIDER_DESCRIPTORS`, `widget_order_ranks` (`[u8; N]`), `PROVIDER_POLLERS`, and `ThemeRuntime.provider_order`. Do not resize unrelated arrays such as `WINGET_SHOW_VERSIONS_ARGS`.

`display_name` and `settings_description` must exist as keys in `translations` of both `locales/en_US/common.json` and `locales/zh_CN/common.json`.

## 2. Poller

Add `src-tauri/src/engine/poller/<key>.rs`, `mod` it from `poller.rs`, and append a `PROVIDER_POLLERS` entry.

Map failures the way `poller/grok.rs` and `poller/copilot.rs` do:

| Situation                                     | `PollError`          |
| --------------------------------------------- | -------------------- |
| No local login, or a required secret is empty | `NoCredentials`      |
| HTTP 401 or 403                               | `AuthRequired`       |
| Other HTTP status                             | `HttpStatus`         |
| Connection failure                            | `NetworkError`       |
| Body is not the documented shape              | `UnexpectedResponse` |

`credential_watch_snapshot` returns a stable hash of the credential, or `<key>:missing`. Never log the secret. Unit-test the mapping with fixture bodies. Do not call the network from tests.

A pasted token is read on each poll from `app_settings::load_settings()`, not from the settings-window DTO.

## 3. Settings, both processes

The widget and the settings window share `%APPDATA%/ClaudeCodeUsageMonitor/settings.json`. Disk keys are snake_case. The React IPC types are camelCase.

Update both:

- `src-tauri/src/engine/app_settings.rs` — `SettingsFile` field `show_<key>`, `provider_enabled`, `set_provider_enabled`, defaults, and the settings-json test.
- `src-tauri/src/settings.rs` — `SettingsDto` and `SettingsPatch` (`show_<key>` under `rename_all = "camelCase"`), load, `apply_patch`, the hand-written JSON object, and the `any_provider` check so this provider can be the only one enabled.

Optional secret fields (only when the provider cannot find a local login) go through the same two structs. Trim on save.

Only Claude and Codex have account profiles. A new provider uses the single-account row unless the user asks for config directories.

## 4. Widget themes

Builtin themes are JSON compiled into the binary. Editing them does nothing until a Rust rebuild. Files:

- `src-tauri/src/engine/themes/classic-usage-widget.json` (starter)
- `src-tauri/src/engine/themes/classic-vertical.json`
- `src-tauri/src/engine/themes/compact-fluent-quad.json`

In each file, clone the closest provider's widget objects and its `<key>-tray-icon` surface. Replace only that provider's key and display name. Then add the same `providers.<key>.enabled` term that source uses in the surface width or height formula at the top of the file.

Widget-block rules are in `.agents/skills/edit-widget/SKILL.md`. Tray-surface rules are in `.agents/skills/edit-tray-icon/SKILL.md`. Read the one that matches the part you are cloning.

Rules that tests enforce:

- On `classic-vertical` surface 0, `{key}-provider` blocks follow `ProviderId::ALL`. A 42px block inserted before a later provider shifts every `y` after it.
- Surfaces after the first on `classic-vertical` must stay JSON-equal to `classic-usage-widget`. Paste the classic tray surface into both. Do not hand-edit one copy.
- Compact is independent. Clone its own tray surface too. `the_classic_theme_shows_one_badge_digit_group_in_both_usage_directions` skips a missing tray surface, so a green test does not mean the tray exists.
- Vertical headings require `{key}-title` and `{key}-title-light` on surface 0.
- A short vertical block (Grok, Copilot, AIHubMix are 42, others 64) must be added to the height formula and to `provider_height` in `classic_vertical_stacks_enabled_providers_and_preserves_tray_roots`.

Logo:

1. Copy `node_modules/@lobehub/icons-static-avatar/avatars/<id>.webp` onto `src-tauri/src/engine/themes/assets/<key>.webp`. Keep the bytes identical.
2. Register it in `BUNDLED_LOGO_ASSETS` in `theme_engine.rs`.
3. Point both dark and light image slots at that webp.

Unknown readings stay `--`. Failures stay `!`. Do not change `format_usage_line`.

Tray color is the brand color from `@lobehub/icons` (`COLOR_PRIMARY`, the avatar background), written `#RRGGBBFF`. Paint that provider's tray background, high-outline, low-fill, and high-fill. Digits stay `#FFFFFFFF`. The loading placeholder is that provider's letters (`Ai`), not the letters of the surface you cloned (`Cp` is Copilot). Other black or white trays are intentional; a name like "green fill" does not mean the hex is wrong. The digit-badge test does not check color.

The printed tray digit and its render gates (`< 9.5`, `< 99.5`) must be the same binding. A template that prints one number while the gate still reads `headline.display` picks the wrong font size.

`provider.credits.balance` is the wallet. `provider.credits.total` is the currency ceiling. `provider.credits.remaining` in a theme is `100 - percentage`, not money. `*.display` follows the countdown setting. A ratio that must stay put when countdown is on goes in a binding that does not end in `.display` (`cap.percent`). `headline.percentage` stays the spent share, so `>= 90` still means the allowance is nearly used.

`$23/$100` does not fit the 80px balance slot; `DrawText` ellipsizes it. Classic: text width 100, the line and the provider 160, and the strip coefficient `(160 - 124) = 36`. Compact: the text width and the provider's `+ N` are the same number; the canvas formula's base term ends in `+ 62`, so that provider's extra coefficient is `N - 62`.

## Balance with a manual cap

AIHubMix is the pattern. The cache stores the raw wallet: remaining, used, total = remaining + used. Do not write the user's cap into the cache. Apply it once, at display time, in the theme context and in `usage_summary_lines`. `with_usage_limit` is not idempotent: a limit of 0 stores `total = 0`, and a second call then treats used as 0. Saving settings does not re-poll; display-time application is what makes a new cap show up immediately.

When the cap is greater than 0:

- Widget text is whole dollars, balance over cap: `$23/$100`. Build that string in Rust (`cap.label`) and put `{provider.cap.label}` in the theme. Do not extend a `${provider.credits.balance:0.00}` template. `compact_fluent_quad_widget_respects_usage_direction` requires every such template to format as exactly `$24.10`.
- The bar is remaining / cap, about 23% for `$23.47` of `$100`. Bind it to `cap.percent`. Do not bind it to `credits.display` or to spent/cap.
- The tooltip keeps cents on the balance: `$23.47/$100`. A whole cap has no `.00`. A fractional cap keeps two decimals. Uncapped, the tooltip is the balance with cents and nothing else.
- Overview uses the same whole-dollar label and the same remaining/cap percent. Do not run that percent through the countdown flip.

When the cap is empty or 0, `total` stays 0. The widget shows the whole-dollar balance alone. Never show `/$0`, and never present used + balance as if it were a plan limit.

## 5. Tooltip and strings

`usage_summary_lines` in `window.rs` decides which windows a tooltip names. A balance or single-allowance provider must not gain a `5h` line or an unlabeled weekly line. A balance tooltip is the wallet with cents, or `$23.47/$100` when a cap is set. It is not spent/cap. Extend the existing match arms and the test `tooltip_omits_windows_the_provider_does_not_have`.

The taskbar widget tooltip lists every enabled provider. Each tray icon tooltip does not: `themed_tray_tooltip` keeps only the provider named by that surface id (`cursor-tray-icon` shows Cursor). A tray surface that is not `{key}-tray-icon` still gets the full summary.

`locales/{en_US,zh_CN}/common.json`:

- Add the same `strings` keys to both files. They become fields on the generated `Strings` struct. `cargo` fails if the key sets differ.
- Add `translations` entries for `display_name` and `settings_description`.
- Point `provider_auth_error` in `localization/mod.rs` at `<key>_token_expired_title` and `<key>_token_expired_body`.

`locales/{en_US,zh_CN}/settings.json`: add `providers.items.<key>`. Write the Chinese yourself. Do not run `pnpm i18n` unless asked.

## 6. Settings window

- `src/types.ts`: `ProviderKey`, `DEFAULT_PROVIDER_ORDER`, a `PROVIDERS` entry (`settingsField: 'show<Name>'`, `defaultEnabled: false`), and the `Settings` fields.
- `src/usage.ts`: `CACHE_KEY` must equal `cache_key`. Overview cards come from `usageFacts`. Do not add a card by hand.
- `src/components/ProviderIcon.tsx`: `<Brand.Avatar />` from `@lobehub/icons`.
- `src/devPreview.ts`: `show<Name>: false`, empty secret, and the key in `providerOrder`.
- `src/pages/ProvidersPage.tsx`: a switch is enough. Usage meters stay on Overview only. A secret field is the exception, and it commits on blur and Enter. Do not log it.

Atoms come from `@lobehub/ui`. If the new control is more than a switch, follow the project's lobe-design skill.

## 7. Check

From the repo root, `pnpm build` first whenever `src/` changed. `cargo build` does not run it, and `tauri::generate_context!` panics when `src-tauri/../dist` is missing.

```powershell
cargo test --lib
```

Run that in `src-tauri`. PowerShell rejects `&&`. `cargo test --lib` takes one filter, so prefer the full suite after a provider add. Fix every new non-exhaustive match. Leave the pre-existing unreachable-pattern warning in `theme_engine/tests.rs` alone.

`cargo build` warns about items that only tests call, because it does not compile tests. `#![cfg_attr(not(test), allow(dead_code))]` on `src-tauri/src/lib.rs` is there for that. Do not delete updater helpers or test-only items to clear it.

`cargo build --release` writes `src-tauri/target/release/Tokglint.exe` because `[[bin]] name = "Tokglint"` is set. The Cargo package name is `tokglint`. The identifier is `com.codezeno.tokglint`; changing it makes Windows treat the install as a different app. A release build does not run `pnpm build`; the embedded UI is whatever is already in `dist/`.

Settings UI: `pnpm dev`, then open `http://localhost:1420` (not `127.0.0.1`). Turn the provider on. Overview shows one card, avatar and name in the title. Providers shows no usage bar.

Ship the widget only when the user wants the desktop process updated: stop `Tokglint` (it locks `src-tauri/target/release/Tokglint.exe`), `cargo build --release` in `src-tauri`, then `Start-Process` that exe.
