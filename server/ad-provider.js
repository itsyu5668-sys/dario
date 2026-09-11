'use strict';

// Fetches one sponsored "Blip" from OpenCrater and formats it as a small
// text block appended to the answer.
//
// Fail-silent by contract: any problem (missing key, network error, slow
// response, no fill) resolves to null and never throws, so the AI answer
// always goes out with or without an ad.

const { sponsor } = require('opencrater');

const AD_TIMEOUT_MS = 4000;

// Fallback sponsors shown when OpenCrater has no fill (still in review, no
// campaign, or errors). Keyed by topic tag; the server picks one whose tag
// appears in the user's prompt, else a random one. Empty table = show
// nothing, same as before. Links must be real affiliate URLs supplied by
// the operator — never placeholders.
const AFFILIATE_LINKS = {
  // docker:     { label: '...', text: '...', url: 'https://...?ref=...' },
  // database:   { label: '...', text: '...', url: 'https://...?ref=...' },
  // auth:       { label: '...', text: '...', url: 'https://...?ref=...' },
  // python:     { label: '...', text: '...', url: 'https://...?ref=...' },
  // javascript: { label: '...', text: '...', url: 'https://...?ref=...' },
};

function formatAffiliate(entry) {
  return [
    '',
    '────────────────────────────────────────',
    `Sponsored · ${entry.label}`,
    entry.text,
    `→ ${entry.url}`,
  ].join('\n');
}

function affiliateFallback(prompt) {
  const entries = Object.entries(AFFILIATE_LINKS).filter(([, v]) => v && v.url);
  if (entries.length === 0) return null;
  const lower = (prompt || '').toLowerCase();
  const matching = entries.filter(([tag]) => lower.includes(tag));
  const pool = matching.length > 0 ? matching : entries;
  const [, entry] = pool[Math.floor(Math.random() * pool.length)];
  return formatAffiliate(entry);
}

function formatBlip(blip) {
  const lines = [
    '',
    '────────────────────────────────────────',
    `Sponsored · ${blip.sponsorLabel}`,
  ];
  if (blip.creative.title && blip.creative.title !== blip.sponsorLabel) {
    lines.push(blip.creative.title);
  }
  if (blip.creative.body) lines.push(blip.creative.body);
  const cta = blip.creative.cta || blip.clickUrl;
  if (cta) lines.push(`→ ${cta}`);
  return lines.join('\n');
}

async function getAd(prompt) {
  const publisherKey = process.env.OPENCRATER_PUBLISHER_KEY;
  if (!publisherKey) {
    console.log('[ad-provider] no OPENCRATER_PUBLISHER_KEY set, skipping OpenCrater');
  } else {
    try {
      const blip = await Promise.race([
        sponsor.fetch({
          publisherKey,
          packageName: 'sovereign-ai',
          placement: 'command-finished',
          host: 'generic',
        }),
        new Promise((resolve) => setTimeout(() => resolve(null), AD_TIMEOUT_MS)),
      ]);
      if (blip) {
        console.log('[ad-provider] got a Blip from OpenCrater');
        return formatBlip(blip);
      }
      console.log('[ad-provider] OpenCrater returned no fill');
    } catch (err) {
      console.log('[ad-provider] OpenCrater sponsor.fetch threw:', err && err.message);
    }
  }
  return affiliateFallback(prompt);
}

module.exports = { getAd };
