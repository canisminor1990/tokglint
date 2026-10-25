use std::path::PathBuf;

/// Name shown to people and used for the Windows install identity.
pub const APP_NAME: &str = "Tokglint";

/// Folder and registry value used before the app was renamed.
pub const LEGACY_APP_NAME: &str = "ClaudeCodeUsageMonitor";

pub const DIAGNOSE_LOG_NAME: &str = "tokglint.log";
pub const STARTUP_REGISTRY_VALUE: &str = APP_NAME;
pub const LEGACY_STARTUP_REGISTRY_VALUE: &str = LEGACY_APP_NAME;
pub const SINGLE_INSTANCE_MUTEX: &str = "Local\\Tokglint";
pub const DASHBOARD_MUTEX: &str = "Local\\TokglintDashboard";
pub const DASHBOARD_REQUEST_EVENT: &str = "Local\\TokglintOpenDashboard";

/// Portable file published on each GitHub release. The in-app updater requires this exact name.
pub const RELEASE_ASSET_NAME: &str = "Tokglint.exe";

pub fn instance_mutex_name(process_id: u32) -> String {
    format!("Local\\{APP_NAME}-{process_id}")
}

/// Settings, themes, and caches. An existing folder from the previous name is renamed once.
pub fn app_data_directory() -> PathBuf {
    let root = std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));
    let current = root.join(APP_NAME);
    let legacy = root.join(LEGACY_APP_NAME);
    if !current.exists() && legacy.is_dir() && std::fs::rename(&legacy, &current).is_err() {
        return legacy;
    }
    current
}
