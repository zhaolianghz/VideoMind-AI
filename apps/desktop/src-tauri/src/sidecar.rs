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

/// 启动日志路径：<app_data_dir>/sidecar.log
pub fn log_path(app: &AppHandle) -> Option<PathBuf> {
    Some(app.path().app_data_dir().ok()?.join("sidecar.log"))
}

/// 追加一行启动日志。release 构建是 windows_subsystem = "windows"（无控制台），
/// eprintln 全部消失，出问题只能靠这份文件诊断。
pub fn log_line(app: &AppHandle, msg: &str) {
    use std::io::Write;

    let Some(path) = log_path(app) else { return };
    if let Some(dir) = path.parent() {
        let _ = fs::create_dir_all(dir);
    }
    if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(&path) {
        let secs = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let _ = writeln!(f, "[{secs}] {msg}");
    }
}

/// sidecar 解压后位置: app_data_dir/sidecar/videomind-sidecar/<exe>
fn extracted_exe(app: &AppHandle) -> Option<PathBuf> {
    let base = app.path().app_data_dir().ok()?;
    Some(base.join("sidecar").join("videomind-sidecar").join(exe_name()))
}

/// 归档指纹：大小 + 首尾 256KB 内容采样哈希（FNV-1a）。
/// 不用 mtime——每次重新打包都会刷新 mtime，导致内容未变也触发 30s 级重解压。
fn archive_fingerprint(archive: &PathBuf) -> std::io::Result<String> {
    use std::io::{Read, Seek, SeekFrom};

    let meta = fs::metadata(archive)?;
    let len = meta.len();
    let mut f = fs::File::open(archive)?;
    let mut hash: u64 = 0xcbf29ce484222325;
    let mut feed = |buf: &[u8], h: &mut u64| {
        for b in buf {
            *h ^= u64::from(*b);
            *h = h.wrapping_mul(0x100000001b3);
        }
    };
    let mut head = vec![0u8; 256 * 1024];
    let n = f.read(&mut head)?;
    feed(&head[..n], &mut hash);
    if len > 512 * 1024 {
        f.seek(SeekFrom::End(-(256 * 1024)))?;
        let mut tail = vec![0u8; 256 * 1024];
        let n = f.read(&mut tail)?;
        feed(&tail[..n], &mut hash);
    }
    Ok(format!("{len}-{hash:016x}"))
}

/// 首次启动从 resource (tar.gz) 解压 onedir。
/// 压缩包指纹变化时重新解压，保证应用升级后 sidecar 同步更新。
fn ensure_extracted(app: &AppHandle) -> std::io::Result<PathBuf> {
    let exe = extracted_exe(app).ok_or_else(|| io_err("无 app_data_dir"))?;
    let archive = app
        .path()
        .resource_dir()
        .map_err(|e| io_err(&format!("resource_dir: {e}")))?
        .join("bin")
        .join("videomind-sidecar.tar.gz");
    if !archive.exists() {
        if exe.exists() {
            return Ok(exe); // 无压缩包但有旧解压产物（异常情形），继续用
        }
        return Err(io_err("sidecar 压缩包未找到（开发模式？）"));
    }

    let fingerprint = archive_fingerprint(&archive)?;
    let dest = exe
        .parent()
        .and_then(|p| p.parent())
        .ok_or_else(|| io_err("路径错误"))?
        .to_path_buf();
    let marker = dest.join(".sidecar-fingerprint");

    if exe.exists() && fs::read_to_string(&marker).ok().as_deref() == Some(&fingerprint) {
        log_line(app, "压缩包未变，跳过解压");
        return Ok(exe); // 已解压且与当前压缩包一致
    }

    // 过期或首次：清掉旧产物重新解压。解压耗时约半分钟，把阶段报给前端 splash
    set_boot_stage(app, "extracting");
    let unpacked = dest.join("videomind-sidecar");
    if unpacked.exists() {
        let _ = fs::remove_dir_all(&unpacked);
    }
    fs::create_dir_all(&dest)?;
    // 首启/升级后这一步在 Windows 上可能被 Defender 拖到几分钟，前端 splash 靠
    // boot_stage=extracting 提示；日志里留时间点便于判断到底卡在哪。
    log_line(
        app,
        &format!("开始解压 {} → {}", archive.display(), dest.display()),
    );
    let f = fs::File::open(&archive)?;
    let gz = flate2::read::GzDecoder::new(f);
    let mut ar = tar::Archive::new(gz);
    ar.unpack(&dest)?;
    fs::write(&marker, fingerprint)?;
    log_line(app, "解压完成");
    set_boot_stage(app, "starting");
    Ok(exe)
}

/// 把启动阶段写进全局状态，供前端 splash 轮询展示。
/// 约定 `error: <msg>` 表示后端起不来，前端见到即停止等待并报错。
pub fn set_boot_stage(app: &AppHandle, stage: &str) {
    if let Some(state) = app.try_state::<crate::AppState>() {
        if let Ok(mut s) = state.boot_stage.lock() {
            *s = stage.to_string();
        }
    }
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

        log_line(
            app,
            &format!("启动 {} --port {port} --data-dir {data_dir}", exe.display()),
        );

        let mut cmd = Command::new(&exe);
        cmd.arg("--port")
            .arg(port.to_string())
            .arg("--data-dir")
            .arg(data_dir)
            // sidecar 侧的父进程看门狗：宿主被强杀/崩溃时自行退出，防僵尸进程
            .arg("--parent-pid")
            .arg(std::process::id().to_string());
        // 子进程输出并入同一份日志：Python traceback / 缺 dll 的报错都在这里
        match log_path(app).and_then(|p| {
            if let Some(d) = p.parent() {
                let _ = fs::create_dir_all(d);
            }
            fs::OpenOptions::new().create(true).append(true).open(p).ok()
        }) {
            Some(f) => {
                cmd.stdout(Stdio::from(f.try_clone()?));
                cmd.stderr(Stdio::from(f));
            }
            None => {
                cmd.stdout(Stdio::null()).stderr(Stdio::null());
            }
        }

        let child = cmd
            .spawn()
            .map_err(|e| io_err(&format!("无法启动 {}：{e}", exe.display())))?;

        let mut s = Sidecar {
            port,
            child: Some(child),
        };
        s.wait_ready(Duration::from_secs(60))?;
        log_line(app, &format!("sidecar 就绪: http://127.0.0.1:{port}"));
        Ok(s)
    }

    fn wait_ready(&mut self, timeout: Duration) -> std::io::Result<()> {
        let url = format!("http://127.0.0.1:{}/api/v1/system/healthz", self.port);
        let client = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .map_err(|e| io_err(&format!("reqwest: {e}")))?;
        let start = Instant::now();
        while start.elapsed() < timeout {
            // 进程已经死了（缺 dll / 端口冲突 / 启动即崩）→ 立刻失败，别白等满 60s
            if let Some(child) = self.child.as_mut() {
                if let Ok(Some(status)) = child.try_wait() {
                    return Err(io_err(&format!(
                        "sidecar 进程已退出（{status}），详见 sidecar.log"
                    )));
                }
            }
            if let Ok(resp) = client.get(&url).send() {
                if resp.status().is_success() {
                    return Ok(());
                }
            }
            std::thread::sleep(Duration::from_millis(500));
        }
        Err(io_err("sidecar 健康检查超时（60s）"))
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
