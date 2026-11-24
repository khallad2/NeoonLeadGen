const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { resolveDataDir } = require('./runtime');

const DEFAULT_VAULT_PATH = path.join(resolveDataDir(), 'icp_vault.json');
const SUPPORTED_PLATFORMS = ['youtube', 'linkedin', 'instagram', 'tiktok', 'x'];

function createEmptyVault() {
  const seenByPlatform = {};
  const queryCursors = {};
  for (const p of SUPPORTED_PLATFORMS) {
    seenByPlatform[p] = [];
    queryCursors[p] = 0;
  }
  return {
    version: 1,
    seenByPlatform,
    queryCursors,
    leads: [],
    runs: []
  };
}

class ICPVault {
  constructor(vaultPath = DEFAULT_VAULT_PATH) {
    this.vaultPath = vaultPath;
    this.data = this._load();
    this._seenSets = new Map(); // platform -> Set<canonicalKey> (O(1) dedup lookups)
  }

  /** Lazily builds (and caches) the per-platform seen-key Set. */
  _seenSet(platform) {
    let set = this._seenSets.get(platform);
    if (!set) {
      set = new Set(this.data.seenByPlatform[platform] || []);
      this._seenSets.set(platform, set);
    }
    return set;
  }

  /** Syncs a mutated seen Set back into the persisted array form. */
  _commitSeen(platform) {
    this.data.seenByPlatform[platform] = Array.from(this._seenSet(platform));
  }

  _load() {
    try {
      if (fs.existsSync(this.vaultPath)) {
        const raw = fs.readFileSync(this.vaultPath, 'utf8');
        const parsed = JSON.parse(raw);
        const empty = createEmptyVault();
        return {
          ...empty,
          ...parsed,
          seenByPlatform: { ...empty.seenByPlatform, ...(parsed.seenByPlatform || {}) },
          queryCursors: { ...empty.queryCursors, ...(parsed.queryCursors || {}) },
          leads: Array.isArray(parsed.leads) ? parsed.leads : [],
          runs: Array.isArray(parsed.runs) ? parsed.runs : []
        };
      }
    } catch (err) {
      console.error('[Vault] Failed to read vault, initializing fresh vault:', err.message);
    }
    return createEmptyVault();
  }

