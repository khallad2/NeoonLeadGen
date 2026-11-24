#!/usr/bin/env node
/**
 * Packages NeoonLeadGen as a standalone, double-clickable Windows app
 * (Node.js Single Executable Application — no Node install needed on the target PC).
 *
 *   npm run build:win          -> dist/NeoonLeadGen-Windows/NeoonLeadGen.exe (+ .zip)
 *   npm run build:host         -> same pipeline for THIS machine (local smoke-testing)
 *
 * Pipeline: bundle CommonJS sources -> SEA blob (UI embedded as assets)
 *           -> official node.exe (SHA-256 verified) -> postject blob injection -> zip.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const BUILD = path.join(DIST, '.build');
const CACHE = path.join(ROOT, '.build-cache');
const SEA_FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
const POSTJECT = 'postject@1.0.0-alpha.6';

const target = process.argv.includes('--host') ? 'host' : 'win-x64';
const nodeVersion = process.version; // SEA blob must match the runtime that executes it

function log(msg) {
  console.log(`[build] ${msg}`);
}

/* ---------- 1. Minimal CommonJS bundler (relative requires only; builtins pass through) ---------- */
function bundle(entryRel) {
  const modules = new Map(); // id -> source
  const requireRe = /require\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g;

  const resolveId = (fromId, request) => {
    let id = path.posix.normalize(path.posix.join(path.posix.dirname(fromId), request));
    if (!id.endsWith('.js')) id += '.js';
    return id;
  };

  const visit = (id) => {
    if (modules.has(id)) return;
    const abs = path.join(ROOT, id);
    if (!fs.existsSync(abs)) throw new Error(`Bundler: cannot resolve ${id}`);
    let src = fs.readFileSync(abs, 'utf8').replace(/^#!.*\n/, '');
    modules.set(id, null);
    src = src.replace(requireRe, (_, request) => {
      const dep = resolveId(id, request);
      visit(dep);
      return `require(${JSON.stringify(dep)})`;
    });
    modules.set(id, src);
  };
  visit(entryRel);

  const defs = [...modules.entries()]
    .map(
      ([id, src]) =>
        `${JSON.stringify(id)}: function (module, exports, require, __filename, __dirname) {\n${src}\n}`
    )
    .join(',\n');

  return `'use strict';
const __hostRequire = require;
const __defs = {\n${defs}\n};
const __cache = {};
const __path = __hostRequire('path');
const __root = __path.dirname(process.execPath);
function __require(id) {
  if (!Object.prototype.hasOwnProperty.call(__defs, id)) return __hostRequire(id);
  if (__cache[id]) return __cache[id].exports;
  const module = { exports: {} };
  __cache[id] = module;
  const filename = __path.join(__root, id);
  __defs[id].call(module.exports, module, module.exports, __require, filename, __path.dirname(filename));
  return module.exports;
}
__require(${JSON.stringify(entryRel)});
`;
}

/* ---------- 2. Fetch the matching official Node runtime ---------- */
async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function getRuntime() {
  if (target === 'host') return process.execPath;

  const cached = path.join(CACHE, `node-${nodeVersion}-win-x64.exe`);
  if (fs.existsSync(cached)) {
    log(`Using cached Windows runtime ${path.relative(ROOT, cached)}`);
    return cached;
  }
  const base = `https://nodejs.org/dist/${nodeVersion}`;
  log(`Downloading official Node ${nodeVersion} for Windows x64...`);
  const [exe, sums] = await Promise.all([download(`${base}/win-x64/node.exe`), download(`${base}/SHASUMS256.txt`)]);
  const expected = sums
    .toString('utf8')
    .split('\n')
    .find((line) => line.trim().endsWith(' win-x64/node.exe'));
  const actual = crypto.createHash('sha256').update(exe).digest('hex');
  if (!expected || !expected.startsWith(actual)) {
    throw new Error('SHA-256 mismatch for downloaded node.exe — aborting.');
  }
  log('SHA-256 verified against nodejs.org SHASUMS256.txt');
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(cached, exe);
  return cached;
}

function run(cmd, args, opts = {}) {
  execFileSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts });
}

