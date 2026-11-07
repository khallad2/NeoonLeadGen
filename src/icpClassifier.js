/**
 * Neoon Studio — ICP Classifier, Anti-ICP Filter & Personalized Pitch Engine
 * Strictly implements criteria from marketing/icp.md
 */

const ANTI_ICP_KEYWORDS = [
  'daily vlog',
  'family vlog',
  'lifestyle vlog',
  'morning routine',
  'night routine',
  'makeup tutorial',
  'skincare routine',
  'beauty guru',
  'fashion haul',
  'clothing haul',
  'outfit ideas',
  'mukbang',
  'asmr eating',
  'prank channel',
  'gaming walkthrough',
  'minecraft lets play',
  'fortnite montage',
  'roblox roleplay',
  'celebrity gossip',
  'drama alert',
  'physical product brand',
  'shopify dropshipping store',
  'handmade jewelry',
  'luxury watches unboxing',
  'fitness apparel',
  'workout vlog',
  'cooking recipe',
  'travel vlog'
];

const ICP1_KEYWORDS = [
  'devrel',
  'developer relations',
  'developer advocate',
  'developer marketing',
  'api platform',
  'devtools',
  'developer tools',
  'cloud infrastructure',
  'sdk',
  'kubernetes',
  'serverless',
  'observability',
  'open source',
  'database',
  'webhook',
  'cli tool',
  'ci/cd',
  'b2b saas',
  'documentation',
  'release notes',
  'changelog',
  'platform engineering',
  'microservices'
];

const ICP2_KEYWORDS = [
  'buildinpublic',
  '#buildinpublic',
  'indie hacker',
  'indieie',
  'bootstrapped',
  'micro-saas',
  'microsaas',
  'mrr',
  'arr',
  'solo founder',
  'co-founder',
  'cofounder',
  'technical founder',
  'saas founder',
  'dev agency',
  'software agency',
  'producthunt',
  'product hunt',
  'launching',
  'shipped',
  'founder led'
];

const ICP3_KEYWORDS = [
  'tutorial',
  'system design',
  'coding course',
  'bootcamp',
  'cohort',
  'software architecture',
  'full stack',
  'fullstack',
  'backend engineering',
  'frontend master',
  'typescript',
  'nextjs',
  'react',
  'python',
  'golang',
  'rust',
  'ai engineering',
  'llm',
  'machine learning',
  'devops',
  'aws',
  'leetcode',
  'data structures',
  'technical instructor',
  'academy',
  'course creator',
  'programming'
];

/**
 * Parses human-readable subscriber/follower strings like "24.5K subscribers" -> 24500
 */
function parseSubscriberCount(text) {
  if (typeof text === 'number') return text;
  if (!text) return 0;
  const clean = String(text).toUpperCase().replace(/,/g, '');
  const match = clean.match(/(\d+(?:\.\d+)?)\s*([KMB])?/);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  const unit = match[2];
  if (unit === 'K') return Math.round(val * 1_000);
  if (unit === 'M') return Math.round(val * 1_000_000);
  if (unit === 'B') return Math.round(val * 1_000_000_000);
  return Math.round(val);
}

/**
 * Checks if a candidate matches Anti-ICP criteria in icp.md
 */
function isAntiICP(candidate) {
  const haystack = [
    candidate.name || '',
    candidate.handle || '',
    candidate.bio || '',
    candidate.recentContent || '',
    candidate.niche || ''
  ]
    .join(' ')
    .toLowerCase();

  for (const badWord of ANTI_ICP_KEYWORDS) {
    if (haystack.includes(badWord)) {
      return { disqualified: true, reason: `Anti-ICP match: "${badWord}" (Lifestyle/Vlog/Physical E-com)` };
    }
  }

  return { disqualified: false, reason: null };
}

/**
 * Scores and classifies a candidate into ICP 1, ICP 2, or ICP 3 based on icp.md
 */
