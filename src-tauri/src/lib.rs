// `cargo build` does not compile tests, so helpers that only the tests call
// look unused. `cargo test` still reports anything neither a test nor the
// binary calls.
#![cfg_attr(not(test), allow(dead_code))]

mod cli;
mod engine;
mod identity;
mod settings;
mod winmsg;

fn notify_widget(message: u32, wparam: usize) -> Result<(), String> {
    engine::window::post_to_widget(message, wparam)
}

use settings::{SettingsDto, SettingsPatch};
use tauri::{Manager, RunEvent, WindowEvent};
use windows::Win32::Foundation::COLORREF;
use windows::Win32::Graphics::Dwm::{
    DwmSetWindowAttribute, DWMWA_BORDER_COLOR, DWMWA_CAPTION_COLOR, DWMWA_TEXT_COLOR,
};
use windows::Win32::UI::WindowsAndMessaging::{
    SetWindowPos, SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER,
};

#[tauri::command]
fn get_settings() -> SettingsDto {
    settings::load_settings()
}

#[tauri::command]
fn save_settings(patch: SettingsPatch) -> Result<SettingsDto, String> {
    let settings = settings::save_settings_patch(patch)?;
    let _ = notify_widget(engine::native_interop::WM_APP_SETTINGS_UPDATED, 0);
    Ok(settings)
}

#[tauri::command]
fn refresh_now() -> Result<(), String> {
    notify_widget(engine::native_interop::WM_APP_REFRESH_NOW, 0)
}

#[tauri::command]
fn set_diagnostics(enabled: bool) -> Result<(), String> {
    let message = if enabled {
        engine::native_interop::WM_APP_ENABLE_DIAGNOSTICS
    } else {
        engine::native_interop::WM_APP_DISABLE_DIAGNOSTICS
    };
    notify_widget(message, 0)
}

#[tauri::command]
fn check_for_updates() -> Result<(), String> {
    notify_widget(engine::native_interop::WM_APP_CHECK_FOR_UPDATES, 0)
}

#[tauri::command]
fn get_startup_enabled() -> bool {
    winmsg::is_startup_enabled()
}

#[tauri::command]
fn set_startup_enabled(enabled: bool) -> Result<(), String> {
    notify_widget(
        engine::native_interop::WM_APP_SET_STARTUP,
        if enabled { 1 } else { 0 },
    )
}

#[tauri::command]
fn get_usage_cache() -> Option<serde_json::Value> {
    settings::load_usage_cache()
}

#[tauri::command]
fn get_diagnose_log() -> Result<String, String> {
    settings::read_diagnose_log()
}

#[tauri::command]
fn get_diagnose_log_path() -> String {
    settings::diagnose_log_path().display().to_string()
}

#[tauri::command]
fn get_launch_info() -> serde_json::Value {
    serde_json::json!({
        "connected": engine::window::widget_is_running(),
    })
}

/// Colors of the native window frame. `background` is the settings canvas
/// (`colorBgLayout`); `text` is the title color (`colorText`).
#[derive(serde::Deserialize)]
struct WindowChrome {
    background: [u8; 3],
    text: [u8; 3],
    dark: bool,
}

fn color_ref([red, green, blue]: [u8; 3]) -> COLORREF {
    COLORREF(u32::from(red) | (u32::from(green) << 8) | (u32::from(blue) << 16))
}

/// Title bar, border, and the color behind the page follow the settings canvas.
/// The page sends the live theme tokens; this preset only covers the first paint.
fn preset_window_chrome(dark: bool) -> ([u8; 3], [u8; 3]) {
    if dark {
        ([0x00, 0x00, 0x00], [0xff, 0xff, 0xff])
    } else {
        ([0xf8, 0xf8, 0xf8], [0x08, 0x08, 0x08])
    }
}

