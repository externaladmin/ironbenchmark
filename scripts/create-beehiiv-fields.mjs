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
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_KEY = process.env.BEEHIIV_API_KEY;
const PUB_ID  = process.env.BEEHIIV_PUBLICATION_ID;
const DRY     = process.argv.includes('--dry-run');

if (!API_KEY || !PUB_ID) {
  console.error('Set BEEHIIV_API_KEY and BEEHIIV_PUBLICATION_ID in the environment.');
  console.error('Both are already in your Vercel project settings.');
  process.exit(1);
}

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
  } else {
    console.warn(`could not list existing fields (${res.status}) — will attempt all\n`);
  }
} catch (err) {
  console.warn(`could not list existing fields (${err.message}) — will attempt all\n`);
}

let created = 0, skipped = 0, failed = 0;
for (const display of names) {
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
      console.log(`  created ${display}`);
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
  await new Promise((r) => setTimeout(r, 350));
}

console.log(`\ncreated ${created}, skipped ${skipped}, failed ${failed}`);
if (failed) process.exitCode = 1;
