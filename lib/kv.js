// Minimal Upstash Redis REST client (no dependencies). Used for persistent
// storage on serverless hosts such as Vercel, where the filesystem is
// read-only and resets between requests.
//
// Configure with either pair of env vars (Vercel's Upstash integration sets
// the KV_* ones automatically):
//   KV_REST_API_URL + KV_REST_API_TOKEN
//   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const PREFIX = 'xoralure:';

const enabled = Boolean(URL_ && TOKEN);

async function pipeline(commands) {
  const res = await fetch(`${URL_}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands)
  });
  if (!res.ok) throw new Error(`KV ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const out = await res.json();
  const err = out.find((r) => r.error);
  if (err) throw new Error('KV: ' + err.error);
  return out.map((r) => r.result);
}

// Read several JSON values at once; missing keys come back as undefined
async function getMany(names) {
  const results = await pipeline(names.map((n) => ['GET', PREFIX + n]));
  const out = {};
  names.forEach((n, i) => { out[n] = results[i] == null ? undefined : JSON.parse(results[i]); });
  return out;
}

function set(name, value) {
  return pipeline([['SET', PREFIX + name, JSON.stringify(value)]]);
}

module.exports = { enabled, getMany, set };
