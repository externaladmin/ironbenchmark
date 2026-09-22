// Vercel Serverless Function: /api/partial
//
// Records that someone gave an address mid-survey and how far they had got.
// This is what makes an abandonment reminder possible at all: without it a
// respondent who stops at question twelve is invisible and unreachable.
//
// Storage is Beehiiv, deliberately. The reminder itself is a Beehiiv
// automation sending to everyone carrying the partial tag whose ib_completed
// field is still "no" — the survey handlers flip that to "yes" on submission,
// so a respondent who finishes is never chased. Nothing here sends email.
//
// Partials are not archived the way completed responses are: they arrive
// several times per respondent as they advance, and losing one costs a
// reminder rather than a response.

// Best-effort per-IP rate limiting, per instance. Same caveat as the survey
// endpoints: it raises the cost of naive flooding, it does not guarantee a cap.
const RECENT      = new Map();
const RATE_MAX    = 12;
const RATE_WINDOW = 10 * 60 * 1000;

function rateLimited(ip) {
  if (!ip) return false;
  const now  = Date.now();
  const hits = (RECENT.get(ip) || []).filter((t) => now - t < RATE_WINDOW);
  hits.push(now);
  RECENT.set(ip, hits);
  if (RECENT.size > 2000) {
    for (const [k, v] of RECENT) {
      if (!v.some((t) => now - t < RATE_WINDOW)) RECENT.delete(k);
    }
  }
  return hits.length > RATE_MAX;
}

const STUDIES = {
  'state-of-marketing-2026': 'ironbenchmark-2026',
  'ai-sales-2026':           'ironbenchmark-ai-2026',
  'dealer-response-2026':    'ironbenchmark-dealer-response-2026',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email: rawEmail, study, section, hp, elapsedMs } = req.body || {};

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }
  if (!STUDIES[study]) {
    return res.status(400).json({ error: 'Unknown study' });
  }

  // Same bot filter as the survey endpoints. A hit returns an ordinary success
  // and writes nothing, so a script cannot tell it was filtered.
  const honeypot  = typeof hp === 'string' ? hp.trim() : '';
  const elapsed   = Number(elapsedMs) || 0;
  const clientIp  = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  const botReason =
      honeypot                           ? 'honeypot filled'
    : (elapsed > 0 && elapsed < 15000)   ? 'reached in ' + elapsed + 'ms'
    : rateLimited(clientIp)              ? 'rate limit'
    : null;

  if (botReason) {
    console.warn('Discarded partial:', email, botReason, clientIp);
    return res.status(200).json({ success: true });
  }

  const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY;
  const BEEHIIV_PUB_ID  = process.env.BEEHIIV_PUBLICATION_ID;
  if (!BEEHIIV_API_KEY || !BEEHIIV_PUB_ID) {
    console.error('Missing environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const prefix = STUDIES[study];

  try {
    const beehiivRes = await fetch(
      `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUB_ID}/subscriptions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${BEEHIIV_API_KEY}`,
        },
        body: JSON.stringify({
          email,
          reactivate_existing: false,
          send_welcome_email:  false,
          utm_source:          'ironbenchmark',
          utm_medium:          'survey-partial',
          utm_campaign:        study,
          custom_fields: [
            { name: 'ib_partial_study',   value: study },
            { name: 'ib_partial_section', value: String(section || '') },
            { name: 'ib_completed',       value: 'no' },
          ],
        }),
      }
    );

    if (!beehiivRes.ok) {
      const errBody = await beehiivRes.text();
      console.error('Partial beehiiv error:', email, beehiivRes.status, errBody);
      return res.status(200).json({ success: true, beehiivOk: false, beehiivStatus: beehiivRes.status });
    }

    // Tags are not accepted by the create endpoint and need their own call.
    let tagsOk = false;
    let created = null;
    try { created = await beehiivRes.json(); } catch (e) { /* empty body */ }

    const warnings = created?.data?.warnings || created?.warnings;
    if (warnings && warnings.length) {
      console.warn('Partial beehiiv warnings:', email, JSON.stringify(warnings));
    }

    const subId = created?.data?.id;
    if (subId) {
      try {
        const tagRes = await fetch(
          `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUB_ID}/subscriptions/${subId}/tags`,
          {
            method:  'POST',
            headers: {
              'Content-Type':  'application/json',
              'Authorization': `Bearer ${BEEHIIV_API_KEY}`,
            },
            body: JSON.stringify({ tags: [prefix + '-partial'] }),
          }
        );
        tagsOk = tagRes.ok;
        if (!tagRes.ok) console.error('Partial tag error:', email, tagRes.status, await tagRes.text());
      } catch (err) {
        console.error('Partial tag exception:', email, err);
      }
    } else {
      console.error('Partial: no subscription id returned', email);
    }

    return res.status(200).json({ success: true, beehiivOk: true, tagsOk, beehiivStatus: 200 });
  } catch (err) {
    console.error('Partial exception:', email, err);
    return res.status(200).json({ success: true, beehiivOk: false });
  }
}
