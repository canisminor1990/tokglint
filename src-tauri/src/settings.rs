use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use windows::core::PCWSTR;
use windows::Win32::Storage::FileSystem::{
    MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
};

const POLL_1_MIN: u32 = 60_000;
const MAX_POLL_MINUTES: u32 = i32::MAX as u32 / POLL_1_MIN;
const DEFAULT_POLL_MS: u32 = 900_000;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountProfileDto {
    pub id: String,
    pub name: String,
    pub config_dir: String,
    pub credentials_path: String,
    pub enabled: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderAccountsDto {
    pub profiles: Vec<AccountProfileDto>,
    pub selected: String,
    #[serde(default)]
    pub used_ids: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsDto {
    pub poll_interval_ms: u32,
    pub show_claude_code: bool,
    pub show_codex: bool,
    pub show_antigravity: bool,
    pub show_antigravity_gemini: Option<bool>,
    pub show_antigravity_external: Option<bool>,
    pub show_opencode: bool,
    pub show_cursor: bool,
    pub show_grok: bool,
    pub show_copilot: bool,
    pub show_grok_bot: bool,
    pub show_aihubmix: bool,
    pub aihubmix_token: String,
    pub aihubmix_usage_limit: f64,
    pub usage_countdown: bool,
    pub lock_taskbar: bool,
    pub show_avatar: bool,
    pub show_reset: bool,
    pub show_tray_icons: bool,
    pub widget_gap: u32,
    pub provider_order: Vec<String>,
    pub language: Option<String>,
    pub accounts: AccountsDto,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AccountsDto {
    pub claude: ProviderAccountsDto,
    pub codex: ProviderAccountsDto,
}

impl Default for ProviderAccountsDto {
    fn default() -> Self {
        Self {
            profiles: vec![AccountProfileDto {
                id: "default".into(),
                name: "Default".into(),
                config_dir: String::new(),
                credentials_path: String::new(),
                enabled: true,
            }],
            selected: "default".into(),
            used_ids: vec!["default".into()],
        }
    }
}

impl Default for SettingsDto {
    fn default() -> Self {
        Self {
            poll_interval_ms: DEFAULT_POLL_MS,
            show_claude_code: true,
            show_codex: false,
            show_antigravity: false,
            show_antigravity_gemini: None,
            show_antigravity_external: None,
            show_opencode: false,
            show_cursor: false,
            show_grok: false,
            show_copilot: false,
            show_grok_bot: false,
            show_aihubmix: false,
            aihubmix_token: String::new(),
            aihubmix_usage_limit: 0.0,
            usage_countdown: false,
            lock_taskbar: false,
            show_avatar: true,
            show_reset: true,
            show_tray_icons: true,
            widget_gap: 8,
            provider_order: crate::engine::providers::ProviderId::canonical_widget_order(&[]),
            language: Some("system".into()),
            accounts: AccountsDto {
                claude: ProviderAccountsDto::default(),
                codex: ProviderAccountsDto::default(),
            },
        }
    }
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsPatch {
    pub poll_interval_ms: Option<u32>,
    pub show_claude_code: Option<bool>,
    pub show_codex: Option<bool>,
    pub show_antigravity: Option<bool>,
    pub show_antigravity_gemini: Option<bool>,
    pub show_antigravity_external: Option<bool>,
    pub show_opencode: Option<bool>,
    pub show_cursor: Option<bool>,
    pub show_grok: Option<bool>,
    pub show_copilot: Option<bool>,
    pub show_grok_bot: Option<bool>,
    pub show_aihubmix: Option<bool>,
    pub aihubmix_token: Option<String>,
    pub aihubmix_usage_limit: Option<f64>,
    pub usage_countdown: Option<bool>,
    pub lock_taskbar: Option<bool>,
    pub show_avatar: Option<bool>,
    pub show_reset: Option<bool>,
    pub show_tray_icons: Option<bool>,
    pub widget_gap: Option<u32>,
    pub provider_order: Option<Vec<String>>,
    pub language: Option<Option<String>>,
    pub accounts: Option<AccountsDto>,
}

fn app_data_directory() -> PathBuf {
    crate::identity::app_data_directory()
}

pub fn settings_path() -> PathBuf {
    app_data_directory().join("settings.json")
}

pub fn usage_cache_path() -> PathBuf {
    app_data_directory().join("usage-cache.json")
}

pub fn diagnose_log_path() -> PathBuf {
    std::env::temp_dir().join(crate::identity::DIAGNOSE_LOG_NAME)
}

fn read_raw_settings() -> Value {
    std::fs::read_to_string(settings_path())
        .ok()
        .and_then(|content| serde_json::from_str(&content).ok())
        .unwrap_or_else(|| json!({}))
}

fn bool_field(value: &Value, key: &str, default: bool) -> bool {
    value
        .get(key)
        .and_then(|item| item.as_bool())
        .unwrap_or(default)
}

fn accounts_from_value(value: &Value, key: &str) -> ProviderAccountsDto {
    let Some(accounts) = value.get("accounts").and_then(|item| item.get(key)) else {
        return ProviderAccountsDto::default();
    };
    let profiles = accounts
        .get("profiles")
        .and_then(|item| item.as_array())
        .map(|items| {
            items
                .iter()
                .map(|profile| AccountProfileDto {
                    id: profile
                        .get("id")
                        .and_then(|v| v.as_str())
                        .unwrap_or("default")
                        .into(),
                    name: profile
                        .get("name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("Default")
                        .into(),
                    config_dir: profile
                        .get("config_dir")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .into(),
                    credentials_path: profile
                        .get("credentials_path")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .into(),
                    enabled: profile
                        .get("enabled")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(true),
                })
                .collect()
        })
        .unwrap_or_else(|| ProviderAccountsDto::default().profiles);
    let selected = accounts
        .get("selected")
        .and_then(|v| v.as_str())
        .unwrap_or("default")
        .into();
    let used_ids = accounts
        .get("used_ids")
        .and_then(|v| v.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(str::to_owned))
                .collect()
        })
        .unwrap_or_default();
    ProviderAccountsDto {
        profiles,
        selected,
        used_ids,
    }
}

pub fn load_settings() -> SettingsDto {
    let raw = read_raw_settings();
    let mut settings = SettingsDto {
        poll_interval_ms: raw
            .get("poll_interval_ms")
            .and_then(|v| v.as_u64())
            .map(|v| v as u32)
            .unwrap_or(DEFAULT_POLL_MS),
        show_claude_code: bool_field(&raw, "show_claude_code", true),
        show_codex: bool_field(&raw, "show_codex", false),
        show_antigravity: bool_field(&raw, "show_antigravity", false),
        show_antigravity_gemini: raw.get("show_antigravity_gemini").and_then(|v| v.as_bool()),
        show_antigravity_external: raw
            .get("show_antigravity_external")
            .and_then(|v| v.as_bool()),
        show_opencode: bool_field(&raw, "show_opencode", false),
        show_cursor: bool_field(&raw, "show_cursor", false),
        show_grok: bool_field(&raw, "show_grok", false),
        show_copilot: bool_field(&raw, "show_copilot", false),
        show_grok_bot: bool_field(&raw, "show_grok_bot", false),
        show_aihubmix: bool_field(&raw, "show_aihubmix", false),
        aihubmix_token: raw
            .get("aihubmix_token")
            .and_then(|value| value.as_str())
            .unwrap_or("")
            .trim()
            .to_owned(),
        aihubmix_usage_limit: raw
            .get("aihubmix_usage_limit")
            .and_then(|value| value.as_f64())
            .filter(|value| value.is_finite() && *value > 0.0)
            .unwrap_or(0.0),
        usage_countdown: bool_field(&raw, "usage_countdown", false),
        lock_taskbar: bool_field(&raw, "lock_taskbar", false),
        show_avatar: bool_field(&raw, "show_avatar", true),
        show_reset: bool_field(&raw, "show_reset", true),
        show_tray_icons: bool_field(&raw, "show_tray_icons", true),
        widget_gap: raw
            .get("widget_gap")
            .and_then(|value| value.as_u64())
            .map(|value| value as u32)
            .unwrap_or(8),
        provider_order: raw
            .get("provider_order")
            .and_then(|value| value.as_array())
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| item.as_str().map(str::to_owned))
                    .collect()
            })
            .unwrap_or_default(),
        language: raw
            .get("language")
            .and_then(|v| v.as_str())
            .map(str::to_owned),
        accounts: AccountsDto {
            claude: accounts_from_value(&raw, "claude"),
            codex: accounts_from_value(&raw, "codex"),
        },
    };
    normalize(&mut settings);
    settings
}

