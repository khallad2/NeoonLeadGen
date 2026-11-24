/**
 * Runtime environment helpers: detects whether we run from source (`node server.js`)
 * or as the packaged Windows executable (Node Single Executable Application),
 * and resolves data/asset locations + browser launching accordingly.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFile } = require('child_process');

let seaModule = null;
try {
  seaModule = require('node:sea');
} catch (_) {
  seaModule = null; // Node < 20 — never packaged
}

function isPackaged() {
  return Boolean(seaModule && typeof seaModule.isSea === 'function' && seaModule.isSea());
}

/**
 * Where the lead vault lives.
 * - NEOON_DATA_DIR env var always wins.
 * - Packaged app: per-user app-data folder (survives moving/replacing the .exe,
 *   and works even if the .exe is launched straight from inside a ZIP or Program Files).
 * - From source: ./data inside the repo (unchanged behaviour).
 */
function resolveDataDir() {
  if (process.env.NEOON_DATA_DIR) return path.resolve(process.env.NEOON_DATA_DIR);
  if (isPackaged()) {
    if (process.platform === 'win32') {
      const base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
      return path.join(base, 'NeoonLeadGen', 'data');
    }
    if (process.platform === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Application Support', 'NeoonLeadGen', 'data');
    }
    return path.join(os.homedir(), '.neoonleadgen', 'data');
  }
  return path.join(__dirname, '..', 'data');
}

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const assetCache = new Map();

/**
 * Returns a static UI file as a Buffer (or null if missing).
 * Packaged: read from assets embedded in the executable. Source: read from ./public.
 */
function readPublicAsset(relPath) {
  const clean = String(relPath).replace(/\\/g, '/').replace(/^\/+/, '');
  if (!clean || clean.split('/').includes('..')) return null;

  if (isPackaged()) {
    if (assetCache.has(clean)) return assetCache.get(clean);
    let buf = null;
    try {
      buf = Buffer.from(seaModule.getAsset(clean));
    } catch (_) {
      buf = null;
    }
    assetCache.set(clean, buf);
    return buf;
  }

  const fullPath = path.join(PUBLIC_DIR, clean);
  if (!fullPath.startsWith(PUBLIC_DIR + path.sep)) return null;
  try {
    return fs.statSync(fullPath).isFile() ? fs.readFileSync(fullPath) : null;
  } catch (_) {
    return null;
  }
}

function launchDetached(cmd, args) {
  return new Promise((resolve) => {
    try {
      const child = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true });
      child.once('error', () => resolve(false));
      child.once('spawn', () => {
        child.unref();
        resolve(true);
      });
    } catch (_) {
      resolve(false);
    }
  });
}

function findWindowsChrome() {
  const roots = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
  for (const root of roots) {
    const candidate = path.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/** Opens the URL in Google Chrome when available, otherwise the default browser. */
async function openBrowser(url) {
  if (process.platform === 'win32') {
    const chrome = findWindowsChrome();
    if (chrome && (await launchDetached(chrome, [url]))) return;
    // Default browser fallback — avoids cmd.exe `start` quoting pitfalls.
    await launchDetached('rundll32.exe', ['url.dll,FileProtocolHandler', url]);
    return;
  }
  if (process.platform === 'darwin') {
    // `open -a` exits non-zero when Chrome isn't installed — fall back to the default browser.
    execFile('open', ['-a', 'Google Chrome', url], (err) => {
      if (err) execFile('open', [url], () => {});
    });
    return;
  }
  for (const cmd of ['google-chrome', 'chromium', 'xdg-open']) {
    if (await launchDetached(cmd, [url])) return;
  }
}

module.exports = { isPackaged, resolveDataDir, readPublicAsset, openBrowser };