  save() {
    const dir = path.dirname(this.vaultPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmpPath = `${this.vaultPath}.tmp`;
    const json = JSON.stringify(this.data, null, 2);
    fs.writeFileSync(tmpPath, json, 'utf8');
    // On Windows, antivirus / OneDrive / indexers can briefly lock the target file,
    // making rename fail with EPERM/EBUSY/EACCES. Retry briefly, then fall back to a direct write.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        fs.renameSync(tmpPath, this.vaultPath);
        return;
      } catch (err) {
        if (!['EPERM', 'EBUSY', 'EACCES'].includes(err.code)) throw err;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 40 * (attempt + 1));
      }
    }
    fs.writeFileSync(this.vaultPath, json, 'utf8');
    try {
      fs.unlinkSync(tmpPath);
    } catch (_) {
      /* ignore */
    }
  }

  /**
   * Computes canonical deduplication keys for a candidate client on a given platform.
   */
  getCanonicalKeys(platform, candidate) {
    const p = String(platform || '').toLowerCase().trim();
    const keys = new Set();

    if (candidate.channelId) {
      keys.add(`${p}:cid:${String(candidate.channelId).toLowerCase().trim()}`);
    }
    if (candidate.handle) {
      const cleanHandle = String(candidate.handle).toLowerCase().replace(/^@+/, '').trim();
      if (cleanHandle) keys.add(`${p}:handle:${cleanHandle}`);
    }
    if (candidate.profileUrl) {
      try {
        const u = new URL(candidate.profileUrl);
        const cleanPath = u.pathname.toLowerCase().replace(/\/+$/, '');
        if (cleanPath && cleanPath !== '/') {
          keys.add(`${p}:url:${u.hostname.replace(/^www\./, '')}${cleanPath}`);
        }
      } catch (_) {
        const rawUrl = String(candidate.profileUrl).toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '');
        if (rawUrl) keys.add(`${p}:url:${rawUrl}`);
      }
    }
    if (candidate.name) {
      const slug = String(candidate.name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '')
        .trim();
      if (slug.length >= 3) {
        keys.add(`${p}:name:${slug}`);
      }
    }
    return Array.from(keys);
  }

  /**
   * Returns true if this client has EVER been returned on this platform.
   */
  hasSeen(platform, candidate) {
    const p = String(platform || '').toLowerCase().trim();
    const seenSet = this._seenSet(p);
    const candidateKeys = this.getCanonicalKeys(p, candidate);
    if (candidateKeys.length === 0) return false;
    return candidateKeys.some((k) => seenSet.has(k));
  }

  /**
   * Registers a batch of newly discovered leads for a platform and persists atomically.
   */
  recordBatch(platform, leads, queryInfo = '') {
    const p = String(platform || '').toLowerCase().trim();
    const seenSet = this._seenSet(p);
    const runId = `run_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const timestamp = new Date().toISOString();

    const storedLeads = [];
    for (const lead of leads) {
      const keys = this.getCanonicalKeys(p, lead);
      if (keys.some((k) => seenSet.has(k))) {
        continue;
      }
      keys.forEach((k) => seenSet.add(k));

      const record = {
        id: lead.id || `icp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        runId,
        platform: p,
        canonicalKey: keys[0] || `${p}:${lead.name}`,
        name: lead.name,
        handle: lead.handle,
        profileUrl: lead.profileUrl,
        avatar: lead.avatar || '',
        subscribersText: lead.subscribersText || 'N/A',
        subscribersNum: lead.subscribersNum || 0,
        icpTier: lead.icpTier,
        icpLabel: lead.icpLabel,
        icpScore: lead.icpScore,
        niche: lead.niche || 'Tech & Software',
        recentContent: lead.recentContent || '',
        recentVideoUrl: lead.recentVideoUrl || lead.profileUrl,
        buyingSignal: lead.buyingSignal || '',
        videoGap: lead.videoGap || '',
        pitches: lead.pitches || {},
        customPitch: lead.customPitch || '',
        contactLinks: lead.contactLinks || [],
        status: lead.status || 'New',
        notes: lead.notes || '',
        discoveredAt: timestamp
      };
      this.data.leads.unshift(record);
      storedLeads.push(record);
    }

    this._commitSeen(p);
    this.data.runs.unshift({
      runId,
      platform: p,
      query: queryInfo,
      count: storedLeads.length,
      timestamp
    });

    this.save();
    return { runId, leads: storedLeads };
  }

  getCursor(platform) {
    const p = String(platform || '').toLowerCase().trim();
    return this.data.queryCursors[p] || 0;
  }

  advanceCursor(platform, step = 1) {
    const p = String(platform || '').toLowerCase().trim();
    this.data.queryCursors[p] = (this.data.queryCursors[p] || 0) + step;
    this.save();
    return this.data.queryCursors[p];
  }

  getLeads({ platform, runId, icpTier, status, search } = {}) {
    let list = [...this.data.leads];
    if (platform && platform !== 'all') {
      list = list.filter((l) => l.platform === platform.toLowerCase());
    }
    if (runId && runId !== 'all') {
      list = list.filter((l) => l.runId === runId);
    }
    if (icpTier && icpTier !== 'all') {
      list = list.filter((l) => l.icpTier === icpTier);
    }
    if (status && status !== 'all') {
      list = list.filter((l) => l.status.toLowerCase() === status.toLowerCase());
    }
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (l) =>
          (l.name && l.name.toLowerCase().includes(q)) ||
          (l.handle && l.handle.toLowerCase().includes(q)) ||
          (l.recentContent && l.recentContent.toLowerCase().includes(q)) ||
          (l.buyingSignal && l.buyingSignal.toLowerCase().includes(q)) ||
          (l.niche && l.niche.toLowerCase().includes(q))
      );
    }
    return list;
  }

  updateLead(id, patch) {
    const idx = this.data.leads.findIndex((l) => l.id === id);
    if (idx === -1) return null;
    const allowed = ['status', 'notes', 'customPitch', 'icpTier'];
    for (const key of allowed) {
      if (patch[key] !== undefined) {
        this.data.leads[idx][key] = patch[key];
      }
    }
    this.data.leads[idx].updatedAt = new Date().toISOString();
    this.save();
    return this.data.leads[idx];
  }

  resetPlatform(platform) {
    this._seenSets.clear();
    if (platform === 'all') {
      this.data = createEmptyVault();
    } else {
      const p = String(platform || '').toLowerCase().trim();
      this.data.seenByPlatform[p] = [];
      this.data.queryCursors[p] = 0;
      this.data.leads = this.data.leads.filter((l) => l.platform !== p);
      this.data.runs = this.data.runs.filter((r) => r.platform !== p);
    }
    this.save();
  }

  exportVault() {
    return {
      ...this.data,
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Merges a colleague's exported vault JSON into this local vault without duplicates.
   */
  mergeVault(incoming) {
    if (!incoming || typeof incoming !== 'object') {
      throw new Error('Invalid vault JSON structure');
    }
    let addedLeads = 0;

    // 1. Merge seenByPlatform keys
    if (incoming.seenByPlatform && typeof incoming.seenByPlatform === 'object') {
      for (const p of SUPPORTED_PLATFORMS) {
        const incomingKeys = Array.isArray(incoming.seenByPlatform[p]) ? incoming.seenByPlatform[p] : [];
        const set = this._seenSet(p);
        for (const k of incomingKeys) set.add(k);
      }
    }

    // 2. Index existing leads by canonical key -> lead (O(N) instead of O(N^2) nested scans)
    const leadByKey = new Map();
    for (const existing of this.data.leads) {
      for (const k of this.getCanonicalKeys(existing.platform, existing)) {
        if (!leadByKey.has(k)) leadByKey.set(k, existing);
      }
    }

    // 3. Merge leads (skip if already present on the same platform, or upgrade status if colleague contacted them)
    const incomingLeads = Array.isArray(incoming.leads) ? incoming.leads : [];
    for (const lead of incomingLeads) {
      if (!lead || typeof lead !== 'object') continue;
      const p = String(lead.platform || 'youtube').toLowerCase().trim();
      if (!SUPPORTED_PLATFORMS.includes(p)) continue;

      const candidateKeys = this.getCanonicalKeys(p, lead);
      const ex = candidateKeys.map((k) => leadByKey.get(k)).find(Boolean);

      if (!ex) {
        const record = { ...lead, platform: p };
        this.data.leads.push(record);
        const set = this._seenSet(p);
        for (const k of candidateKeys) {
          set.add(k);
          leadByKey.set(k, record);
        }
        addedLeads++;
      } else {
        // If colleague updated status beyond 'New', preserve their progress
        if (ex.status === 'New' && lead.status && lead.status !== 'New') {
          ex.status = lead.status;
        }
        if (!ex.notes && lead.notes) {
          ex.notes = lead.notes;
        }
      }
    }

    for (const p of SUPPORTED_PLATFORMS) this._commitSeen(p);

    this.save();
    return { addedLeads, totalLeads: this.data.leads.length };
  }

  getStats() {
    const countsByPlatform = {};
    const seenCountsByPlatform = {};
    for (const p of SUPPORTED_PLATFORMS) {
      countsByPlatform[p] = 0;
      seenCountsByPlatform[p] = this._seenSet(p).size;
    }
    const countsByTier = { icp1: 0, icp2: 0, icp3: 0 };
    const countsByStatus = { New: 0, Contacted: 0, Replied: 0, Booked: 0 };
    for (const l of this.data.leads) {
      if (l.platform in countsByPlatform) countsByPlatform[l.platform]++;
      if (l.icpTier in countsByTier) countsByTier[l.icpTier]++;
      if (l.status in countsByStatus) countsByStatus[l.status]++;
    }
    return {
      totalLeads: this.data.leads.length,
      totalRuns: this.data.runs.length,
      latestRun: this.data.runs[0] || null,
      countsByPlatform,
      seenCountsByPlatform,
      countsByTier,
      countsByStatus
    };
  }
}

module.exports = { ICPVault, SUPPORTED_PLATFORMS };
