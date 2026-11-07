# ⚡ NeoonLeadGen — ICP Discovery & Outreach Studio

**NeoonLeadGen** is a local, zero-API-key Ideal Customer Profile (ICP) discovery and outreach application built for **[Neoon Studio](https://neoonai.com/neoon-studio/)** (*Voice-Note-to-Video Google Drive Pipeline*).

It discovers **10 net-new, qualified ICPs every run** across **YouTube, LinkedIn, Instagram, TikTok, and X (Twitter)** based on the exact qualification rules in [`icp.md`](./icp.md), displays them in a modern interactive table matching the `neoonai.com/neoon-studio` design system, generates tailored outreach pitches (**Short DM**, **Cold Email**, and **Arabic Pitch**), and enforces **strict per-platform deduplication** so you never get or pitch the same client twice.

---

## 📋 Table of Contents
1. [Prerequisites](#-1-prerequisites)
2. [How to Download & Run (macOS, Windows, Linux)](#-2-how-to-download--run)
3. [How to Use the Tool (Step-by-Step Workflow)](#-3-how-to-use-the-tool-step-by-step-workflow)
4. [Teammate Vault Sync (Never Pitch the Same Client Twice)](#-4-teammate-vault-sync-never-pitch-the-same-client-twice)
5. [ICP Qualification & Anti-ICP Rules (`icp.md`)](#-5-icp-qualification--anti-icp-rules-icpmd)
6. [Project Structure & Commands](#-6-project-structure--commands)
7. [Troubleshooting](#-7-troubleshooting)

---

## 🛠 1. Prerequisites

- **[Node.js](https://nodejs.org/) v18 or newer** installed on your computer.
  - Check if Node is installed by opening Terminal (Mac) or Command Prompt (Windows) and running:
    ```bash
    node -v
    ```
  - If not installed, download the **LTS** installer from **[https://nodejs.org/](https://nodejs.org/)**.
- **Google Chrome** (recommended browser).
- **Zero `npm install` or Paid API Keys Required:** The tool uses 100% native Node.js APIs and runs immediately after cloning or downloading.

---

## 🚀 2. How to Download & Run

### Step 1: Get the Code
**Option A — Clone with Git (Recommended):**
```bash
git clone https://github.com/khallad2/NeoonLeadGen.git
cd NeoonLeadGen
```

**Option B — Download ZIP (No Git Required):**
1. Click the green **`<> Code`** button at the top of `https://github.com/khallad2/NeoonLeadGen` and select **Download ZIP**.
2. Extract/unzip the `NeoonLeadGen` folder to your Desktop or Documents.

---

### Step 2: Launch the App in Chrome

#### Method 1: Terminal Command (macOS / Windows / Linux)
Inside the `NeoonLeadGen` folder, run:
```bash
npm start
```
*(This starts the local server on `http://localhost:3030` and automatically opens Google Chrome.)*

#### Method 2: 1-Click Desktop Launcher (No Terminal Needed)
- **On macOS:** Double-click **[`start-mac.command`](./start-mac.command)** in Finder.
  - *(Tip: If macOS shows an "unidentified developer" prompt the first time, right-click `start-mac.command` → click **Open** → click **Open**.)*
- **On Windows:** Double-click **[`start-windows.bat`](./start-windows.bat)** in File Explorer.

---

## 🎯 3. How to Use the Tool (Step-by-Step Workflow)

Once the app opens in Chrome (`http://localhost:3030`):

### Step 1: Select a Target Platform
Click any of the **5 Platform Tabs** at the top of the dashboard:
- **▶ YouTube** — Prioritizes 10k–50k subscriber coding/tech educators, DevRel channels, and SaaS founders using raw screen shares.
- **in LinkedIn** — Targets Seed to Series B B2B Tech/SaaS companies, DevTools, and Heads of DevRel posting text docs without video.
- **◎ Instagram** — Targets coding educators, bootcamp founders, and SaaS builders posting static code carousels.
- **♪ TikTok** — Targets technical creators and SaaS founders posting unedited screen recordings.
- **𝕏 X (Twitter)** — Targets `#buildinpublic` SaaS founders ($10k+ MRR signals), indie hackers, and DevRel thread writers.

### Step 2: Choose an ICP Persona Filter & Optional Niche Keyword
- **ICP Persona Dropdown:**
  - `All ICP Personas (ICP 1 + 2 + 3)`
  - `ICP 1: Stretched DevRel Team (B2B Tech/API)`
  - `ICP 2: Silent Tech Founder ($10k+ MRR / #buildinpublic)`
  - `ICP 3: High-Ticket Tech Educator (10k–50k Subs)`
- **Optional Niche Keyword Box:** Type any focus keyword (e.g., `system design`, `kubernetes`, `nextjs saas`, `ai agents`, `golang`) or leave it blank for automatic rotation.

### Step 3: Click `⚡ Get 10 New ICPs on [Platform]`
- Every click fetches **10 brand-new, qualified ICPs** for the selected platform.
- **Strict Per-Platform Deduplication:** Every discovered client is saved to your local vault (`data/icp_vault.json`). Subsequent runs automatically skip any client (`@handle`, channel ID, or profile URL) already in your vault for that platform so you **never get the same client twice**.

### Step 4: Approach Clients Using the Pitch Studio
For each lead in the table:
1. Click the **Client Name** or cross-platform lookup pills (`YOUTUBE ↗`, `LINKEDIN ↗`, `X ↗`) to inspect their profile or recent video.
2. Click **`📋 Quick Copy DM`** to immediately copy a tailored DM to your clipboard, OR
3. Click **`Pitch Studio ✦`** to open the slide-over outreach drawer where you can:
   - Switch between **Short DM (X / LI / IG)**, **Cold Email (with Subject line)**, and **Arabic Pitch (عربي)**.
   - Edit the message inline and add **CRM Notes** (e.g., *"Sent DM on X, offered 30s sample"*).
   - Click **`📋 Copy Pitch & Mark Contacted`** to copy the message and automatically update the client's status to **`↗ Contacted`**.

### Step 5: Filter, Track Status & Export CSV
- **View Modes (Above Table):**
  - `Latest Run (10)` — Shows only the 10 leads from your most recent run on the current platform.
  - `All Platform Leads` — Shows all unique leads collected across all runs for the current platform.
  - `All Platforms Vault` — Shows your entire multi-platform pipeline in one view.
- **Outreach Status Dropdown:** Update any row between `● New Lead`, `↗ Contacted`, `★ Replied`, `✓ Booked Call`, or `✕ Disqualified`. All changes save automatically to disk.
- **Export CSV:** Click **`Export CSV ↓`** in the top navbar to download the current filtered table as a spreadsheet.

---

## 🤝 4. Teammate Vault Sync (Never Pitch the Same Client Twice)

When two or more colleagues use `NeoonLeadGen` on their own machines, you can merge your vaults in 2 clicks so you never approach the same prospect:

1. **Export Your Vault:** Click **`Sync Vault ↓`** in the top-right navbar. This downloads a `neoon-vault-sync-YYYY-MM-DD.json` file containing all your seen clients, leads, statuses, and notes.
2. **Send to Colleague:** Share that `.json` file on Slack, WhatsApp, or Google Drive.
3. **Merge Colleague's Vault:** Your colleague clicks **`Merge Vault ↑`** in their navbar and selects the `.json` file.
   - The app automatically merges all seen client IDs and leads without creating duplicates, and preserves any updated statuses (`Contacted`, `Replied`, `Booked`)!

---

## 🎯 5. ICP Qualification & Anti-ICP Rules (`icp.md`)

| Tier | Persona | Target Profile & Buying Signals |
| :--- | :--- | :--- |
| **ICP 1** | **The Stretched "DevRel" Team** | Seed–Series B B2B Tech, DevTools, API & Cloud companies (11–200 employees). Ships heavy docs/changelogs/threads but lacks video bandwidth. |
| **ICP 2** | **The "Silent" Tech Founder** | Bootstrapped SaaS, micro-SaaS ($10k+ MRR), indie hackers (`#buildinpublic`) launching with text screenshots or unedited Loom videos. |
| **ICP 3** | **High-Ticket Technical Educator** | Coding bootcamps, cohort instructors ($500+ courses), and **10k–50k subscriber YouTube tech channels** using raw screen shares with a tiny webcam bubble and no motion graphics. |
| **Anti-ICP** | **Automatically Disqualified** | Lifestyle/daily vloggers, gaming/entertainment channels, physical e-commerce/dropshipping brands, and low-budget hobbyists. |

---

## 📂 6. Project Structure & Commands

```text
NeoonLeadGen/
├── server.js                  # Local HTTP/REST server + Cross-platform Chrome launcher
├── package.json               # Scripts & metadata (Zero external npm dependencies)
├── start-mac.command          # 1-click macOS Finder launcher
├── start-windows.bat          # 1-click Windows Explorer launcher
├── icp.md                     # Core ICP & Anti-ICP specification
├── src/
│   ├── vault.js               # Persistent per-platform deduplication & teammate merge engine
│   ├── icpClassifier.js       # ICP scoring, Anti-ICP filter & personalized pitch generator
│   └── scrapers/
│       ├── youtube.js         # Zero-key YouTube InnerTube channel & video discovery
│       └── socialPlatforms.js # Zero-key LinkedIn, Instagram, TikTok & X discovery
├── public/
│   ├── index.html             # Neoon Studio (#kh) themed UI & Outreach Pitch Studio
│   └── app.js                 # Frontend state, filtering, CSV export & Vault JSON sync
├── data/
│   └── icp_vault.json         # Local persistent lead vault (auto-created on first run)
└── test/
    └── verify.js              # Automated verification test suite
```

### Available Commands
| Command | Description |
| :--- | :--- |
| `npm start` | Starts the local server (`http://localhost:3030`) and opens Google Chrome |
| `npm run dev` | Starts the local server without auto-opening a new browser tab |
| `npm test` | Runs automated verification tests (10-lead batches, 0 duplicates across 5 platforms, Anti-ICP filter, and teammate vault merge) |

---

## 🔧 7. Troubleshooting

- **Port `3030` is already in use:**
  - `server.js` automatically detects if port `3030` is busy and falls back to `3031`, `3032`, etc., opening the exact working port in Chrome.
- **Want to start fresh on a platform?**
  - Click the **`Reset Platform Vault`** button in the top-right navbar to clear seen history for the currently selected platform.
