//! Taskbar widget, tray icon, and usage polling. Same process as the React settings shell.

pub mod accounts;
pub mod app_settings;
pub mod context_menu;
pub mod dashboard;
pub mod desktop_compositor;
pub mod diagnose;
pub mod font_catalog;
#[cfg(test)]
mod https_test;
pub mod known_folders;
pub mod localization;
pub mod models;
pub mod native_interop;
pub mod poller;
pub mod providers;
pub mod theme;
pub mod theme_engine;
pub mod theme_package;
pub mod tray_icon;
pub mod updater;
pub mod window;
pub mod winsqlite;

/// Block on the Win32 widget and tray message loop.
pub fn run() {
    diagnose::install_panic_hook();
    window::run();
}
