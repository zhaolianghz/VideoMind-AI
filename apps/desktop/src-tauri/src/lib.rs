mod commands;
mod sidecar;

use std::sync::Mutex;
use tauri::Manager;

/// 应用全局状态：持有的 sidecar 子进程（生产模式）。
pub struct AppState {
    pub sidecar: Mutex<Option<sidecar::Sidecar>>,
}

/// Tauri 主进程入口。
/// 生产：spawn Python sidecar，前端经 invoke('get_api_base') 拿地址。
/// 开发：无 sidecar 二进制则跳过，前端走 vite proxy。
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            sidecar: Mutex::new(None),
        })
        .setup(|app| {
            let handle = app.handle().clone();
            let data_dir = app
                .path()
                .app_data_dir()?
                .to_string_lossy()
                .to_string();
            // 异步启动 sidecar，避免阻塞窗口创建（同步等待会导致白屏）。
            // dev 模式跳过：后端跑源码版 uvicorn（make server），前端走 vite proxy，
            // 否则会启动旧的打包 sidecar，后端改动不生效。
            if tauri::is_dev() {
                eprintln!("[sidecar] dev 模式跳过，走 vite proxy → 127.0.0.1:18791");
            } else {
                std::thread::spawn(move || match sidecar::Sidecar::start(&handle, &data_dir) {
                    Ok(s) => {
                        eprintln!("[sidecar] ready at {}", s.api_base());
                        if let Some(state) = handle.try_state::<AppState>() {
                            *state.sidecar.lock().unwrap() = Some(s);
                        }
                    }
                    Err(e) => eprintln!("[sidecar] 未启动: {}（开发模式走 vite proxy）", e),
                });
            }
            // 后台预热抖音匿名 cookie（失败不影响使用，提交任务时会再尝试）
            let cookie_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tauri::async_runtime::spawn_blocking(|| {
                    std::thread::sleep(std::time::Duration::from_secs(3))
                })
                .await
                .ok();
                match commands::ensure_douyin_cookies(cookie_handle).await {
                    Ok(s) => eprintln!("[douyin] cookie 状态: {s}"),
                    Err(e) => eprintln!("[douyin] cookie 预热失败: {e}"),
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            // 仅主窗口关闭时终止 sidecar（隐藏的 cookie 收割窗口不算）
            if let tauri::WindowEvent::Destroyed = event {
                if window.label() != "main" {
                    return;
                }
                if let Some(state) = window.app_handle().try_state::<AppState>() {
                    if let Some(mut s) = state.sidecar.lock().unwrap().take() {
                        s.kill();
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_api_base,
            commands::ensure_douyin_cookies
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|handle, event| {
            // 兜底清理：Cmd+Q / 系统退出不会触发窗口 Destroyed 或 Drop，
            // 必须在 Exit 事件里显式杀 sidecar，否则子进程泄漏成僵尸
            if let tauri::RunEvent::Exit = event {
                if let Some(state) = handle.try_state::<AppState>() {
                    if let Some(mut s) = state.sidecar.lock().unwrap().take() {
                        s.kill();
                    }
                }
            }
        });
}