function classifyCandidate(candidate, preferredTier = 'all') {
  const antiCheck = isAntiICP(candidate);
  if (antiCheck.disqualified) {
    return { disqualified: true, reason: antiCheck.reason };
  }

  const haystack = [
    candidate.name || '',
    candidate.handle || '',
    candidate.bio || '',
    candidate.recentContent || '',
    candidate.niche || '',
    candidate.buyingSignal || ''
  ]
    .join(' ')
    .toLowerCase();

  let score1 = 0;
  let score2 = 0;
  let score3 = 0;

  for (const kw of ICP1_KEYWORDS) {
    if (haystack.includes(kw)) score1 += 15;
  }
  for (const kw of ICP2_KEYWORDS) {
    if (haystack.includes(kw)) score2 += 15;
  }
  for (const kw of ICP3_KEYWORDS) {
    if (haystack.includes(kw)) score3 += 14;
  }

  const subs = candidate.subscribersNum || parseSubscriberCount(candidate.subscribersText);

  // YouTube 10k-50k subscriber sweet spot for ICP 3 (from icp.md line 72)
  const isSweetSpot10kTo50k = subs >= 10_000 && subs <= 55_000;
  if (candidate.platform === 'youtube' && isSweetSpot10kTo50k) {
    score3 += 22;
  }

  // Respect explicit candidate tier or preferred filter if strong match
  let icpTier = candidate.icpTier || null;
  if (!icpTier) {
    if (preferredTier && ['icp1', 'icp2', 'icp3'].includes(preferredTier)) {
      icpTier = preferredTier;
    } else if (score1 >= score2 && score1 >= score3 && score1 > 0) {
      icpTier = 'icp1';
    } else if (score2 >= score1 && score2 >= score3 && score2 > 0) {
      icpTier = 'icp2';
    } else {
      icpTier = 'icp3';
    }
  }

  const tierMeta = {
    icp1: {
      icpLabel: 'ICP 1 · Stretched DevRel',
      defaultSignal: 'Ships heavy technical docs/changelogs; video output bottlenecked by engineering bandwidth',
      defaultGap: 'Needs voice-note-to-video pipeline to turn release notes & docs into high-retention explainers without putting engineers on camera.'
    },
    icp2: {
      icpLabel: 'ICP 2 · Silent Tech Founder',
      defaultSignal: 'Active #buildinpublic / SaaS builder relying on static text & raw screen captures',
      defaultGap: 'Needs zero-camera avatar + motion graphics pipeline to scale founder-led YouTube/social inbound while staying focused on code.'
    },
    icp3: {
      icpLabel: 'ICP 3 · Technical Educator',
      defaultSignal: isSweetSpot10kTo50k
        ? '10k–50k Sweet Spot Educator: Deep technical tutorials using basic screen-share & corner webcam'
        : 'High-ticket technical educator teaching complex system/code concepts with static slides & raw screen recordings',
      defaultGap: 'Needs automated zoom/pan, dynamic b-roll, and architecture motion graphics from voice notes to boost viewer retention.'
    }
  };

  const meta = tierMeta[icpTier] || tierMeta.icp3;
  const rawScore = Math.max(score1, score2, score3, 25);
  const icpScore = Math.min(99, Math.max(82, 76 + Math.round(rawScore / 3) + (isSweetSpot10kTo50k ? 5 : 0)));

  const enriched = {
    ...candidate,
    subscribersNum: subs,
    subscribersText: candidate.subscribersText || (subs ? `${(subs / 1000).toFixed(1)}K` : 'Active'),
    icpTier,
    icpLabel: meta.icpLabel,
    icpScore: candidate.icpScore || icpScore,
    buyingSignal: candidate.buyingSignal || meta.defaultSignal,
    videoGap: candidate.videoGap || meta.defaultGap
  };

  enriched.pitches = generatePitches(enriched);
  return { disqualified: false, lead: enriched };
}

/**
 * Generates personalized outreach messages tailored to the lead's ICP tier & recent content.
 */