fn normalize_accounts(accounts: &mut ProviderAccountsDto) {
    if accounts.profiles.is_empty() {
        *accounts = ProviderAccountsDto::default();
        return;
    }
    for profile in &mut accounts.profiles {
        if profile.id.trim().is_empty() {
            profile.id = "default".into();
        }
        if profile.name.trim().is_empty() {
            profile.name = profile.id.clone();
        }
    }
    if !accounts
        .profiles
        .iter()
        .any(|profile| profile.id == accounts.selected && profile.enabled)
    {
        accounts.selected = accounts
            .profiles
            .iter()
            .find(|profile| profile.enabled)
            .map(|profile| profile.id.clone())
            .unwrap_or_default();
    }
    let mut used = accounts.used_ids.clone();
    for profile in &accounts.profiles {
        if !used.iter().any(|id| id == &profile.id) {
            used.push(profile.id.clone());
        }
    }
    accounts.used_ids = used;
}

fn normalize(settings: &mut SettingsDto) {
    if !(POLL_1_MIN..=MAX_POLL_MINUTES * POLL_1_MIN).contains(&settings.poll_interval_ms)
        || settings.poll_interval_ms % POLL_1_MIN != 0
    {
        settings.poll_interval_ms = DEFAULT_POLL_MS;
    }
    if settings.show_antigravity_gemini.is_none() {
        settings.show_antigravity_gemini = Some(settings.show_antigravity);
    }
    if settings.show_antigravity_external.is_none() {
        settings.show_antigravity_external = Some(settings.show_antigravity);
    }
    settings.show_antigravity = settings.show_antigravity_gemini.unwrap_or(false)
        || settings.show_antigravity_external.unwrap_or(false);

    let any_provider = settings.show_claude_code
        || settings.show_codex
        || settings.show_antigravity
        || settings.show_opencode
        || settings.show_cursor
        || settings.show_grok
        || settings.show_copilot
        || settings.show_grok_bot
        || settings.show_aihubmix;
    if !any_provider {
        settings.show_claude_code = true;
    }

    settings.widget_gap = settings.widget_gap.min(48);
    settings.provider_order =
        crate::engine::providers::ProviderId::canonical_widget_order(&settings.provider_order);
    normalize_accounts(&mut settings.accounts.claude);
    normalize_accounts(&mut settings.accounts.codex);
}

