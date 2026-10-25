use std::sync::Mutex;

use once_cell::sync::Lazy;

#[derive(Clone, Debug, Default)]
pub struct LaunchArgs {
    /// `--settings` opens the React panel immediately (tray and widget still start).
    pub open_settings: bool,
}

static LAUNCH_ARGS: Lazy<Mutex<LaunchArgs>> = Lazy::new(|| Mutex::new(LaunchArgs::default()));

pub fn parse_and_store() {
    let mut args = LaunchArgs::default();
    for arg in std::env::args().skip(1) {
        if arg == "--settings" || arg == "--dashboard" {
            args.open_settings = true;
        }
    }
    if let Ok(mut guard) = LAUNCH_ARGS.lock() {
        *guard = args;
    }
}

pub fn current() -> LaunchArgs {
    LAUNCH_ARGS
        .lock()
        .map(|guard| guard.clone())
        .unwrap_or_default()
}
