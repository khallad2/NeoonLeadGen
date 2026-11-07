const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { ICPVault, SUPPORTED_PLATFORMS } = require('../src/vault');
const { classifyCandidate, isAntiICP } = require('../src/icpClassifier');
const { discoverYouTubeICPs } = require('../src/scrapers/youtube');
const { discoverSocialICPs } = require('../src/scrapers/socialPlatforms');

const TEST_VAULT_PATH = path.join(__dirname, '..', 'data', 'test_vault.json');

async function runVerification() {
  console.log('=== Neoon Studio ICP Engine — Verification Suite ===\n');

  if (fs.existsSync(TEST_VAULT_PATH)) {
    fs.unlinkSync(TEST_VAULT_PATH);
  }
  const vault = new ICPVault(TEST_VAULT_PATH);

  // 1. Test Anti-ICP Disqualification (from icp.md)
  const vlogger = isAntiICP({
    name: 'Sarah Daily Vlog',
    handle: '@sarahvlogs',
    recentContent: 'My Morning Routine & Skincare Haul'
  });
  assert.strictEqual(vlogger.disqualified, true, 'Lifestyle vlogger must be disqualified');

  const ecom = isAntiICP({
    name: 'Glow Apparel',
    handle: '@glowapparel',
    recentContent: 'Shopify dropshipping store fashion haul'
  });
  assert.strictEqual(ecom.disqualified, true, 'Physical e-com brand must be disqualified');
  console.log('✓ Anti-ICP filter accurately disqualifies vloggers & physical e-com brands');

  // 2. Test ICP Classification & Pitch Generation
  const educator = classifyCandidate({
    platform: 'youtube',
    name: 'BackendMastery',
    handle: '@backendmastery',
    profileUrl: 'https://www.youtube.com/@backendmastery',
    subscribersText: '28.5K subscribers',
    recentContent: 'Distributed System Design & Kubernetes Architecture Tutorial'
  });
  assert.strictEqual(educator.disqualified, false);
  assert.ok(educator.lead.pitches.dm.includes('https://neoonai.com/neoon-studio/'));
  console.log(`✓ ICP Classifier enriched "${educator.lead.name}" -> ${educator.lead.icpLabel} (${educator.lead.icpScore}% fit)`);

  // 3. Test 2 Consecutive 10-ICP Runs across ALL 5 Platforms (Zero Duplicates Check)
  for (const platform of SUPPORTED_PLATFORMS) {
    const discoverFn =
      platform === 'youtube'
        ? () => discoverYouTubeICPs({ vault, count: 10, icpTier: 'all' })
        : () => discoverSocialICPs({ platform, vault, count: 10, icpTier: 'all' });

    const batch1 = await discoverFn();
    const rec1 = vault.recordBatch(platform, batch1, 'test_run_1');
    assert.strictEqual(
      rec1.leads.length,
      10,
      `[${platform}] Run 1 must return exactly 10 ICPs, got ${rec1.leads.length}`
    );

    const batch2 = await discoverFn();
    const rec2 = vault.recordBatch(platform, batch2, 'test_run_2');
    assert.strictEqual(
      rec2.leads.length,
      10,
      `[${platform}] Run 2 must return 10 net-new ICPs, got ${rec2.leads.length}`
    );

    const handlesRun1 = new Set(rec1.leads.map((l) => l.handle.toLowerCase()));
    const urlsRun1 = new Set(rec1.leads.map((l) => l.profileUrl.toLowerCase()));

    for (const lead2 of rec2.leads) {
      assert.strictEqual(
        handlesRun1.has(lead2.handle.toLowerCase()),
        false,
        `[${platform}] Duplicate handle found across runs: ${lead2.handle}`
      );
      assert.strictEqual(
        urlsRun1.has(lead2.profileUrl.toLowerCase()),
        false,
        `[${platform}] Duplicate URL found across runs: ${lead2.profileUrl}`
      );
    }

    console.log(
      `✓ [${platform.toUpperCase()}] Run 1 (10 ICPs) + Run 2 (10 ICPs) = 20 unique ICPs (0 duplicates)`
    );
  }

  // 4. Test Teammate Vault Export & Merge
  const exported = vault.exportVault();
  const colleagueVaultPath = path.join(__dirname, '..', 'data', 'test_colleague_vault.json');
  if (fs.existsSync(colleagueVaultPath)) fs.unlinkSync(colleagueVaultPath);
  const colleagueVault = new ICPVault(colleagueVaultPath);
  const mergeRes = colleagueVault.mergeVault(exported);
  assert.strictEqual(mergeRes.totalLeads, 100, 'Colleague vault should receive all 100 unique leads');
  const mergeResDuplicate = colleagueVault.mergeVault(exported);
  assert.strictEqual(mergeResDuplicate.addedLeads, 0, 'Re-merging same vault must add 0 duplicate leads');
  if (fs.existsSync(colleagueVaultPath)) fs.unlinkSync(colleagueVaultPath);
  console.log('✓ Teammate Vault Sync (exportVault + mergeVault) verified with 0 duplicates');

  if (fs.existsSync(TEST_VAULT_PATH)) {
    fs.unlinkSync(TEST_VAULT_PATH);
  }

  console.log('\n🎉 All verification tests passed!');
}

runVerification().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