fn accounts_to_json(accounts: &ProviderAccountsDto) -> Value {
    json!({
        "profiles": accounts.profiles.iter().map(|profile| json!({
            "id": profile.id,
            "name": profile.name,
            "config_dir": profile.config_dir,
            "credentials_path": profile.credentials_path,
            "enabled": profile.enabled,
        })).collect::<Vec<_>>(),
        "selected": accounts.selected,
        "used_ids": accounts.used_ids,
    })
}

fn apply_patch(raw: &mut Value, patch: SettingsPatch) -> SettingsDto {
    let object = raw
        .as_object_mut()
        .expect("settings root must be an object");

    let mut current = load_settings();
    if let Some(value) = patch.poll_interval_ms {
        current.poll_interval_ms = value;
    }
    if let Some(value) = patch.show_claude_code {
        current.show_claude_code = value;
    }
    if let Some(value) = patch.show_codex {
        current.show_codex = value;
    }
    if let Some(value) = patch.show_antigravity {
        let was = current
            .show_antigravity_gemini
            .unwrap_or(current.show_antigravity)
            || current
                .show_antigravity_external
                .unwrap_or(current.show_antigravity);
        if value != was {
            current.show_antigravity_gemini = Some(value);
            current.show_antigravity_external = Some(value);
        }
        current.show_antigravity = value;
    }
    if let Some(value) = patch.show_antigravity_gemini {
        current.show_antigravity_gemini = Some(value);
    }
    if let Some(value) = patch.show_antigravity_external {
        current.show_antigravity_external = Some(value);
    }
    if let Some(value) = patch.show_opencode {
        current.show_opencode = value;
    }
    if let Some(value) = patch.show_cursor {
        current.show_cursor = value;
    }
    if let Some(value) = patch.show_grok {
        current.show_grok = value;
    }
    if let Some(value) = patch.show_copilot {
        current.show_copilot = value;
    }
    if let Some(value) = patch.show_grok_bot {
        current.show_grok_bot = value;
    }
    if let Some(value) = patch.show_aihubmix {
        current.show_aihubmix = value;
    }
    if let Some(value) = patch.aihubmix_token {
        current.aihubmix_token = value.trim().to_owned();
    }
    if let Some(value) = patch.aihubmix_usage_limit {
        current.aihubmix_usage_limit = if value.is_finite() && value > 0.0 {
            value
        } else {
            0.0
        };
    }
    if let Some(value) = patch.usage_countdown {
        current.usage_countdown = value;
    }
    if let Some(value) = patch.lock_taskbar {
        current.lock_taskbar = value;
    }
    if let Some(value) = patch.show_avatar {
        current.show_avatar = value;
    }
    if let Some(value) = patch.show_reset {
        current.show_reset = value;
    }
    if let Some(value) = patch.show_tray_icons {
        current.show_tray_icons = value;
    }
    if let Some(value) = patch.widget_gap {
        current.widget_gap = value;
    }
    if let Some(value) = patch.provider_order {
        current.provider_order = value;
    }
    if let Some(value) = patch.language {
        current.language = value;
    }
    if let Some(value) = patch.accounts {
        current.accounts = value;
    }
    normalize(&mut current);

    object.insert("poll_interval_ms".into(), current.poll_interval_ms.into());
    object.insert("show_claude_code".into(), current.show_claude_code.into());
    object.insert("show_codex".into(), current.show_codex.into());
    object.insert("show_antigravity".into(), current.show_antigravity.into());
    object.insert(
        "show_antigravity_gemini".into(),
        current.show_antigravity_gemini.into(),
    );
    object.insert(
        "show_antigravity_external".into(),
        current.show_antigravity_external.into(),
    );
    object.insert("show_opencode".into(), current.show_opencode.into());
    object.insert("show_cursor".into(), current.show_cursor.into());
    object.insert("show_grok".into(), current.show_grok.into());
    object.insert("show_copilot".into(), current.show_copilot.into());
    object.insert("show_grok_bot".into(), current.show_grok_bot.into());
    object.insert("show_aihubmix".into(), current.show_aihubmix.into());
    object.insert(
        "aihubmix_token".into(),
        current.aihubmix_token.clone().into(),
    );
    object.insert(
        "aihubmix_usage_limit".into(),
        current.aihubmix_usage_limit.into(),
    );
    object.insert("usage_countdown".into(), current.usage_countdown.into());
    object.insert("lock_taskbar".into(), current.lock_taskbar.into());
    object.insert("show_avatar".into(), current.show_avatar.into());
    object.insert("show_reset".into(), current.show_reset.into());
    object.insert("show_tray_icons".into(), current.show_tray_icons.into());
    object.insert("widget_gap".into(), current.widget_gap.into());
    object.insert(
        "provider_order".into(),
        current
            .provider_order
            .iter()
            .cloned()
            .map(Value::String)
            .collect::<Vec<_>>()
            .into(),
    );
    match &current.language {
        Some(code) => {
            object.insert("language".into(), Value::String(code.clone()));
        }
        None => {
            object.remove("language");
        }
    }
    object.insert(
        "accounts".into(),
        json!({
            "claude": accounts_to_json(&current.accounts.claude),
            "codex": accounts_to_json(&current.accounts.codex),
        }),
    );
    // Keep theme system enabled so the widget continues using its renderer.
    object.insert("custom_theme_enabled".into(), true.into());

    current
}

