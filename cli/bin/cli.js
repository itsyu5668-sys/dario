#!/usr/bin/env node
'use strict';

const { getUserId } = require('../user-id');
const chalk = require('chalk');
const ora = require('ora');
const boxen = require('boxen');
const figlet = require('figlet');
const gradient = require('gradient-string');
const fs = require('fs');
const path = require('path');

const SERVER_URL = (process.env.SOVEREIGN_AI_SERVER_URL || 'https://sovereign-ai-7ml9.onrender.com').replace(/\/+$/, '');
const REQUEST_TIMEOUT_MS = 60000;
const WELCOME_FILE = path.join(process.env.HOME || process.env.USERPROFILE, '.dario-welcomed');

function usage() {
  console.error('Usage: dario "your coding question"');
  process.exit(1);
}

// Show ASCII banner on first run
function showBannerIfFirst() {
  if (!fs.existsSync(WELCOME_FILE)) {
    try {
      const banner = figlet.textSync('DARIO', { horizontalLayout: 'default' });
      const gradientBanner = gradient.rainbow(banner);
      console.log(gradientBanner);
      console.log(chalk.cyan('\nTip: Set GROQ_API_KEY to use your own key and skip the daily limit.\n'));
      fs.writeFileSync(WELCOME_FILE, '');
    } catch (err) {
      // silently ignore figlet errors
    }
  }
}

// BYOK path: if the user supplies their own Groq key, answer directly —
// no server round-trip, no daily limit, no ad.
async function askWithOwnKey(prompt) {
  const Groq = require('groq-sdk');
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  
  const spinner = ora({
    text: chalk.magenta('Thinking...'),
    spinner: 'dots',
  }).start();

  try {
    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: 'You are Dario, a concise and accurate coding assistant.' },
        { role: 'user', content: prompt },
      ],
    });
    spinner.stop();
    
    const answer = completion.choices?.[0]?.message?.content;
    if (!answer) throw new Error('Empty answer from Groq.');
    
    const box = boxen(answer, {
      title: chalk.magenta('✦ Dario'),
      padding: 1,
      borderStyle: 'round',
      borderColor: 'magenta',
      width: Math.min(80, process.stdout.columns || 80),
    });
    console.log(box);
  } catch (err) {
    spinner.stop();
    throw err;
  }
}

// Color-coded quota bar
function renderQuotaBar(remaining, limit) {
  const percent = limit > 0 ? remaining / limit : 0;
  const barWidth = 30;
  const filled = Math.round(barWidth * percent);
  
  let barColor;
  if (percent > 0.5) {
    barColor = chalk.green;
  } else if (percent > 0.15) {
    barColor = chalk.yellow;
  } else {
    barColor = chalk.red;
  }
  
  const bar = barColor('█'.repeat(filled)) + chalk.gray('█'.repeat(barWidth - filled));
  return `${bar} ${remaining}/${limit}`;
}

async function askServer(prompt) {
  const userId = getUserId();
  
  const spinner = ora({
    text: chalk.magenta('Thinking...'),
    spinner: 'dots',
  }).start();

  let res;
  try {
    res = await fetch(`${SERVER_URL}/api/v1/query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, prompt }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    spinner.stop();
    console.error(`Could not reach the Dario server at ${SERVER_URL}.`);
    console.error('Check that it is running, or set SOVEREIGN_AI_SERVER_URL to its address.');
    process.exit(1);
  }

  let body;
  try {
    body = await res.json();
  } catch {
    spinner.stop();
    console.error(`The server returned an unreadable response (HTTP ${res.status}). Please try again.`);
    process.exit(1);
  }

  if (!res.ok) {
    spinner.stop();
    console.error(body.message || `Request failed (HTTP ${res.status}). Please try again.`);
    process.exit(res.status === 402 ? 2 : 1);
  }

  spinner.stop();

  const box = boxen(body.response, {
    title: chalk.magenta('✦ Dario'),
    padding: 1,
    borderStyle: 'round',
    borderColor: 'magenta',
    width: Math.min(80, process.stdout.columns || 80),
  });
  console.log(box);

  if (typeof body.remaining === 'number') {
    console.log(`\n${renderQuotaBar(body.remaining, body.limit)}`);
  }
}

async function main() {
  showBannerIfFirst();
  
  const prompt = process.argv.slice(2).join(' ').trim();
  if (!prompt) usage();

  try {
    if (process.env.GROQ_API_KEY) {
      await askWithOwnKey(prompt);
    } else {
      await askServer(prompt);
    }
  } catch (err) {
    console.error(`Something went wrong: ${err.message}`);
    process.exit(1);
  }
}

main();
