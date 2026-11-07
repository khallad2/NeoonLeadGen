const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { ICPVault, SUPPORTED_PLATFORMS } = require('./src/vault');
const { discoverYouTubeICPs } = require('./src/scrapers/youtube');
const { discoverSocialICPs } = require('./src/scrapers/socialPlatforms');

const BASE_PORT = Number(process.env.PORT) || 3030;
const PUBLIC_DIR = path.join(__dirname, 'public');
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

function openInChrome(url) {
  const platform = process.platform;
  if (platform === 'darwin') {
    exec(`open -a "Google Chrome" "${url}" || open "${url}"`);
  } else if (platform === 'win32') {
    exec(`start chrome "${url}" || start "" "${url}"`);
  } else {
    exec(`google-chrome "${url}" || chromium "${url}" || xdg-open "${url}"`);
  }
}

async function handleApi(req, res, parsedUrl) {
  const pathname = parsedUrl.pathname;

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

    let filePath = parsedUrl.pathname === '/' ? '/index.html' : parsedUrl.pathname;
    const safePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join(PUBLIC_DIR, safePath);

    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const ext = path.extname(fullPath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      fs.createReadStream(fullPath).pipe(res);
    } else {
      const indexFile = path.join(PUBLIC_DIR, 'index.html');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(indexFile).pipe(res);
    }
  } catch (err) {
    console.error('[Server Error]', err);
    sendJson(res, 500, { ok: false, error: err.message || 'Internal Server Error' });
  }
});

function startWithFallback(port, maxAttempts = 10) {
  const onError = (err) => {
    if (err.code === 'EADDRINUSE' && maxAttempts > 1) {
      server.removeListener('error', onError);
      startWithFallback(port + 1, maxAttempts - 1);
    } else {
      console.error('[Server Failed to Start]', err.message);
      process.exit(1);
    }
  };
  server.once('error', onError);
  server.listen(port, () => {
    server.removeListener('error', onError);
    const url = `http://localhost:${port}`;
    console.log(`\n⚡ NeoonLeadGen — ICP Discovery Studio running at ${url}`);
    if (process.argv.includes('--open')) {
      openInChrome(url);
    }
  });
}

if (require.main === module) {
  startWithFallback(BASE_PORT);
}

module.exports = { server, vault };