fn apply_window_chrome(
    window: &tauri::WebviewWindow,
    background: [u8; 3],
    text: [u8; 3],
    dark: bool,
) -> Result<(), String> {
    let [red, green, blue] = background;
    window
        .set_theme(Some(if dark {
            tauri::Theme::Dark
        } else {
            tauri::Theme::Light
        }))
        .map_err(|error| error.to_string())?;
    window
        .set_background_color(Some(tauri::window::Color(red, green, blue, 255)))
        .map_err(|error| error.to_string())?;

    let hwnd = window.hwnd().map_err(|error| error.to_string())?;
    let caption = color_ref(background);
    let caption_text = color_ref(text);
    let size = u32::try_from(std::mem::size_of::<COLORREF>()).unwrap_or(4);
    unsafe {
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_CAPTION_COLOR,
            &caption as *const COLORREF as *const _,
            size,
        );
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_BORDER_COLOR,
            &caption as *const COLORREF as *const _,
            size,
        );
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_TEXT_COLOR,
            &caption_text as *const COLORREF as *const _,
            size,
        );
        let _ = SetWindowPos(
            hwnd,
            None,
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
        );
    }
    Ok(())
}

#[tauri::command]
fn set_window_chrome(window: tauri::WebviewWindow, chrome: WindowChrome) -> Result<(), String> {
    apply_window_chrome(&window, chrome.background, chrome.text, chrome.dark)
}

#[tauri::command]
fn next_account_id(provider: String) -> Result<String, String> {
    let settings = settings::load_settings();
    let accounts = match provider.as_str() {
        "claude" => &settings.accounts.claude,
        "codex" => &settings.accounts.codex,
        _ => return Err("未知的服务商".into()),
    };
    Ok(settings::allocate_account_id(accounts))
}

fn show_settings_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_title(winmsg::DASHBOARD_TITLE);
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    cli::parse_and_store();
    let open_settings = cli::current().open_settings;
    let diagnose = std::env::args().any(|arg| arg == "--diagnose");
    if diagnose {
        let _ = if std::env::args().any(|arg| arg == "--diagnose-append") {
            engine::diagnose::init_append()
        } else {
            engine::diagnose::init()
        };
        engine::diagnose::log("Tokglint starting");
    }

    // Product single-instance: if settings window already exists, focus it.
    // The widget thread also has Local\Tokglint.
    match winmsg::claim_instance() {
        Ok(true) => {}
        Ok(false) => {
            // Another lobe host is running — ask it to open settings via named event.
            let _ = engine::dashboard::request_from_existing_monitor();
            return;
        }
        Err(error) => {
            eprintln!("{error}");
            return;
        }
    }

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            refresh_now,
            set_diagnostics,
            check_for_updates,
            get_startup_enabled,
            set_startup_enabled,
            get_usage_cache,
            get_diagnose_log,
            get_diagnose_log_path,
            get_launch_info,
            next_account_id,
            set_window_chrome,
        ])
        .setup(move |app| {
            let handle = app.handle().clone();
            engine::dashboard::set_settings_opener(move |_owner| {
                show_settings_window(&handle);
            });

            let monitor_handle = app.handle().clone();
            std::thread::Builder::new()
                .name("usage-widget".into())
                .spawn(move || {
                    engine::diagnose::log("widget thread entered");
                    engine::run();
                    engine::diagnose::log("widget thread exited");
                    // Monitor message loop ended (quit / single-instance abort).
                    let _ = monitor_handle.exit(0);
                })
                .expect("failed to start usage widget thread");

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title(winmsg::DASHBOARD_TITLE);
                let dark = window.theme().ok() == Some(tauri::Theme::Dark);
                let (background, text) = preset_window_chrome(dark);
                let _ = apply_window_chrome(&window, background, text, dark);
                if open_settings {
                    let _ = window.show();
                } else {
                    let _ = window.hide();
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Closing settings must not kill tray + widget.
                api.prevent_close();
                let _ = window.hide();
            }
        });

    let app = builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, event| {
        if let RunEvent::Exit = event {
            engine::dashboard::clear_settings_opener();
        }
    });
}
