#!/usr/bin/env node
'use strict';

const { getUserId } = require('../user-id');

const SERVER_URL = (process.env.SOVEREIGN_AI_SERVER_URL || 'https://sovereign-ai-7ml9.onrender.com').replace(/\/+$/, '');
const REQUEST_TIMEOUT_MS = 60000;

function usage() {
  console.error('Usage: dario "your coding question"');
  process.exit(1);
}

// BYOK path: if the user supplies their own Groq key, answer directly —
// no server round-trip, no daily limit, no ad.
async function askWithOwnKey(prompt) {
  const Groq = require('groq-sdk');
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const completion = await groq.chat.completions.create({
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    messages: [
      { role: 'system', content: 'You are Dario, a concise and accurate coding assistant.' },
      { role: 'user', content: prompt },
    ],
  });
  const answer = completion.choices?.[0]?.message?.content;
  if (!answer) throw new Error('Empty answer from Groq.');
  return answer;
}

async function askServer(prompt) {
  const userId = getUserId();
  let res;
  try {
    res = await fetch(`${SERVER_URL}/api/v1/query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, prompt }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    console.error(`Could not reach the Dario server at ${SERVER_URL}.`);
    console.error('Check that it is running, or set SOVEREIGN_AI_SERVER_URL to its address.');
    process.exit(1);
  }

  let body;
  try {
    body = await res.json();
  } catch {
    console.error(`The server returned an unreadable response (HTTP ${res.status}). Please try again.`);
    process.exit(1);
  }

  if (!res.ok) {
    console.error(body.message || `Request failed (HTTP ${res.status}). Please try again.`);
    process.exit(res.status === 402 ? 2 : 1);
  }

  console.log(body.response);
  if (typeof body.remaining === 'number') {
    console.log(`\n(${body.remaining} of ${body.limit} free queries remaining today)`);
  }
}

async function main() {
  const prompt = process.argv.slice(2).join(' ').trim();
  if (!prompt) usage();

  try {
    if (process.env.GROQ_API_KEY) {
      console.log(await askWithOwnKey(prompt));
    } else {
      await askServer(prompt);
    }
  } catch (err) {
    console.error(`Something went wrong: ${err.message}`);
    process.exit(1);
  }
}

main();
