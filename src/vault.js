const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_VAULT_PATH = path.join(__dirname, '..', 'data', 'icp_vault.json');
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
    fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), 'utf8');
    fs.renameSync(tmpPath, this.vaultPath);
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
    const seenList = this.data.seenByPlatform[p] || [];
    const seenSet = new Set(seenList);
    const candidateKeys = this.getCanonicalKeys(p, candidate);
    if (candidateKeys.length === 0) return false;
    return candidateKeys.some((k) => seenSet.has(k));
  }

  /**
   * Registers a batch of newly discovered leads for a platform and persists atomically.
   */
  recordBatch(platform, leads, queryInfo = '') {
    const p = String(platform || '').toLowerCase().trim();
    if (!this.data.seenByPlatform[p]) {
      this.data.seenByPlatform[p] = [];
    }
    const seenSet = new Set(this.data.seenByPlatform[p]);
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

    this.data.seenByPlatform[p] = Array.from(seenSet);
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
        const currentSet = new Set(this.data.seenByPlatform[p] || []);
        const incomingKeys = Array.isArray(incoming.seenByPlatform[p]) ? incoming.seenByPlatform[p] : [];
        incomingKeys.forEach((k) => currentSet.add(k));
        this.data.seenByPlatform[p] = Array.from(currentSet);
      }
    }

    // 2. Merge leads (skip if already present on the same platform, or upgrade status if colleague contacted them)
    const incomingLeads = Array.isArray(incoming.leads) ? incoming.leads : [];
    for (const lead of incomingLeads) {
      const p = String(lead.platform || 'youtube').toLowerCase().trim();
      if (!SUPPORTED_PLATFORMS.includes(p)) continue;

      const candidateKeys = this.getCanonicalKeys(p, lead);
      const existingIdx = this.data.leads.findIndex((existing) => {
        if (existing.platform !== p) return false;
        const exKeys = this.getCanonicalKeys(p, existing);
        return candidateKeys.some((k) => exKeys.includes(k));
      });

      if (existingIdx === -1) {
        this.data.leads.push(lead);
        const seenSet = new Set(this.data.seenByPlatform[p] || []);
        candidateKeys.forEach((k) => seenSet.add(k));
        this.data.seenByPlatform[p] = Array.from(seenSet);
        addedLeads++;
      } else {
        // If colleague updated status beyond 'New', preserve their progress
        const ex = this.data.leads[existingIdx];
        if (ex.status === 'New' && lead.status && lead.status !== 'New') {
          ex.status = lead.status;
        }
        if (!ex.notes && lead.notes) {
          ex.notes = lead.notes;
        }
      }
    }

    this.save();
    return { addedLeads, totalLeads: this.data.leads.length };
  }

  getStats() {
    const countsByPlatform = {};
    const seenCountsByPlatform = {};
    for (const p of SUPPORTED_PLATFORMS) {
      countsByPlatform[p] = this.data.leads.filter((l) => l.platform === p).length;
      seenCountsByPlatform[p] = (this.data.seenByPlatform[p] || []).length;
    }
    const countsByTier = {
      icp1: this.data.leads.filter((l) => l.icpTier === 'icp1').length,
      icp2: this.data.leads.filter((l) => l.icpTier === 'icp2').length,
      icp3: this.data.leads.filter((l) => l.icpTier === 'icp3').length
    };
    const countsByStatus = {
      New: this.data.leads.filter((l) => l.status === 'New').length,
      Contacted: this.data.leads.filter((l) => l.status === 'Contacted').length,
      Replied: this.data.leads.filter((l) => l.status === 'Replied').length,
      Booked: this.data.leads.filter((l) => l.status === 'Booked').length
    };
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
