// Vercel Serverless Function: /api/subscribe-ib-notify
// Handles the homepage "get the reports when they publish" signup
// - Adds the address to Beehiiv with tag "ironbenchmark-early-access"
// - Archives the raw signup so a Beehiiv failure cannot silently drop it
// - Sends a short confirmation via Resend

// Best-effort per-IP rate limiting. Serverless instances are ephemeral and run in
// parallel, so this map is per-instance rather than global — it raises the cost of
// naive flooding, it does not guarantee a ceiling. A shared store would be needed
// for that, and is the right upgrade if this ever sees real abuse.
const RECENT      = new Map();
const RATE_MAX    = 6;
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, source } = req.body || {};

  // Server-side validation — the browser checks are a convenience, not a guarantee.
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'Valid email required' });
  }
  const address = email.trim().toLowerCase();

  const RESEND_API_KEY  = process.env.RESEND_API_KEY;
  const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY;
  const BEEHIIV_PUB_ID  = process.env.BEEHIIV_PUBLICATION_ID;

  if (!RESEND_API_KEY || !BEEHIIV_API_KEY || !BEEHIIV_PUB_ID) {
    console.error('Missing environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const STUDY        = 'early-access';
  const ARCHIVE_TO   = process.env.ARCHIVE_EMAIL || 'info@ironbenchmark.com';
  const submissionId = STUDY + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  const submittedAt  = new Date().toISOString();

  // ── Bot filter ─────────────────────────────────────────────────────────────
  // The honeypot used to be checked in the browser only, which does nothing about a
  // script POSTing straight to this endpoint — the case that actually matters. These
  // run server-side, and a hit returns an ordinary success response while writing
  // nothing: a bot that is told it was blocked simply adapts.
  const hp        = typeof req.body.hp === 'string' ? req.body.hp.trim() : '';
  const elapsedMs = Number(req.body.elapsedMs) || 0;
  const clientIp  = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();

  const botReason =
      hp                                   ? 'honeypot filled'
    : (elapsedMs > 0 && elapsedMs < 15000) ? 'completed in ' + elapsedMs + 'ms'
    : rateLimited(clientIp)                ? 'rate limit'
    : null;

  if (botReason) {
    console.warn('Discarded submission:', submissionId, botReason, clientIp);
    return res.status(200).json({ success: true, submissionId, confirmationSent: false });
  }


  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  // HTTP status of each Resend call, surfaced in the response so a delivery
  // failure can be diagnosed without digging through runtime logs.
  let archiveStatus = null;
  let confirmStatus = null;

  // Same rule as the survey handlers: Beehiiv is a mailing list, not a datastore,
  // so keep an independent copy of every signup.
  async function archiveSignup(beehiivStatus) {
    const record = { submissionId, submittedAt, study: STUDY, email: address, source: source || 'homepage' };

    const archiveRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from:    'IronBenchmark Archive <info@ironbenchmark.com>',
        to:      [ARCHIVE_TO],
        subject: '[' + STUDY + '] ' + address + ' — ' + submissionId,
        html:
          '<div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;line-height:1.6;color:#1A2F3E;">' +
          '<p><strong>' + esc(address) + '</strong> · ' + esc(submittedAt) + '</p>' +
          '<p>Source: ' + esc(record.source) + '</p>' +
          '<p>Beehiiv: ' + esc(beehiivStatus) + '</p>' +
          '<pre style="background:#F5F3EF;padding:12px;border-radius:6px;white-space:pre-wrap;word-break:break-word;">' +
          '--- IRONBENCHMARK-JSON-START ---\n' + esc(JSON.stringify(record)) + '\n--- IRONBENCHMARK-JSON-END ---' +
          '</pre></div>',
      }),
    });

    archiveStatus = archiveRes.status;
    if (!archiveRes.ok) {
      console.error('Archive error:', submissionId, archiveRes.status, await archiveRes.text());
      return false;
    }
    return true;
  }

  let beehiivOk     = false;
  let beehiivStatus = 'not attempted';

  // ── 1. Add to Beehiiv ──────────────────────────────────────────────────────
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
          email:               address,
          reactivate_existing: false,
          send_welcome_email:  false,
          utm_source:          'ironbenchmark',
          utm_medium:          'homepage',
          utm_campaign:        'early-access',
          tags:                ['ironbenchmark-early-access'],
        }),
      }
    );

    beehiivOk     = beehiivRes.ok;
    beehiivStatus = beehiivRes.ok ? 'ok' : 'error ' + beehiivRes.status;
    if (!beehiivRes.ok) {
      const errBody = await beehiivRes.text();
      beehiivStatus = 'error ' + beehiivRes.status + ': ' + errBody.slice(0, 300);
      console.error('Beehiiv error:', submissionId, beehiivRes.status, errBody);
    }
  } catch (err) {
    beehiivStatus = 'exception: ' + err.message;
    console.error('Beehiiv exception:', submissionId, err);
  }

  // ── 2. Durable archive ─────────────────────────────────────────────────────
  let archiveOk = false;
  try {
    archiveOk = await archiveSignup(beehiivStatus);
  } catch (err) {
    console.error('Archive exception:', submissionId, err);
  }

  if (!beehiivOk && !archiveOk) {
    console.error('Signup lost:', submissionId, address, beehiivStatus);
    return res.status(500).json({ error: 'Could not record signup' });
  }

  // ── 3. Confirmation email — never fatal ───────────────────────────────────
  let confirmationSent = false;
  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from:    'IronBenchmark <info@ironbenchmark.com>',
        to:      [address],
        subject: "You're on the list — IronBenchmark 2026 reports",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1A2F3E; background: #F5F3EF;">

            <div style="margin-bottom: 28px;">
              <span style="font-size: 20px; font-weight: 700; color: #1A2F3E; letter-spacing: -0.02em;">Iron<span style="color: #C47B2E;">Benchmark</span></span>
            </div>

            <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 14px; line-height: 1.3;">You're on the list.</h1>

            <p style="color: #444; line-height: 1.7; margin: 0 0 20px; font-size: 15px;">
              We'll email you each IronBenchmark 2026 report the day it publishes — no newsletter, no vendor pitch, just the data.
            </p>

            <div style="background: #fff; border-left: 4px solid #C47B2E; padding: 16px 20px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
              <p style="margin: 0 0 8px; font-size: 14px; color: #C47B2E; font-weight: 600;">Want the reports earlier?</p>
              <p style="margin: 0; font-size: 13px; color: #444; line-height: 1.7;">
                Respondents receive each report before public release. All three studies are open now:
              </p>
              <ul style="margin: 8px 0 0; padding-left: 20px; font-size: 13px; color: #444; line-height: 1.9;">
                <li><a href="https://ironbenchmark.com/survey" style="color: #1A2F3E;">Heavy Equipment State of Marketing 2026</a></li>
                <li><a href="https://ironbenchmark.com/ai-sales" style="color: #1A2F3E;">AI in Heavy Equipment Sales: 2026 Benchmark</a></li>
                <li><a href="https://ironbenchmark.com/dealer-response" style="color: #1A2F3E;">The Dealer Response Report 2026</a> (dealers only)</li>
              </ul>
            </div>

            <hr style="border: none; border-top: 1px solid #DDD9D2; margin: 24px 0;" />
            <p style="font-size: 12px; color: #999; margin: 0; line-height: 1.6;">
              IronBenchmark · Independent research for the equipment industry — no sponsors<br>
              <a href="https://ironbenchmark.com" style="color: #1A2F3E;">ironbenchmark.com</a> · <a href="mailto:info@ironbenchmark.com" style="color: #1A2F3E;">info@ironbenchmark.com</a><br>
              You're receiving this because you asked to be notified when the IronBenchmark 2026 reports publish.
            </p>
          </div>
        `,
      }),
    });

    confirmationSent = resendRes.ok;
    confirmStatus = resendRes.status;
    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error('Resend error:', submissionId, resendRes.status, errBody);
    }
  } catch (err) {
    console.error('Resend exception:', submissionId, err);
  }

  return res.status(200).json({
    success: true, submissionId, confirmationSent,
    beehiivOk, archiveOk, archiveStatus, confirmStatus,
  });
}
