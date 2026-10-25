use std::sync::OnceLock;

use windows::core::PCWSTR;
use windows::Win32::Foundation::{GetLastError, ERROR_ALREADY_EXISTS};
use windows::Win32::System::Registry::{
    RegCloseKey, RegOpenKeyExW, RegQueryValueExW, HKEY, HKEY_CURRENT_USER, KEY_READ,
};
use windows::Win32::System::Threading::CreateMutexW;
use windows::Win32::UI::WindowsAndMessaging::{
    FindWindowW, SetForegroundWindow, ShowWindowAsync, SW_RESTORE,
};

/// Keep the process-lifetime mutex handle as a raw value so the static is Sync.
static DASHBOARD_MUTEX_HANDLE: OnceLock<isize> = OnceLock::new();

const DASHBOARD_MUTEX: &str = crate::identity::DASHBOARD_MUTEX;
pub const DASHBOARD_TITLE: &str = crate::identity::APP_NAME;
const STARTUP_REGISTRY_PATH: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
const STARTUP_REGISTRY_KEYS: [&str; 2] = [
    crate::identity::STARTUP_REGISTRY_VALUE,
    crate::identity::LEGACY_STARTUP_REGISTRY_VALUE,
];

fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

pub fn claim_instance() -> Result<bool, String> {
    let name = wide(DASHBOARD_MUTEX);
    unsafe {
        let handle = CreateMutexW(None, true, PCWSTR::from_raw(name.as_ptr()))
            .map_err(|error| format!("无法创建设置窗口实例锁: {error}"))?;
        if GetLastError() == ERROR_ALREADY_EXISTS {
            focus_existing();
            Ok(false)
        } else {
            let _ = DASHBOARD_MUTEX_HANDLE.set(handle.0 as isize);
            Ok(true)
        }
    }
}

pub fn focus_existing() -> bool {
    let title = wide(DASHBOARD_TITLE);
    unsafe {
        let Ok(hwnd) = FindWindowW(PCWSTR::null(), PCWSTR::from_raw(title.as_ptr())) else {
            return false;
        };
        let _ = ShowWindowAsync(hwnd, SW_RESTORE);
        let _ = SetForegroundWindow(hwnd);
        true
    }
}

pub fn is_startup_enabled() -> bool {
    unsafe {
        let path = wide(STARTUP_REGISTRY_PATH);
        let mut hkey = HKEY::default();
        if RegOpenKeyExW(
            HKEY_CURRENT_USER,
            PCWSTR::from_raw(path.as_ptr()),
            None,
            KEY_READ,
            &mut hkey,
        )
        .is_err()
        {
            return false;
        }
        let enabled = STARTUP_REGISTRY_KEYS.iter().any(|name| {
            let key_name = wide(name);
            let mut data_size: u32 = 0;
            let result = RegQueryValueExW(
                hkey,
                PCWSTR::from_raw(key_name.as_ptr()),
                None,
                None,
                None,
                Some(&mut data_size),
            );
            result.is_ok() && data_size > 0
        });
        let _ = RegCloseKey(hkey);
        enabled
    }
}
