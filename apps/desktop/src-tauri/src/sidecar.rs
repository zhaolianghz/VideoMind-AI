//! Python sidecar 进程生命周期管理。
//!
//! 生产模式：从 resource 解压 onedir 压缩包到 app_data，spawn 到空闲端口，轮询 healthz。
//! 首次启动需解压（~5s），之后直接启动。开发模式：压缩包不存在则跳过（走 vite proxy）。

use std::fs;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

pub struct Sidecar {
    port: u16,
    child: Option<Child>,
}

fn exe_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "videomind-sidecar.exe"
    } else {
        "videomind-sidecar"
    }
}

fn io_err(msg: &str) -> std::io::Error {
    std::io::Error::new(std::io::ErrorKind::Other, msg)
}

/// sidecar 解压后位置: app_data_dir/sidecar/videomind-sidecar/<exe>
fn extracted_exe(app: &AppHandle) -> Option<PathBuf> {
    let base = app.path().app_data_dir().ok()?;
    Some(base.join("sidecar").join("videomind-sidecar").join(exe_name()))
}

/// 首次启动从 resource (tar.gz) 解压 onedir。
fn ensure_extracted(app: &AppHandle) -> std::io::Result<PathBuf> {
    let exe = extracted_exe(app).ok_or_else(|| io_err("无 app_data_dir"))?;
    if exe.exists() {
        return Ok(exe); // 已解压
    }
    let archive = app
        .path()
        .resource_dir()
        .map_err(|e| io_err(&format!("resource_dir: {e}")))?
        .join("bin")
        .join("videomind-sidecar.tar.gz");
    if !archive.exists() {
        return Err(io_err("sidecar 压缩包未找到（开发模式？）"));
    }
    let dest = exe
        .parent()
        .and_then(|p| p.parent())
        .ok_or_else(|| io_err("路径错误"))?
        .to_path_buf();
    fs::create_dir_all(&dest)?;
    eprintln!(
        "[sidecar] 首次启动，解压 {} → {}",
        archive.display(),
        dest.display()
    );
    let f = fs::File::open(&archive)?;
    let gz = flate2::read::GzDecoder::new(f);
    let mut ar = tar::Archive::new(gz);
    ar.unpack(&dest)?;
    Ok(exe)
}

fn find_free_port() -> Option<u16> {
    std::net::TcpListener::bind("127.0.0.1:0")
        .ok()
        .and_then(|l| l.local_addr().ok())
        .map(|a| a.port())
}

impl Sidecar {
    pub fn start(app: &AppHandle, data_dir: &str) -> std::io::Result<Self> {
        let exe = ensure_extracted(app)?;
        let port = find_free_port()
            .ok_or_else(|| io_err("无可用端口"))?;

        let child = Command::new(&exe)
            .arg("--port")
            .arg(port.to_string())
            .arg("--data-dir")
            .arg(data_dir)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()?;

        let s = Sidecar {
            port,
            child: Some(child),
        };
        s.wait_ready(Duration::from_secs(60))?;
        Ok(s)
    }

    fn wait_ready(&self, timeout: Duration) -> std::io::Result<()> {
        let url = format!("http://127.0.0.1:{}/api/v1/system/healthz", self.port);
        let client = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .map_err(|e| io_err(&format!("reqwest: {e}")))?;
        let start = Instant::now();
        while start.elapsed() < timeout {
            if let Ok(resp) = client.get(&url).send() {
                if resp.status().is_success() {
                    return Ok(());
                }
            }
            std::thread::sleep(Duration::from_millis(500));
        }
        Err(io_err("sidecar 健康检查超时"))
    }

    pub fn api_base(&self) -> String {
        format!("http://127.0.0.1:{}/api/v1", self.port)
    }

    pub fn kill(&mut self) {
        if let Some(mut child) = self.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

impl Drop for Sidecar {
    fn drop(&mut self) {
        self.kill();
    }
}
