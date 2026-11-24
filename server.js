const http = require('http');
const path = require('path');
const { isPackaged, readPublicAsset, openBrowser } = require('./src/runtime');
const { ICPVault, SUPPORTED_PLATFORMS } = require('./src/vault');
const { discoverYouTubeICPs } = require('./src/scrapers/youtube');
const { discoverSocialICPs } = require('./src/scrapers/socialPlatforms');

const BASE_PORT = Number(process.env.PORT) || 3030;
// Loopback only: keeps leads private and avoids the Windows Firewall "Allow access?" prompt.
const HOST = '127.0.0.1';
const APP_ID = 'neoon-lead-gen';
const vault = new ICPVault();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 5e6) req.destroy();
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

async function handleApi(req, res, parsedUrl) {
  const pathname = parsedUrl.pathname;

  // GET /api/health -> used by a second launch to detect an already-running instance
  if (req.method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, app: APP_ID });
  }

  // GET /api/leads
  if (req.method === 'GET' && pathname === '/api/leads') {
    const platform = parsedUrl.searchParams.get('platform') || 'all';
    const runId = parsedUrl.searchParams.get('runId') || 'all';
    const icpTier = parsedUrl.searchParams.get('icpTier') || 'all';
    const status = parsedUrl.searchParams.get('status') || 'all';
    const search = parsedUrl.searchParams.get('search') || '';

    const leads = vault.getLeads({ platform, runId, icpTier, status, search });
    return sendJson(res, 200, {
      ok: true,
      leads,
      stats: vault.getStats(),
      runs: vault.data.runs.slice(0, 25)
    });
  }

  // POST /api/discover -> Fetches 10 net-new ICPs for the chosen platform
  if (req.method === 'POST' && pathname === '/api/discover') {
    const body = await readJsonBody(req);
    const platform = String(body.platform || 'youtube').toLowerCase().trim();
    const icpTier = String(body.icpTier || 'all').toLowerCase().trim();
    const customQuery = String(body.query || '').trim();
    const batchSize = 10;

    if (!SUPPORTED_PLATFORMS.includes(platform)) {
      return sendJson(res, 400, {
        ok: false,
        error: `Unsupported platform "${platform}". Choose from: ${SUPPORTED_PLATFORMS.join(', ')}`
      });
    }

    let discovered = [];
    if (platform === 'youtube') {
      discovered = await discoverYouTubeICPs({
        vault,
        count: batchSize,
        icpTier,
        customQuery
      });
    } else {
      discovered = await discoverSocialICPs({
        platform,
        vault,
        count: batchSize,
        icpTier,
        customQuery
      });
    }

    const recorded = vault.recordBatch(platform, discovered, customQuery || `${platform}:${icpTier}`);
    return sendJson(res, 200, {
      ok: true,
      platform,
      runId: recorded.runId,
      count: recorded.leads.length,
      leads: recorded.leads,
      stats: vault.getStats(),
      runs: vault.data.runs.slice(0, 25)
    });
  }

  // PATCH /api/leads/:id
  if (req.method === 'PATCH' && pathname.startsWith('/api/leads/')) {
    const id = decodeURIComponent(pathname.replace('/api/leads/', ''));
    const body = await readJsonBody(req);
    const updated = vault.updateLead(id, body);
    if (!updated) {
      return sendJson(res, 404, { ok: false, error: 'Lead not found' });
    }
    return sendJson(res, 200, {
      ok: true,
      lead: updated,
      stats: vault.getStats()
    });
  }

  // GET /api/vault/export -> Teammate Vault JSON Download
  if (req.method === 'GET' && pathname === '/api/vault/export') {
    return sendJson(res, 200, vault.exportVault());
  }

  // POST /api/vault/import -> Teammate Vault JSON Merge
  if (req.method === 'POST' && pathname === '/api/vault/import') {
    const body = await readJsonBody(req);
    const merged = vault.mergeVault(body);
    return sendJson(res, 200, {
      ok: true,
      addedLeads: merged.addedLeads,
      totalLeads: merged.totalLeads,
      stats: vault.getStats(),
      runs: vault.data.runs.slice(0, 25)
    });
  }

  // POST /api/vault/reset
  if (req.method === 'POST' && pathname === '/api/vault/reset') {
    const body = await readJsonBody(req);
    const platform = String(body.platform || 'all').toLowerCase().trim();
    vault.resetPlatform(platform);
    return sendJson(res, 200, {
      ok: true,
      stats: vault.getStats(),
      runs: vault.data.runs
    });
  }

  return sendJson(res, 404, { ok: false, error: 'API route not found' });
}

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://localhost:${BASE_PORT}`);
    if (parsedUrl.pathname.startsWith('/api/')) {
      return await handleApi(req, res, parsedUrl);
    }

    const requested = parsedUrl.pathname === '/' ? 'index.html' : decodeURIComponent(parsedUrl.pathname);
    let body = readPublicAsset(requested);
    let ext = path.extname(requested).toLowerCase();
    if (!body) {
      body = readPublicAsset('index.html'); // SPA fallback
      ext = '.html';
    }
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(body);
  } catch (err) {
    console.error('[Server Error]', err);
    if (res.headersSent) return res.end();
    const status = /Invalid JSON|Invalid vault/.test(err.message || '') ? 400 : 500;
    sendJson(res, status, { ok: false, error: err.message || 'Internal Server Error' });
  }
});

/** Returns true if a NeoonLeadGen instance is already answering on this port. */
async function isOurInstance(port) {
  try {
    const res = await fetch(`http://${HOST}:${port}/api/health`, { signal: AbortSignal.timeout(1500) });
    const data = await res.json();
    return data && data.app === APP_ID;
  } catch (_) {
    return false;
  }
}

function printBanner(url) {
  console.log('');
  console.log('  NeoonLeadGen - ICP Discovery & Outreach Studio');
  console.log('  ----------------------------------------------');
  console.log(`  Running at:  ${url}`);
  console.log(`  Lead vault:  ${vault.vaultPath}`);
  console.log('');
  if (isPackaged()) {
    console.log('  Keep this window open while you use the app.');
    console.log('  Close this window (or press Ctrl+C) to stop NeoonLeadGen.');
    console.log('');
  }
}

function start({ open = false, port = BASE_PORT, maxAttempts = 10 } = {}) {
  const tryPort = async (p, attemptsLeft) => {
    // Never run two servers on one vault file — reuse the running instance instead.
    if (await isOurInstance(p)) {
      const url = `http://localhost:${p}`;
      console.log(`\n  NeoonLeadGen is already running at ${url} - opening it.`);
      if (open) await openBrowser(url);
      if (isPackaged()) setTimeout(() => process.exit(0), 1500);
      return;
    }
    const onError = (err) => {
      if (err.code === 'EADDRINUSE' && attemptsLeft > 1) {
        tryPort(p + 1, attemptsLeft - 1);
      } else {
        console.error('[Server Failed to Start]', err.message);
        process.exitCode = 1;
      }
    };
    server.once('error', onError);
    server.listen(p, HOST, () => {
      server.removeListener('error', onError);
      const url = `http://localhost:${p}`;
      printBanner(url);
      if (open) openBrowser(url);
    });
  };
  tryPort(port, maxAttempts);
}

if (require.main === module || isPackaged()) {
  if (isPackaged()) process.title = 'NeoonLeadGen';
  const wantsOpen = isPackaged() || process.argv.includes('--open');
  start({ open: wantsOpen && !process.argv.includes('--no-open') });
}

module.exports = { server, vault, start };
