# ⚡ NeoonLeadGen — ICP Discovery & Outreach Studio

Local, zero-API-key Ideal Customer Profile (ICP) discovery and outreach engine built for **[Neoon Studio](https://neoonai.com/neoon-studio/)** (Voice-Note-to-Video Google Drive Pipeline).

Every run discovers **10 net-new, qualified ICPs** across **YouTube, LinkedIn, Instagram, TikTok, and X (Twitter)** based on the criteria in [`icp.md`](./icp.md), displays them in a modern interactive table matching the NeoonAI design system, generates personalized outreach pitches (Short DM, Cold Email, and Arabic), and guarantees **strict per-platform deduplication** so you never get the same client twice.

---

## 🚀 Quick Start (For Colleagues)

### Prerequisite
- **[Node.js](https://nodejs.org/)** (v18 or newer) installed on your machine.
- **Zero `npm install` or API keys required** — runs 100% natively out of the box.

### Option A: 1-Click Desktop Launch
- **macOS:** Double-click **`start-mac.command`**
- **Windows:** Double-click **`start-windows.bat`**

### Option B: Terminal Launch
```bash
git clone https://github.com/khallad2/NeoonLeadGen.git
cd NeoonLeadGen
npm start
```
This starts the local server on `http://localhost:3030` (with automatic fallback to `3031+` if busy) and opens **Google Chrome** automatically.

---

## 🎯 Features

1. **5-Platform ICP Search:**
   - Switch between **YouTube**, **LinkedIn**, **Instagram**, **TikTok**, and **X (Twitter)**.
   - Filter by specific persona (`ICP 1: Stretched DevRel`, `ICP 2: Silent Tech Founder`, `ICP 3: High-Ticket Technical Educator 10k–50k Subs`) or enter a custom niche keyword (e.g., `system design`, `kubernetes`, `nextjs saas`, `ai agents`).
2. **Strict 10-ICP Batch & Per-Platform Deduplication Vault (`data/icp_vault.json`):**
   - Clicking **⚡ Get 10 New ICPs** always fetches 10 brand-new clients and skips any client previously seen on that platform.
   - Automatically disqualifies Anti-ICPs (vloggers, lifestyle creators, physical e-commerce brands).
3. **Personalized Outreach Pitch Studio:**
   - Click **Pitch Studio ✦** on any row to view/edit tailored **Short DMs**, **Cold Emails**, or **Arabic Pitches** referencing the prospect's channel/profile and recent content.
   - Track outreach status (`New`, `Contacted`, `Replied`, `Booked`, `Disqualified`) and export filtered views to **CSV**.
4. **Teammate Vault Sync (`Sync Vault ↓` / `Merge Vault ↑`):**
   - Click **Sync Vault ↓** in the top navigation bar to download your `neoon-vault-sync.json` file.
   - Your colleague can click **Merge Vault ↑** to import your JSON file — merging all seen clients and contacted statuses so two teammates never pitch the same client twice.

---

## 🧪 Run Verification Tests
```bash
npm test
```
Runs automated checks verifying Anti-ICP disqualification, 10-lead batching, and zero duplicates across consecutive runs on all 5 platforms.
