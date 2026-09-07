# Dario

A free, ad-supported AI coding assistant for your terminal.

```
dario "how do I list files in a directory in bash"
```

Every user gets a daily quota of free queries (default 150, same for
everyone, no regional restrictions of any kind). Past the limit, set your
own Groq API key (`export GROQ_API_KEY=...`) to keep going with no cap.

## How it works

The CLI sends your question to the Dario server, which answers it
through a fallback chain of inference providers — **Groq → Cerebras →
Gemini** — trying the next one whenever the previous is rate-limited or
fails. Responses may include one small sponsored text block ("Blip") from
OpenCrater, which is what keeps the service free.

## Privacy notes

- **Gemini fallback**: if your query is answered by the Gemini fallback
  specifically, the  prompt may be used by Google to improve their products that's Google's
  free-tier terms, not ours.Queries are anonymous
  (identified only by a random per-machine ID), but don't paste secrets
  into prompts regardless.
- This tool is supported by unobtrusive Blips which we use to fund the credits

## Development

```
server/   Fastify backend: quota, inference fallback chain, ad fetch
cli/      The `dario` command
```

## Install & use (users)

```
npm install -g dario
dario "how do I undo a git commit"
```

The CLI ships with the production server URL built in — no setup needed.
Power users can override it with `SOVEREIGN_AI_SERVER_URL`. If you hit the
daily limit, set your own `GROQ_API_KEY` and the CLI bypasses the server
entirely — no quota, no ads.

## Development

Server: `cd server && cp .env.example .env && npm install && npm start`
CLI: `cd cli && npm install && npm link`
