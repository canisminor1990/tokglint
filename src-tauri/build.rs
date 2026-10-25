#[path = "build/widget_assets.rs"]
mod widget_assets;

fn main() {
    widget_assets::build_widget_assets();
    let windows = tauri_build::WindowsAttributes::new().app_manifest(include_str!("app.manifest"));
    let attrs = tauri_build::Attributes::new().windows_attributes(windows);
    tauri_build::try_build(attrs).expect("failed to run tauri-build");
}
