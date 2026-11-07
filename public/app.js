(() => {
  const PLATFORM_LABELS = {
    youtube: 'YouTube',
    linkedin: 'LinkedIn',
    instagram: 'Instagram',
    tiktok: 'TikTok',
    x: 'X (Twitter)'
  };

  const state = {
    platform: 'youtube',
    icpTier: 'all',
    viewMode: 'latest', // 'latest' | 'platform' | 'all'
    latestRunByPlatform: {},
    allLeads: [],
    stats: null,
    activeModalLead: null,
    activePitchType: 'dm',
    isDiscovering: false
  };

  // DOM Elements
  const platformTabs = document.getElementById('platformTabs');
  const selectIcpTier = document.getElementById('selectIcpTier');
  const inputCustomQuery = document.getElementById('inputCustomQuery');
  const btnDiscover = document.getElementById('btnDiscover');
  const btnDiscoverLabel = document.getElementById('btnDiscoverLabel');
  const viewModePills = document.getElementById('viewModePills');
  const inputTableSearch = document.getElementById('inputTableSearch');
  const selectStatusFilter = document.getElementById('selectStatusFilter');
  const icpTableBody = document.getElementById('icpTableBody');
  const runMetaBadge = document.getElementById('runMetaBadge');
  const btnExportCsv = document.getElementById('btnExportCsv');
  const btnResetPlatform = document.getElementById('btnResetPlatform');

  // Stats DOM
  const statDisplayed = document.getElementById('statDisplayed');
  const statPlatformSeen = document.getElementById('statPlatformSeen');
  const statTotalVault = document.getElementById('statTotalVault');
  const statOutreachActive = document.getElementById('statOutreachActive');

  // Modal DOM
  const pitchModal = document.getElementById('pitchModal');
  const modalLeadPlatform = document.getElementById('modalLeadPlatform');
  const modalLeadName = document.getElementById('modalLeadName');
  const modalLeadSub = document.getElementById('modalLeadSub');
  const modalPitchTextarea = document.getElementById('modalPitchTextarea');
  const modalNotesInput = document.getElementById('modalNotesInput');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const pitchTypeTabs = document.getElementById('pitchTypeTabs');
  const btnCopyModalPitch = document.getElementById('btnCopyModalPitch');
  const btnOpenProfileModal = document.getElementById('btnOpenProfileModal');
  const btnSaveModalNotes = document.getElementById('btnSaveModalNotes');
  const toastBox = document.getElementById('toastBox');

  let toastTimer = null;
  function showToast(msg) {
    toastBox.textContent = msg;
    toastBox.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastBox.classList.remove('is-visible');
    }, 2800);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getInitials(name) {
    const parts = String(name || 'IC')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return String(parts[0] || 'IC').slice(0, 2).toUpperCase();
  }

  function updateCTA() {
    const label = PLATFORM_LABELS[state.platform] || state.platform;
    btnDiscoverLabel.textContent = state.isDiscovering
      ? `⏳ Discovering 10 Unseen ICPs on ${label}...`
      : `⚡ Get 10 New ICPs on ${label}`;
    btnDiscover.disabled = state.isDiscovering;
  }

  function getFilteredLeads() {
    let list = [...state.allLeads];

    if (state.viewMode === 'latest') {
      const latestRunId = state.latestRunByPlatform[state.platform];
      list = list.filter((l) => l.platform === state.platform);
      if (latestRunId) {
        const runLeads = list.filter((l) => l.runId === latestRunId);
        if (runLeads.length > 0) {
          list = runLeads;
        } else {
          list = list.slice(0, 10);
        }
      } else {
        list = list.slice(0, 10);
      }
    } else if (state.viewMode === 'platform') {
      list = list.filter((l) => l.platform === state.platform);
    }

    const tierFilter = selectIcpTier.value;
    if (tierFilter && tierFilter !== 'all' && state.viewMode !== 'latest') {
      list = list.filter((l) => l.icpTier === tierFilter);
    }

    const statusFilter = selectStatusFilter.value;
    if (statusFilter && statusFilter !== 'all') {
      list = list.filter((l) => l.status === statusFilter);
    }

    const q = inputTableSearch.value.trim().toLowerCase();
    if (q) {
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

  function renderStats(displayedCount) {
    const s = state.stats || {
      totalLeads: 0,
      countsByPlatform: {},
      seenCountsByPlatform: {},
      countsByStatus: {}
    };

    for (const p of ['youtube', 'linkedin', 'instagram', 'tiktok', 'x']) {
      const badge = document.getElementById(`count-${p}`);
      if (badge) {
        badge.textContent = s.countsByPlatform?.[p] || 0;
      }
    }

    const pCount = s.countsByPlatform?.[state.platform] || 0;
    statDisplayed.innerHTML = `${displayedCount} <span>ICPs shown</span>`;
    statPlatformSeen.innerHTML = `${pCount} <span>unique on ${PLATFORM_LABELS[state.platform]}</span>`;
    statTotalVault.innerHTML = `${s.totalLeads || 0} <span>total saved</span>`;

    const activeOutreach =
      (s.countsByStatus?.Contacted || 0) +
      (s.countsByStatus?.Replied || 0) +
      (s.countsByStatus?.Booked || 0);
    statOutreachActive.innerHTML = `${activeOutreach} <span>in pipeline</span>`;

    if (state.viewMode === 'latest') {
      runMetaBadge.textContent = `Showing latest 10-ICP batch for ${PLATFORM_LABELS[state.platform]} (Zero duplicates across runs)`;
    } else if (state.viewMode === 'platform') {
      runMetaBadge.textContent = `Showing all ${pCount} deduplicated ICPs collected on ${PLATFORM_LABELS[state.platform]}`;
    } else {
      runMetaBadge.textContent = `Showing all ${s.totalLeads || 0} ICPs across all 5 platforms`;
    }
  }

  function renderTable() {
    const leads = getFilteredLeads();
    renderStats(leads.length);

    if (leads.length === 0) {
      icpTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="kh-empty">
            <div style="font-family: var(--kh-display); font-size: 1.2rem; color: #fff; margin-bottom: 0.45rem;">
              No ICP leads match the current view on ${escapeHtml(PLATFORM_LABELS[state.platform])}
            </div>
            <p style="margin-bottom: 1.2rem;">
              Click <strong>"⚡ Get 10 New ICPs on ${escapeHtml(PLATFORM_LABELS[state.platform])}"</strong> above to discover 10 fresh, qualified leads.
            </p>
          </td>
        </tr>
      `;
      return;
    }

    icpTableBody.innerHTML = leads
      .map((lead, idx) => {
        const numStr = String(idx + 1).padStart(2, '0');
        const tierClass =
          lead.icpTier === 'icp1'
            ? 'kh-tier-badge--icp1'
            : lead.icpTier === 'icp2'
              ? 'kh-tier-badge--icp2'
              : 'kh-tier-badge--icp3';

        const contactLinksHtml = (lead.contactLinks || [])
          .map(
            (link) =>
              `<a href="${escapeHtml(link.url)}" target="_blank" rel="noopener" class="kh-link-pill">${escapeHtml(link.label)} ↗</a>`
          )
          .join('');

        const avatarHtml = lead.avatar
          ? `<img src="${escapeHtml(lead.avatar)}" alt="" onerror="this.remove()" />`
          : escapeHtml(getInitials(lead.name));

        return `
          <tr data-id="${escapeHtml(lead.id)}">
            <td class="kh-row-idx">${numStr}</td>
            <td>
              <div class="kh-client">
                <div class="kh-avatar">${avatarHtml}</div>
                <div>
                  <a href="${escapeHtml(lead.profileUrl)}" target="_blank" rel="noopener" class="kh-client__name">
                    ${escapeHtml(lead.name)}
                    <span style="font-size: 0.75rem; color: var(--kh-a2);">↗</span>
                  </a>
                  <span class="kh-client__handle">${escapeHtml(lead.handle)} • <strong style="color:#b4b4c4; text-transform:uppercase;">${escapeHtml(lead.platform)}</strong></span>
                  <div class="kh-link-pills">${contactLinksHtml}</div>
                </div>
              </div>
            </td>
            <td>
              <span class="kh-tier-badge ${tierClass}">${escapeHtml(lead.icpLabel || 'ICP Match')}</span>
              <div class="kh-score-wrap">
                <div class="kh-score-bar"><i style="width: ${Number(lead.icpScore || 90)}%"></i></div>
                <span>${Number(lead.icpScore || 90)}% FIT</span>
              </div>
            </td>
            <td>
              <span class="kh-subs-pill">${escapeHtml(lead.subscribersText || 'Verified')}</span>
              <a href="${escapeHtml(lead.recentVideoUrl || lead.profileUrl)}" target="_blank" rel="noopener" class="kh-recent-title" title="${escapeHtml(lead.recentContent)}">
                ${escapeHtml(lead.recentContent || 'Technical tutorials & product updates')}
              </a>
              <span class="kh-niche-tag">${escapeHtml(lead.niche || 'Tech & SaaS')}</span>
            </td>
            <td>
              <div class="kh-signal-box">
                <strong>✦ Buying Signal</strong>
                <div>${escapeHtml(lead.buyingSignal)}</div>
                <div class="kh-gap-text">${escapeHtml(lead.videoGap)}</div>
              </div>
            </td>
            <td>
              <div style="display: flex; flex-direction: column; gap: 0.45rem; align-items: flex-start;">
                <button class="kh-btn kh-btn--sm js-open-pitch" data-id="${escapeHtml(lead.id)}">
                  Pitch Studio ✦
                </button>
                <button class="kh-btn kh-btn--ghost kh-btn--sm js-quick-copy" data-id="${escapeHtml(lead.id)}">
                  📋 Quick Copy DM
                </button>
              </div>
            </td>
            <td>
              <select class="kh-status-select js-status-select" data-id="${escapeHtml(lead.id)}" data-status="${escapeHtml(lead.status || 'New')}">
                <option value="New" ${lead.status === 'New' ? 'selected' : ''}>● New Lead</option>
                <option value="Contacted" ${lead.status === 'Contacted' ? 'selected' : ''}>↗ Contacted</option>
                <option value="Replied" ${lead.status === 'Replied' ? 'selected' : ''}>★ Replied</option>
                <option value="Booked" ${lead.status === 'Booked' ? 'selected' : ''}>✓ Booked Call</option>
                <option value="Disqualified" ${lead.status === 'Disqualified' ? 'selected' : ''}>✕ Disqualified</option>
              </select>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  async function loadVaultLeads() {
    const res = await fetch('/api/leads');
    const data = await res.json();
    if (data.ok) {
      state.allLeads = data.leads || [];
      state.stats = data.stats || null;
      if (Array.isArray(data.runs)) {
        for (const r of data.runs) {
          if (!state.latestRunByPlatform[r.platform]) {
            state.latestRunByPlatform[r.platform] = r.runId;
          }
        }
      }
      renderTable();
    }
  }

  async function triggerDiscoverRun() {
    if (state.isDiscovering) return;
    state.isDiscovering = true;
    updateCTA();

    try {
      const res = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: state.platform,
          icpTier: selectIcpTier.value,
          query: inputCustomQuery.value.trim()
        })
      });
      const data = await res.json();
      if (!data.ok) {
        showToast(data.error || 'Discovery failed');
        return;
      }

      state.latestRunByPlatform[state.platform] = data.runId;
      state.viewMode = 'latest';
      updateViewModePills();

      await loadVaultLeads();
      showToast(`⚡ Discovered ${data.count} net-new ICPs on ${PLATFORM_LABELS[state.platform]}!`);
    } catch (err) {
      showToast(`Error: ${err.message}`);
    } finally {
      state.isDiscovering = false;
      updateCTA();
    }
  }

  function updateViewModePills() {
    viewModePills.querySelectorAll('.kh-view-pill').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.view === state.viewMode);
    });
  }

  function openPitchModal(lead) {
    state.activeModalLead = lead;
    state.activePitchType = 'dm';

    modalLeadPlatform.textContent = `${lead.platform.toUpperCase()} • ${lead.icpLabel}`;
    modalLeadName.textContent = `${lead.name} (${lead.handle})`;
    modalLeadSub.textContent = `${lead.subscribersText} • ${lead.niche}`;
    modalNotesInput.value = lead.notes || '';
    btnOpenProfileModal.href = lead.profileUrl;

    updateModalPitchText();
    pitchModal.classList.add('is-open');
  }

  function updateModalPitchText() {
    const lead = state.activeModalLead;
    if (!lead) return;
    pitchTypeTabs.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.pitch === state.activePitchType);
    });
    const pitchText =
      (state.activePitchType === 'dm' && lead.customPitch) ||
      lead.pitches?.[state.activePitchType] ||
      lead.pitches?.dm ||
      '';
    modalPitchTextarea.value = pitchText;
  }

  async function updateLeadOnServer(id, patch) {
    const res = await fetch(`/api/leads/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    const data = await res.json();
    if (data.ok) {
      const idx = state.allLeads.findIndex((l) => l.id === id);
      if (idx !== -1) state.allLeads[idx] = data.lead;
      state.stats = data.stats;
      renderTable();
    }
  }

  // Event Listeners
  platformTabs.addEventListener('click', async (e) => {
    const tab = e.target.closest('.kh-platform-tab');
    if (!tab) return;
    const newPlatform = tab.dataset.platform;
    if (!newPlatform) return;

    state.platform = newPlatform;
    platformTabs.querySelectorAll('.kh-platform-tab').forEach((t) => {
      t.classList.toggle('is-active', t.dataset.platform === newPlatform);
    });
    updateCTA();

    // If this platform has 0 leads in the vault yet, automatically fetch its first 10 ICPs!
    const existingForPlatform = state.allLeads.filter((l) => l.platform === newPlatform);
    if (existingForPlatform.length === 0) {
      await triggerDiscoverRun();
    } else {
      renderTable();
    }
  });

  btnDiscover.addEventListener('click', () => {
    triggerDiscoverRun();
  });

  inputCustomQuery.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      triggerDiscoverRun();
    }
  });

  viewModePills.addEventListener('click', (e) => {
    const pill = e.target.closest('.kh-view-pill');
    if (!pill) return;
    state.viewMode = pill.dataset.view;
    updateViewModePills();
    renderTable();
  });

  selectIcpTier.addEventListener('change', () => renderTable());
  selectStatusFilter.addEventListener('change', () => renderTable());
  inputTableSearch.addEventListener('input', () => renderTable());

  icpTableBody.addEventListener('click', async (e) => {
    const openBtn = e.target.closest('.js-open-pitch');
    if (openBtn) {
      const lead = state.allLeads.find((l) => l.id === openBtn.dataset.id);
      if (lead) openPitchModal(lead);
      return;
    }

    const copyBtn = e.target.closest('.js-quick-copy');
    if (copyBtn) {
      const lead = state.allLeads.find((l) => l.id === copyBtn.dataset.id);
      if (lead) {
        const text = lead.customPitch || lead.pitches?.dm || '';
        await navigator.clipboard.writeText(text);
        showToast(`📋 Copied personalized DM for ${lead.name}!`);
      }
    }
  });

  icpTableBody.addEventListener('change', async (e) => {
    const select = e.target.closest('.js-status-select');
    if (!select) return;
    const id = select.dataset.id;
    const status = select.value;
    select.dataset.status = status;
    await updateLeadOnServer(id, { status });
    showToast(`Updated status to "${status}"`);
  });

  pitchTypeTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-pitch]');
    if (!btn) return;
    state.activePitchType = btn.dataset.pitch;
    updateModalPitchText();
  });

  btnCloseModal.addEventListener('click', () => {
    pitchModal.classList.remove('is-open');
  });

  pitchModal.addEventListener('click', (e) => {
    if (e.target === pitchModal) {
      pitchModal.classList.remove('is-open');
    }
  });

  btnCopyModalPitch.addEventListener('click', async () => {
    if (!state.activeModalLead) return;
    const text = modalPitchTextarea.value;
    await navigator.clipboard.writeText(text);
    await updateLeadOnServer(state.activeModalLead.id, {
      status: 'Contacted',
      customPitch: state.activePitchType === 'dm' ? text : state.activeModalLead.customPitch,
      notes: modalNotesInput.value
    });
    showToast(`📋 Pitch copied & ${state.activeModalLead.name} marked as Contacted!`);
  });

  btnSaveModalNotes.addEventListener('click', async () => {
    if (!state.activeModalLead) return;
    await updateLeadOnServer(state.activeModalLead.id, {
      customPitch: state.activePitchType === 'dm' ? modalPitchTextarea.value : state.activeModalLead.customPitch,
      notes: modalNotesInput.value
    });
    showToast('Saved custom pitch & notes!');
  });

  btnExportCsv.addEventListener('click', () => {
    const leads = getFilteredLeads();
    if (leads.length === 0) {
      showToast('No leads to export');
      return;
    }
    const headers = [
      'Platform',
      'Name',
      'Handle',
      'Profile URL',
      'Subscribers/Followers',
      'ICP Tier',
      'ICP Fit Score',
      'Niche',
      'Recent Content',
      'Buying Signal',
      'Personalized DM Pitch',
      'Status',
      'Notes'
    ];
    const csvRows = [
      headers.join(','),
      ...leads.map((l) =>
        [
          l.platform,
          l.name,
          l.handle,
          l.profileUrl,
          l.subscribersText,
          l.icpLabel,
          `${l.icpScore}%`,
          l.niche,
          l.recentContent,
          l.buyingSignal,
          l.customPitch || l.pitches?.dm || '',
          l.status,
          l.notes || ''
        ]
          .map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`)
          .join(',')
      )
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neoon-studio-icps-${state.platform}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${leads.length} ICPs to CSV!`);
  });

  const btnExportVault = document.getElementById('btnExportVault');
  const btnImportVault = document.getElementById('btnImportVault');
  const inputVaultFile = document.getElementById('inputVaultFile');

  if (btnExportVault) {
    btnExportVault.addEventListener('click', async () => {
      const res = await fetch('/api/vault/export');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `neoon-vault-sync-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Downloaded Vault JSON! Share with your colleague to sync seen leads.');
    });
  }

  if (btnImportVault && inputVaultFile) {
    btnImportVault.addEventListener('click', () => {
      inputVaultFile.click();
    });

    inputVaultFile.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const res = await fetch('/api/vault/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(json)
        });
        const result = await res.json();
        if (result.ok) {
          await loadVaultLeads();
          showToast(`✓ Merged colleague vault (+${result.addedLeads} new leads, ${result.totalLeads} total)!`);
        } else {
          showToast(`Merge error: ${result.error}`);
        }
      } catch (err) {
        showToast(`Invalid Vault JSON file: ${err.message}`);
      } finally {
        inputVaultFile.value = '';
      }
    });
  }

  btnResetPlatform.addEventListener('click', async () => {
    const label = PLATFORM_LABELS[state.platform];
    if (!confirm(`Reset seen history and saved leads for ${label}?`)) return;
    await fetch('/api/vault/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: state.platform })
    });
    delete state.latestRunByPlatform[state.platform];
    await loadVaultLeads();
    showToast(`Cleared ${label} vault history.`);
  });

  // Initialize on boot
  (async () => {
    updateCTA();
    await loadVaultLeads();
    const ytLeads = state.allLeads.filter((l) => l.platform === 'youtube');
    if (ytLeads.length === 0) {
      await triggerDiscoverRun();
    }
  })();
})();