fn wide_path(path: &Path) -> Vec<u16> {
    use std::os::windows::ffi::OsStrExt;
    path.as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}

fn write_json_atomic(path: &Path, value: &Value) -> Result<(), String> {
    let parent = path.parent().ok_or("无效的设置路径")?;
    std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("settings.json");
    let temporary = parent.join(format!(".{file_name}.{}.tmp", std::process::id()));
    let json = serde_json::to_vec_pretty(value).map_err(|error| error.to_string())?;
    {
        use std::io::Write;
        let mut file = std::fs::File::create(&temporary).map_err(|error| error.to_string())?;
        file.write_all(&json).map_err(|error| error.to_string())?;
        file.sync_all().map_err(|error| error.to_string())?;
    }
    let source = wide_path(&temporary);
    let destination = wide_path(path);
    let moved = unsafe {
        MoveFileExW(
            PCWSTR::from_raw(source.as_ptr()),
            PCWSTR::from_raw(destination.as_ptr()),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if moved.is_err() {
        let _ = std::fs::remove_file(&temporary);
        return Err(format!("无法写入设置文件: {}", moved.unwrap_err()));
    }
    Ok(())
}

pub fn save_settings_patch(patch: SettingsPatch) -> Result<SettingsDto, String> {
    let mut raw = read_raw_settings();
    if !raw.is_object() {
        raw = json!({});
    }
    let settings = apply_patch(&mut raw, patch);
    write_json_atomic(&settings_path(), &raw)?;
    Ok(settings)
}

pub fn load_usage_cache() -> Option<Value> {
    std::fs::read_to_string(usage_cache_path())
        .ok()
        .and_then(|content| serde_json::from_str(&content).ok())
}

pub fn read_diagnose_log() -> Result<String, String> {
    let path = diagnose_log_path();
    if !path.exists() {
        return Ok(String::new());
    }
    std::fs::read_to_string(path).map_err(|error| error.to_string())
}

pub fn allocate_account_id(accounts: &ProviderAccountsDto) -> String {
    let mut number = 1;
    loop {
        let id = format!("account_{number}");
        if !accounts.used_ids.iter().any(|item| item == &id)
            && !accounts.profiles.iter().any(|profile| profile.id == id)
        {
            return id;
        }
        number += 1;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_keeps_at_least_one_provider() {
        let mut settings = SettingsDto {
            show_claude_code: false,
            show_codex: false,
            show_antigravity: false,
            show_opencode: false,
            show_cursor: false,
            show_grok: false,
            show_copilot: false,
            show_grok_bot: false,
            ..SettingsDto::default()
        };
        normalize(&mut settings);
        assert!(settings.show_claude_code);
    }

    #[test]
    fn allocate_skips_existing_ids() {
        let accounts = ProviderAccountsDto {
            profiles: vec![AccountProfileDto {
                id: "account_1".into(),
                name: "One".into(),
                config_dir: String::new(),
                credentials_path: String::new(),
                enabled: true,
            }],
            selected: "account_1".into(),
            used_ids: vec!["default".into(), "account_1".into()],
        };
        assert_eq!(allocate_account_id(&accounts), "account_2");
    }

    #[test]
    fn patch_json_preserves_unrelated_keys() {
        let mut raw = json!({
            "poll_interval_ms": 900000,
            "show_claude_code": true,
            "active_theme_path": "C:\\themes\\custom.json",
            "placement_override": { "nest": "taskbar", "monitor_index": 0 }
        });
        let settings = apply_patch(
            &mut raw,
            SettingsPatch {
                poll_interval_ms: Some(300_000),
                show_codex: Some(true),
                usage_countdown: Some(true),
                ..SettingsPatch::default()
            },
        );
        assert_eq!(settings.poll_interval_ms, 300_000);
        assert!(settings.show_codex);
        assert!(settings.usage_countdown);
        assert_eq!(raw["active_theme_path"], "C:\\themes\\custom.json");
        assert_eq!(raw["placement_override"]["nest"], "taskbar");
        assert_eq!(raw["custom_theme_enabled"], true);
    }
}