function generatePitches(lead) {
  const firstName = String(lead.name || 'there')
    .replace(/[@#]/g, '')
    .split(/[\s|—\-–•]+/)[0]
    .trim();

  const topic = lead.recentContent
    ? `"${lead.recentContent.slice(0, 68)}${lead.recentContent.length > 68 ? '...' : ''}"`
    : `your recent ${lead.niche || 'technical'} breakdown`;

  let dm = '';
  let emailSubject = '';
  let emailBody = '';

  if (lead.icpTier === 'icp1') {
    dm = `Hey ${firstName} — loved ${topic}. Quick question: how much time is your DevRel team spending turning technical docs & release notes into video right now?\n\nI built a voice-note-to-video pipeline at Neoon Studio (https://neoonai.com/neoon-studio/) where your engineers just drop a raw voice note or screen capture in Google Drive, and within 24h we deliver an avatar-led explainer with architecture motion graphics & dynamic zooms. Zero camera time required.\n\nOpen to seeing a 30-sec sample built from one of your docs?`;

    emailSubject = `Turning ${lead.name}'s docs into studio explainers (zero camera time)`;
    emailBody = `Hi ${firstName},\n\nI came across ${topic} on ${lead.platform.toUpperCase()} and noticed how much deep technical value you're shipping.\n\nMost DevRel & B2B SaaS teams we speak with have great written docs and changelogs, but video becomes a bottleneck because engineers hate setting up cameras, lighting, and editing timelines.\n\nAt Neoon Studio (https://neoonai.com/neoon-studio/), we built a Google Drive pipeline specifically for technical teams:\n1. You drop a raw voice note or unedited screen share into a shared Drive folder.\n2. Within 24 hours, we turn it into a high-retention video with a realistic AI avatar, lip-sync, code zoom-ins, and custom architecture motion graphics.\n\nWould you be open to me converting one of your recent technical posts into a 30-second sample video so you can judge the quality firsthand?\n\nBest,\nKhallad\nNeoon Studio — https://neoonai.com/neoon-studio/`;
  } else if (lead.icpTier === 'icp2') {
    dm = `Hey ${firstName}! Been following your build and saw ${topic}. Are you currently editing your own product videos or skipping video to focus on shipping code?\n\nI built a pipeline at Neoon Studio (https://neoonai.com/neoon-studio/) for founders: you just drop a raw voice note on Google Drive, and in 24h we turn it into a studio-grade avatar + motion graphics explainer. Zero on-camera time or CapCut needed.\n\nDown to see how a 30s version of your latest update looks?`;

    emailSubject = `Zero-camera video pipeline for ${lead.name} (from voice notes)`;
    emailBody = `Hi ${firstName},\n\nSaw ${topic} and loved what you're building.\n\nAs a technical founder, you already know video on YouTube, X, and LinkedIn drives massive inbound—but getting on camera and editing in Premiere/CapCut steals hours from writing code and closing users.\n\nThat's why I built Neoon Studio's Voice-to-Video Google Drive pipeline (https://neoonai.com/neoon-studio/):\n• Drop a raw 60-second voice note (or silent Loom capture) into Google Drive.\n• In 24 hours, receive a polished explainer with your realistic avatar, dynamic UI zoom/pan, and motion graphics.\n\nMind if I send over a quick 30-second concept based on your latest feature launch?\n\nBest,\nKhallad\nNeoon Studio — https://neoonai.com/neoon-studio/`;
  } else {
    dm = `Hey ${firstName} — huge fan of the technical depth in ${topic}. Noticed your tutorials rely mostly on raw screen shares, which leaves a lot of viewer retention on the table.\n\nAt Neoon Studio (https://neoonai.com/neoon-studio/), we built a pipeline for technical educators: you drop a voice note or raw recording into Google Drive, and within 24h we add studio motion graphics, smooth code zooms, b-roll, and avatar segments.\n\nWant me to upgrade 30 seconds of your latest video so you can see the retention difference?`;

    emailSubject = `Upgrading ${lead.name}'s tutorial retention + short-form funnel (24h turnaround)`;
    emailBody = `Hi ${firstName},\n\nI just watched ${topic} — the technical explanation is top-tier.\n\nOne thing I noticed: while the code breakdown is super clear, adding architecture motion graphics, smooth zoom/pan keyframes, and dynamic b-roll during dense explanations can dramatically boost average view duration (and give you ready-to-post Shorts/Reels for your course funnel).\n\nAt Neoon Studio (https://neoonai.com/neoon-studio/), we run a 24-hour Google Drive pipeline for technical educators:\n• Drop a voice note or raw recording into Drive.\n• We build the avatar lip-sync, precision zoom-ins, and custom system-design motion graphics in 24 hours.\n\nCould I re-edit a 30-second clip from ${topic} as a free proof-of-concept for you this week?\n\nBest,\nKhallad\nNeoon Studio — https://neoonai.com/neoon-studio/`;
  }

  const arabicDm = `أهلاً ${firstName} 👋\nلفت انتباهي المحتوى التقني القوي في ${topic}.\n\nبنينا في Neoon Studio (https://neoonai.com/neoon-studio/) خط إنتاج يحوّل مجرد ملاحظة صوتية (Voice Note) ترفعها على Google Drive إلى فيديو احترافي كامل خلال 24 ساعة (أفاتار واقعي + مطابقة شفاه + تقريب وتبعيد ذكي للكود + موشن جرافيك هندسي) بدون أي حاجة للظهور أمام الكاميرا أو المونتاج.\n\nهل تحب أرسل لك عينة 30 ثانية مصممة خصيصاً لمحتواك؟`;

  return {
    dm,
    emailSubject,
    email: `Subject: ${emailSubject}\n\n${emailBody}`,
    arabicDm
  };
}

module.exports = {
  parseSubscriberCount,
  isAntiICP,
  classifyCandidate,
  generatePitches
};
