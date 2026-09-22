#!/usr/bin/env node
//
// Creates every custom field the API handlers write to.
//
// Beehiiv discards custom fields that do not already exist on the publication
// and still returns success, so a missing field looks exactly like a working
// one. This reads the field names straight out of api/*.js, so the list cannot
// drift from what the code actually sends.
//
//   BEEHIIV_API_KEY=... BEEHIIV_PUBLICATION_ID=... node scripts/create-beehiiv-fields.mjs
//
// Add --dry-run to see what it would do without writing anything.

import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DRY     = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');
// --only NAME limits the run to a single field, for diagnosing what the API
// actually returns without making 48 calls to find out.
const onlyArg = process.argv.indexOf('--only');
const ONLY    = onlyArg > -1 ? process.argv[onlyArg + 1] : null;

// Credentials come from the environment if they are set, and are otherwise
// asked for. Typing them at a prompt keeps them out of shell history, which
// passing them on the command line does not.
async function ask(question) {
  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

// A key typed at an echoing prompt ends up in the terminal scrollback, which is
// how one got pasted into a chat. Mask it.
function askSecret(question) {
  return new Promise((resolve) => {
    const { createInterface } = require('node:readline');
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;
    rl._writeToOutput = (str) => {
      if (!muted) { rl.output.write(str); return; }
      // Redraw the prompt with dots so length is not revealed either.
      if (str.includes(question)) rl.output.write(str);
    };
    rl.question(question, (answer) => {
      muted = false;
      rl.output.write('\n');
      rl.close();
      resolve(answer.trim());
    });
    muted = true;
  });
}

const placeholder = (v) => !v || v === 'REPLACE_ME';

let API_KEY = process.env.BEEHIIV_API_KEY;
let PUB_ID  = process.env.BEEHIIV_PUBLICATION_ID;

if (placeholder(API_KEY) || placeholder(PUB_ID)) {
  console.log('Both values are in Vercel -> Settings -> Environment Variables.');
  console.log('Nothing typed here is saved to a file or to shell history.\n');
}
if (placeholder(API_KEY)) API_KEY = await askSecret('Beehiiv API key (hidden): ');
if (placeholder(PUB_ID))  PUB_ID  = await ask('Beehiiv publication ID (pub_...): ');

if (placeholder(API_KEY) || placeholder(PUB_ID)) {
  console.error('\nBoth values are required.');
  process.exit(1);
}
// The two values look nothing alike, and pasting the publication ID into both
// prompts produces a 401 that reads like a bad key rather than a wrong value.
if (API_KEY.startsWith('pub_')) {
  console.error(`\nThat is the publication ID, not the API key — they are different values.`);
  console.error(`The publication ID starts "pub_". The API key does not: it is a long`);
  console.error(`random string, found in Beehiiv under Settings -> API, or in Vercel as`);
  console.error(`BEEHIIV_API_KEY.`);
  process.exit(1);
}
if (!PUB_ID.startsWith('pub_')) {
  console.error(`\nThat publication ID does not start with "pub_" — check it before continuing.`);
  process.exit(1);
}
console.log('');

const apiDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'api');
const wanted = new Set();
for (const file of readdirSync(apiDir).filter((f) => f.endsWith('.js'))) {
  const src = readFileSync(join(apiDir, file), 'utf8');
  for (const m of src.matchAll(/name:\s*'(ib[a-z_]*)'/g)) wanted.add(m[1]);
}
const names = [...wanted].sort();
console.log(`${names.length} custom fields referenced by the handlers\n`);

const headers = {
  'Content-Type':  'application/json',
  'Authorization': `Bearer ${API_KEY}`,
};

// Skip anything that already exists, so this is safe to re-run.
let existing = new Set();
try {
  const res = await fetch(
    `https://api.beehiiv.com/v2/publications/${PUB_ID}/custom_fields?limit=100`,
    { headers }
  );
  if (res.ok) {
    const body = await res.json();
    for (const f of body.data || []) existing.add(f.display);
    console.log(`already present: ${existing.size ? [...existing].join(', ') : 'none'}\n`);
  } else if (res.status === 401) {
    console.error(`The API key was rejected (401). Nothing was created.`);
    console.error(`Check it against Vercel, or create a new one in Beehiiv under Settings -> API.`);
    process.exit(1);
  } else {
    console.warn(`could not list existing fields (${res.status}) — will attempt all\n`);
  }
} catch (err) {
  console.warn(`could not list existing fields (${err.message}) — will attempt all\n`);
}

let created = 0, skipped = 0, failed = 0;
const targets = ONLY ? names.filter((n) => n === ONLY) : names;
if (ONLY && !targets.length) {
  console.error(`No field named "${ONLY}" is referenced by the handlers.`);
  process.exit(1);
}
for (const display of targets) {
  if (existing.has(display)) {
    console.log(`  skip    ${display}`);
    skipped++;
    continue;
  }
  if (DRY) {
    console.log(`  would create ${display}`);
    created++;
    continue;
  }
  try {
    const res = await fetch(
      `https://api.beehiiv.com/v2/publications/${PUB_ID}/custom_fields`,
      { method: 'POST', headers, body: JSON.stringify({ kind: 'string', display }) }
    );
    if (res.ok) {
      const body = await res.text();
      console.log(`  created ${display}${VERBOSE ? `  [${res.status}] ${body.slice(0, 300)}` : ''}`);
      created++;
    } else {
      console.log(`  FAILED  ${display} — ${res.status} ${(await res.text()).slice(0, 120)}`);
      failed++;
    }
  } catch (err) {
    console.log(`  FAILED  ${display} — ${err.message}`);
    failed++;
  }
  // Beehiiv rate-limits; this is a one-off so there is no reason to rush it.
  await new Promise((r) => setTimeout(r, 500));
}

console.log(`\ncreated ${created}, skipped ${skipped}, failed ${failed}`);

// A 2xx is not proof. An earlier run reported 48 creations and the publication
// still listed six, so the only trustworthy check is asking again afterwards.
if (!DRY) {
  await new Promise((r) => setTimeout(r, 1500));
  try {
    const res = await fetch(
      `https://api.beehiiv.com/v2/publications/${PUB_ID}/custom_fields?limit=100`,
      { headers }
    );
    if (res.ok) {
      const body = await res.json();
      const live = new Set((body.data || []).map((f) => f.display));
      const missing = names.filter((n) => !live.has(n));
      console.log(`\nverified against the publication: ${names.length - missing.length}/${names.length} present`);
      if (missing.length) {
        console.log(`still missing (${missing.length}): ${missing.join(', ')}`);
        console.log(`re-run to attempt these again — existing fields are skipped.`);
        process.exitCode = 1;
      } else {
        console.log('all fields the handlers write to now exist.');
      }
    } else {
      console.warn(`\ncould not verify (${res.status}) — check the custom fields page manually.`);
    }
  } catch (err) {
    console.warn(`\ncould not verify (${err.message}) — check the custom fields page manually.`);
  }
}
if (failed) process.exitCode = 1;
