---
name: edit-tray-icon
description: >
  Edits Tokglint notification-area icons: badge artwork, digits, brand color,
  and left-click. Use when the user mentions the tray, 托盘, tray icon, badge,
  徽章, or a provider icon in the notification area. Not for the taskbar
  widget strip, and not for adding a provider.
---

# Edit a tray icon

Tray icons are theme surfaces. Explorer places them. Rust rasterizes the surface into the icon. Do not draw them in React, and do not add a Win32 resource icon.

Adding a provider's first icon is `../add-provider/SKILL.md`. This skill changes an icon that already exists.

## Files

Builtin themes are compiled in. A JSON edit appears only after a Rust rebuild (`build.rs` copies the files into `OUT_DIR`).

| Theme                                                   | Tray surfaces                           |
| ------------------------------------------------------- | --------------------------------------- |
| `src-tauri/src/engine/themes/classic-usage-widget.json` | `{key}-tray-icon`                       |
| `src-tauri/src/engine/themes/classic-vertical.json`     | same JSON as classic, after surface 0   |
| `src-tauri/src/engine/themes/compact-fluent-quad.json`  | its own copies, plus `shared-tray-icon` |

Edit the classic tray surface, then paste every surface after the first into `classic-vertical.json`. Those surfaces must stay JSON-equal. Compact is a separate copy. `the_classic_theme_shows_one_badge_digit_group_in_both_usage_directions` skips a missing `{key}-tray-icon`, so a green test does not mean the icon exists.

Leave surface 0 alone. That is the taskbar widget (`edit-widget`).

## What a tray surface is

- `"nest": "tray_icon"`. Id `{key}-tray-icon` (`claude-tray-icon`). `render` is `providers.<key>.enabled`.
- Artwork is 64×64. A surface whose longer side would exceed 512px at the chosen scale is dropped and logged.
- Explorer owns position, overflow, DPI, and drag order. There is no offset to author.
- No `tooltip` field. `themed_tray_tooltip` in `window.rs` keeps only the provider named by `{key}-tray-icon`. Any other tray id gets the full usage summary.
- `show_tray_icons` false removes every icon. The unthemed fallback icon opens Tokglint settings; leave that path alone.

## Click

On each `{key}-tray-icon` set both:

```json
"click": "open_provider(\"<key>\")",
"double_click": "open_provider(\"<key>\")"
```

`right_click` stays `show_context_menu("classic-v1")`.

`<key>` is a `ProviderId` key (`grok_bot`, not `grok-bot`). The page is `ProviderId::dashboard_url`. OpenCode appends `/console/<workspace>/go` when the local workspace id is known (`poller/opencode.rs`).

Set click and double-click to the same action. A double-click on a tray surface with no double-click handler opens Tokglint settings.

`compact-fluent-quad.json` has `shared-tray-icon` (name Tokglint, `render` is `1`). Its click stays `toggle("main", render)` on both click and double-click. That icon is not a provider.

Only the root needs `mouse_events`. Children with empty handlers do not take the hit.

## Digits and color

One non-credit digit layer is visible at a time. The test checks spent 0, 5, 42, 90, 95, and 100, with countdown on and off.

The template and its `render` gate use the same binding. A template that prints `headline.display` while the gate still reads another field picks the wrong size. Gates are `< 9.5` and `< 99.5`.

Credit digit layers (`*-tray-credit-*`) are separate and stay gated on `credits.available`. Do not count them as the percentage badge.

Read the surface before recoloring. Brand fills use `#RRGGBBFF`. Claude's percentage digits are `#000000FF` on a light badge. The other badges use `#FFFFFFFF` digits. The loading placeholder is that provider's own letters.

## Check

From `src-tauri`:

```powershell
cargo test --lib -- starter_has_a_taskbar_widget_and_provider_tray_icons starter_tray_icons_follow_enabled_providers the_classic_theme_shows_one_badge_digit_group_in_both_usage_directions classic_vertical_stacks_enabled_providers_and_preserves_tray_roots built_in_themes_are_valid_and_cannot_be_saved_as_editable_themes
```

`theme.validate()` must stay empty. Fix the script it names.