/* ---------- main ---------- */
(async () => {
  const [major] = process.versions.node.split('.').map(Number);
  if (major < 22) throw new Error(`Building requires Node 22+ (found ${nodeVersion}).`);

  fs.rmSync(BUILD, { recursive: true, force: true });
  fs.mkdirSync(BUILD, { recursive: true });

  // 1. Bundle
  const bundlePath = path.join(BUILD, 'bundle.js');
  fs.writeFileSync(bundlePath, bundle('server.js'));
  log(`Bundled sources -> ${path.relative(ROOT, bundlePath)}`);

  // 2. SEA blob with the whole public/ UI embedded
  const assets = {};
  for (const file of fs.readdirSync(path.join(ROOT, 'public'))) {
    const abs = path.join(ROOT, 'public', file);
    if (fs.statSync(abs).isFile()) assets[file] = abs;
  }
  const blobPath = path.join(BUILD, 'sea-prep.blob');
  const seaConfig = {
    main: bundlePath,
    output: blobPath,
    disableExperimentalSEAWarning: true,
    useSnapshot: false,
    useCodeCache: false, // must be false for cross-platform builds
    assets
  };
  const seaConfigPath = path.join(BUILD, 'sea-config.json');
  fs.writeFileSync(seaConfigPath, JSON.stringify(seaConfig, null, 2));
  run(process.execPath, ['--experimental-sea-config', seaConfigPath], { shell: false });
  log(`SEA blob ready (${Object.keys(assets).length} UI assets embedded)`);

  // 3. Copy runtime + inject
  const outDir = path.join(DIST, target === 'host' ? `NeoonLeadGen-${process.platform}` : 'NeoonLeadGen-Windows');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const exeName = target === 'host' && process.platform !== 'win32' ? 'NeoonLeadGen' : 'NeoonLeadGen.exe';
  const exePath = path.join(outDir, exeName);
  fs.copyFileSync(await getRuntime(), exePath);
  fs.chmodSync(exePath, 0o755);

  const isMacHost = target === 'host' && process.platform === 'darwin';
  if (isMacHost) run('codesign', ['--remove-signature', exePath]);

  const postjectArgs = ['--yes', POSTJECT, exePath, 'NODE_SEA_BLOB', blobPath, '--sentinel-fuse', SEA_FUSE];
  if (isMacHost) postjectArgs.push('--macho-segment-name', 'NODE_SEA');
  log('Injecting app into runtime (postject)...');
  run('npx', postjectArgs);

  if (isMacHost) run('codesign', ['--sign', '-', exePath]);

  // 4. Friendly instructions next to the exe
  if (target === 'win-x64') {
    fs.copyFileSync(path.join(ROOT, 'packaging', 'windows', 'START-HERE.txt'), path.join(outDir, 'START-HERE.txt'));
  }

  const sizeMb = (fs.statSync(exePath).size / 1024 / 1024).toFixed(1);
  log(`Built ${path.relative(ROOT, exePath)} (${sizeMb} MB)`);

  // 5. Zip for sharing (WhatsApp / Drive / email)
  if (target === 'win-x64') {
    const zipPath = path.join(DIST, 'NeoonLeadGen-Windows.zip');
    fs.rmSync(zipPath, { force: true });
    try {
      if (process.platform === 'win32') {
        run('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${outDir}' -DestinationPath '${zipPath}'`]);
      } else {
        execFileSync('zip', ['-r', '-q', '-X', zipPath, path.basename(outDir)], { cwd: DIST, stdio: 'inherit' });
      }
      const zipMb = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1);
      log(`Zipped -> ${path.relative(ROOT, zipPath)} (${zipMb} MB) — send this file to your friend.`);
    } catch (err) {
      log(`Could not create zip automatically (${err.message}). Zip ${path.relative(ROOT, outDir)} manually.`);
    }
  }
  fs.rmSync(BUILD, { recursive: true, force: true });
})().catch((err) => {
  console.error(`[build] FAILED: ${err.message}`);
  process.exit(1);
});
