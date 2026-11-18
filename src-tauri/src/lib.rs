use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use std::{collections::HashMap, sync::Mutex};
use tauri_plugin_store::StoreExt;

struct PinState {
    enabled: bool,
    menu_item: CheckMenuItem<tauri::Wry>,
}

#[tauri::command]
fn get_always_on_top(app: tauri::AppHandle) -> Result<bool, String> {
    let state = app.state::<Mutex<PinState>>();
    let state = state.lock().map_err(|error| error.to_string())?;
    Ok(state.enabled)
}

#[tauri::command]
fn toggle_always_on_top(app: tauri::AppHandle) -> Result<bool, String> {
    let state = app.state::<Mutex<PinState>>();
    let mut state = state.lock().map_err(|error| error.to_string())?;
    let previous = state.enabled;
    let next = !previous;
    let window = app.get_webview_window("main").ok_or("Main window not found")?;
    let result = (|| -> Result<(), String> {
        let store = app.store("window.json").map_err(|error| error.to_string())?;
        window.set_always_on_top(next).map_err(|error| error.to_string())?;
        store.set("alwaysOnTop", serde_json::json!(next));
        if let Err(error) = store.save() {
            // Restore the in-memory Store too: registered stores may save on exit.
            store.set("alwaysOnTop", serde_json::json!(previous));
            return Err(error.to_string());
        }
        Ok(())
    })();
    if let Err(error) = result {
        let rollback = window.set_always_on_top(previous);
        let _ = state.menu_item.set_checked(previous);
        let message = if rollback.is_err() {
            "error.pinRollbackFailed".to_string()
        } else {
            "error.pinRollback".to_string()
        };
        eprintln!("{error}");
        let _ = app.emit("window:pin-error", &message);
        return Err(message);
    }
    state.enabled = next;
    // Native checkbox menu items toggle themselves; explicitly synchronize both entry points.
    if let Err(error) = state.menu_item.set_checked(next) {
        eprintln!("{error}");
        let _ = app.emit("window:pin-error", "error.pinTray");
    }
    let _ = app.emit("window:pin-changed", next);
    Ok(next)
}

struct NativeMenus(HashMap<String, MenuItem<tauri::Wry>>);

#[tauri::command]
fn set_menu_language(app: tauri::AppHandle, messages: HashMap<String, String>) -> Result<(), String> {
    let fallback: HashMap<String, String> = serde_json::from_str(include_str!("../../src/locales/zh_cn.json"))
        .map_err(|error| error.to_string())?;
    let text = |key: &str| messages.get(key).or_else(|| fallback.get(key)).cloned().unwrap_or_else(|| key.into());
    let menus = app.state::<NativeMenus>();
    for (key, item) in &menus.0 {
        item.set_text(text(key)).map_err(|error| error.to_string())?;
    }
    let pin = app.state::<Mutex<PinState>>();
    pin.lock().map_err(|error| error.to_string())?.menu_item
        .set_text(text("menu.pin")).map_err(|error| error.to_string())?;
    if let Some(tray) = app.tray_by_id("todo-tray") {
        tray.set_tooltip(Some(text("menu.trayTooltip"))).map_err(|error| error.to_string())?;
    }
    if let Some(window) = app.get_webview_window("main") {
        window.set_title(&text("app.title")).map_err(|error| error.to_string())?;
    }
    Ok(())
}

// Validate reads before registering the file with Store, which may save at exit.
#[tauri::command]
fn read_todo_document(app: tauri::AppHandle) -> Result<Option<serde_json::Value>, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("todos.json");
    match std::fs::read(path) {
        Ok(bytes) => {
            let value: serde_json::Value =
                serde_json::from_slice(&bytes).map_err(|error| error.to_string())?;
            if !value.is_object() {
                return Err("Todo document must be a JSON object".into());
            }
            Ok(Some(value))
        },
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            quit_app, read_todo_document, get_always_on_top, toggle_always_on_top, set_menu_language
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let messages: HashMap<String, String> = serde_json::from_str(include_str!("../../src/locales/zh_cn.json"))?;
            let text = |key: &str| messages.get(key).cloned().unwrap_or_else(|| key.into());
            let settings = app.store_builder("window.json").disable_auto_save().build()?;
            let always_on_top = settings.get("alwaysOnTop").and_then(|value| value.as_bool()).unwrap_or(true);
            if let Some(window) = app.get_webview_window("main") {
                window.set_always_on_top(always_on_top)?;
            }
            let pin = CheckMenuItem::with_id(app, "always-on-top", text("menu.pin"), true, always_on_top, None::<&str>)?;
            app.manage(Mutex::new(PinState { enabled: always_on_top, menu_item: pin.clone() }));

            let show = MenuItem::with_id(app, "show", text("menu.show"), true, None::<&str>)?;
            let hide = MenuItem::with_id(app, "hide", text("menu.hide"), true, None::<&str>)?;
            let reset = MenuItem::with_id(app, "reset", text("menu.reset"), true, None::<&str>)?;
            let preferences = MenuItem::with_id(app, "settings", text("menu.settings"), true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", text("menu.quit"), true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &hide, &pin, &preferences, &reset, &quit])?;
            app.manage(NativeMenus(HashMap::from([
                ("menu.show".into(), show.clone()), ("menu.hide".into(), hide.clone()),
                ("menu.reset".into(), reset.clone()), ("menu.settings".into(), preferences.clone()),
                ("menu.quit".into(), quit.clone()),
            ])));
            let icon = app.default_window_icon().cloned().expect("missing app icon");

            TrayIconBuilder::with_id("todo-tray")
                .icon(icon)
                .tooltip(text("menu.trayTooltip"))
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .on_menu_event(|app, event| {
                    if let Some(window) = app.get_webview_window("main") {
                        match event.id.as_ref() {
                            "show" => {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                            "hide" => { let _ = window.hide(); }
                            "always-on-top" => {
                                if let Err(error) = toggle_always_on_top(app.clone()) {
                                    eprintln!("{error}");
                                }
                            }
                            "reset" => {
                                let _ = window.show();
                                let _ = window.emit("window:reset", ());
                            }
                            "settings" => {
                                let _ = window.show();
                                let _ = window.set_focus();
                                let _ = window.emit("settings:open", ());
                            }
                            "quit" => { let _ = window.emit("app:quit-request", ()); }
                            _ => {}
                        }
                    }
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running todo-floating-app");
}
