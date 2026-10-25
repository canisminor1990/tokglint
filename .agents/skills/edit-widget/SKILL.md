---
name: edit-widget
description: >
  Edits the Tokglint taskbar widget: provider blocks, meters, width, order,
  and left-click. Use when the user mentions the widget, 挂件, taskbar strip,
  classic layout, vertical widget, or compact quad. Not for notification-area
  badges, and not for adding a provider.
---

# Edit the widget

The widget is theme JSON rasterized in Rust. Do not redraw it in React. The settings window only saves and notifies the same process.

Adding a provider's blocks is `../add-provider/SKILL.md`. Tray badges are `../edit-tray-icon/SKILL.md`. This skill changes the taskbar surface that already exists.

## Which file

Surface 0 is the widget. Later surfaces are tray icons. Do not edit those while changing the widget. On `classic-vertical`, surfaces after the first must stay JSON-equal to `classic-usage-widget`; a widget edit stays on surface 0.

| File                                                    | Surface 0                                                |
| ------------------------------------------------------- | -------------------------------------------------------- |
| `src-tauri/src/engine/themes/classic-usage-widget.json` | Horizontal strip, id `main`, height 46. Default builtin. |
| `src-tauri/src/engine/themes/classic-vertical.json`     | Column. Block order follows `ProviderId::ALL`.           |
| `src-tauri/src/engine/themes/compact-fluent-quad.json`  | Its own strip.                                           |

JSON is compiled in. A change appears only after a Rust rebuild.

The user named a theme: edit that file. They said "the widget" without a theme: edit classic, then carry the same behavior (bindings, click, missing state) onto the other two surface-0 documents. Keep each theme's own geometry.

Appearance that tests lock on classic:

- `built_in_classic_uses_149_geometry`: one of Claude/Codex/Antigravity is 168×46, two are 328×46, all three are 488×46.
- `starter_adapts_width_segments_and_collapsed_provider_rows`: those widths, and the single-provider widths (Cursor and OpenCode 194, Grok and Copilot 168).

Change a block's width only together with the surface `width` expression and those expected numbers. Do not edit the expected numbers to hide a formula that no longer matches the blocks.

## Provider block

Children are a flat list with `parent`. The hit target is `{key}-provider`:

- `render` is `providers.<key>.enabled`.
- `order` is `widget.order.<key>`.
- Width and height cover the meter. Logo, bars, and labels are children with no `mouse_events`, so the click falls through to the block.
- Both `click` and `double_click` are `open_provider("<key>")`. `<key>` is the `ProviderId` key.
- `fable-provider` is Claude's extra column: `providers.claude.enabled && claude.model.fable.available`, order `widget.order.claude + 0.5`, and `open_provider("claude")`.

The root's `right_click` stays `show_context_menu("classic-v1")`. The root has no left click, so padding between blocks does nothing. Dragging is the Win32 host (`pending_drag`), not a theme action.

`render` 0 drops the block out of layout. `visibility` 0 keeps the gap. `widget.gap`, `widget.show_avatar`, and `widget.order.*` come from settings (`widget_appearance_changes_gap_avatar_and_provider_order`).

## Meters

`{provider.session.display:usage_line}` and the weekly twin. `*.display` follows the countdown setting. `headline.percentage` is the spent share, so `>= 90` means the allowance is nearly gone.

A missing read is `--`. A failure is `!`. Do not show `0%` for a failed read, and do not change `format_usage_line`. Classic digits stay neutral; the avatar carries the provider. Brand color belongs on the tray badge.

Vertical headings need `{key}-title` and `{key}-title-light`. A short block (Grok, Copilot, AIHubMix are 42, others 64) is in the surface height formula and in `provider_height` inside `classic_vertical_stacks_enabled_providers_and_preserves_tray_roots`. Inserting a block moves every later `y`.

Compact money text that must format as `$24.10` stays on `${provider.credits.balance:0.00}`. A manual cap label is `{provider.cap.label}`, and the bar is `cap.percent`. Details are in the add-provider skill.

## Check

From `src-tauri`:

```powershell
cargo test --lib -- built_in_classic_uses_149_geometry starter_adapts_width_segments_and_collapsed_provider_rows widget_appearance_changes_gap_avatar_and_provider_order classic_vertical_stacks_enabled_providers_and_preserves_tray_roots compact_fluent_quad_widget_respects_usage_direction built_in_themes_are_valid_and_cannot_be_saved_as_editable_themes
```

`theme.validate()` must stay empty.
