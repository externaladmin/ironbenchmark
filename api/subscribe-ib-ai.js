// Vercel Serverless Function: /api/subscribe-ib-ai
// Handles AI in Heavy Equipment Sales: 2026 Benchmark survey submission
// - Adds respondent to Beehiiv with tag "ironbenchmark-ai-2026-respondent"
// - Sends confirmation email via Resend
// - Stores all 13-question responses as custom fields for analysis

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

  const { email, study, responses } = req.body || {};

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const RESEND_API_KEY  = process.env.RESEND_API_KEY;
  const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY;
  const BEEHIIV_PUB_ID  = process.env.BEEHIIV_PUBLICATION_ID;

  if (!RESEND_API_KEY || !BEEHIIV_API_KEY || !BEEHIIV_PUB_ID) {
    console.error('Missing environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const r = responses || {};

  const STUDY        = 'ai-sales-2026';
  const ARCHIVE_TO   = process.env.ARCHIVE_EMAIL || 'info@ironbenchmark.com';
  const submissionId = STUDY + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  const submittedAt  = new Date().toISOString();

  // ── Bot filter ─────────────────────────────────────────────────────────────
  // The honeypot used to be checked in the browser only, which does nothing about a
  // script POSTing straight to this endpoint — the case that actually matters. These
  // run server-side, and a hit returns an ordinary success response while writing
  // nothing: a bot that is told it was blocked simply adapts.
  const hp        = typeof req.body?.hp === 'string' ? req.body.hp.trim() : '';
  const elapsedMs = Number(req.body?.elapsedMs) || 0;
  const clientIp  = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  const answered  = Object.values(r).filter((v) => typeof v === 'string' && v.trim()).length;

  const botReason =
      hp                                   ? 'honeypot filled'
    : (elapsedMs > 0 && elapsedMs < 15000) ? 'completed in ' + elapsedMs + 'ms'
    : (answered < 4)                       ? 'only ' + answered + ' answers'
    : rateLimited(clientIp)                ? 'rate limit'
    : null;

  if (botReason) {
    console.warn('Discarded submission:', submissionId, botReason, clientIp);
    return res.status(200).json({ success: true, submissionId, confirmationSent: false });
  }


  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  // Durable record of the raw submission.
  //
  // Beehiiv is a mailing list, not a datastore. When it rejects a write — bad key,
  // quota exhausted, an unrecognised custom field, a previously unsubscribed address
  // — the answers would otherwise survive only as a log line. This archive is sent
  // regardless of whether Beehiiv accepted the subscriber, and the handler reports
  // failure to the client only when BOTH have failed.
  // HTTP status of each Resend call, surfaced in the response so a delivery
  // failure can be diagnosed without digging through runtime logs.
  let archiveStatus = null;
  let confirmStatus = null;

  async function archiveSubmission(beehiivStatus) {
    const record = {
      submissionId,
      submittedAt,
      study: STUDY,
      email,
      responses: r,
    };

    const rows = Object.entries(record.responses).map(([k, v]) =>
      '<tr><td style="padding:4px 14px 4px 0;color:#6B7C88;vertical-align:top;white-space:nowrap;">' + esc(k) +
      '</td><td style="padding:4px 0;color:#1A2F3E;">' + esc(v) + '</td></tr>'
    ).join('');

    const archiveRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from:    'IronBenchmark Archive <info@ironbenchmark.com>',
        to:      [ARCHIVE_TO],
        subject: '[' + STUDY + '] ' + email + ' — ' + submissionId,
        html:
          '<div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;line-height:1.6;color:#1A2F3E;">' +
          '<p><strong>' + esc(email) + '</strong> · ' + esc(submittedAt) + '</p>' +
          '<p>Beehiiv: ' + esc(beehiivStatus) + '</p>' +
          '<table style="border-collapse:collapse;">' + rows + '</table>' +
          '<p style="margin-top:20px;color:#6B7C88;">Machine-readable copy below — parse between the markers to rebuild the dataset.</p>' +
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

  try {
    // ── 1. Add subscriber to Beehiiv with survey data ─────────────────────────
    const customFields = [
      ...(r.a1_org_type           ? [{ name: 'ibai_org_type',           value: r.a1_org_type }]           : []),
      ...(r.a2_role               ? [{ name: 'ibai_role',               value: r.a2_role }]               : []),
      ...(r.a3_sales_team_size    ? [{ name: 'ibai_sales_team_size',    value: r.a3_sales_team_size }]    : []),
      ...(r.b1_ai_uses            ? [{ name: 'ibai_ai_uses',            value: r.b1_ai_uses }]            : []),
      ...(r.b2_ai_tools           ? [{ name: 'ibai_ai_tools',           value: r.b2_ai_tools }]           : []),
      ...(r.b3_ai_impact          ? [{ name: 'ibai_ai_impact',          value: r.b3_ai_impact }]          : []),
      ...(r.b4_ai_best_area       ? [{ name: 'ibai_ai_best_area',       value: r.b4_ai_best_area }]       : []),
      ...(r.c1_barrier            ? [{ name: 'ibai_barrier',            value: r.c1_barrier }]            : []),
      ...(r.c2_competitor_position? [{ name: 'ibai_competitor_pos',     value: r.c2_competitor_position }]: []),
      ...(r.c3_confidence_driver  ? [{ name: 'ibai_confidence_driver',  value: r.c3_confidence_driver }]  : []),
      ...(r.d1_biggest_impact     ? [{ name: 'ibai_biggest_impact',     value: r.d1_biggest_impact }]     : []),
      ...(r.d2_future_outlook     ? [{ name: 'ibai_future_outlook',     value: r.d2_future_outlook }]     : []),
    ];

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
          utm_medium:          'survey',
          utm_campaign:        'ai-sales-2026',
          tags:                ['ironbenchmark-ai-2026-respondent'],
          custom_fields:       customFields,
        }),
      }
    );

    beehiivOk     = beehiivRes.ok;
    beehiivStatus = beehiivRes.ok ? 'ok' : 'error ' + beehiivRes.status;
    if (!beehiivRes.ok) {
      const errBody = await beehiivRes.text();
      beehiivStatus = 'error ' + beehiivRes.status + ': ' + errBody.slice(0, 300);
      console.error('Beehiiv error:', submissionId, beehiivRes.status, errBody);
      // Non-fatal — the archive below is the durable record of this response.
    }
  } catch (err) {
    beehiivStatus = 'exception: ' + err.message;
    console.error('Beehiiv exception:', submissionId, err);
  }

  // ── 2. Durable archive — runs whether or not Beehiiv accepted the write ────
  let archiveOk = false;
  try {
    archiveOk = await archiveSubmission(beehiivStatus);
  } catch (err) {
    console.error('Archive exception:', submissionId, err);
  }

  if (!beehiivOk && !archiveOk) {
    // Nothing captured the answers, so a client retry is the correct outcome.
    console.error('Submission lost:', submissionId, email, beehiivStatus);
    return res.status(500).json({ error: 'Could not record submission' });
  }

  // ── 3. Confirmation email via Resend — never fatal ────────────────────────
  //
  // This study accepts dealers, OEMs, rental, auction and marketplace respondents,
  // but The Dealer Response Report is dealers-only — offering it to a rental or
  // auction respondent sends them to a survey that screens them out. Gate on the
  // org type they gave in A1 and let the heading count what is actually listed.
  const IS_DEALER = /^Equipment dealer/.test(r.a1_org_type || '');

  const SOM_STUDY = '<li style="margin-bottom:6px;"><a href="https://ironbenchmark.com/survey" style="color:#1A2F3E;">Heavy Equipment State of Marketing 2026</a> — budget allocation, channel ROI, and digital maturity across dealers, OEMs and agencies.</li>';
  const DR_STUDY  = '<li style="margin-bottom:6px;"><a href="https://ironbenchmark.com/dealer-response" style="color:#1A2F3E;">The Dealer Response Report 2026</a> — how dealers manage customer communications across every channel and the downstream impact on deals.</li>';
  const OTHER_STUDIES = IS_DEALER ? [SOM_STUDY, DR_STUDY] : [SOM_STUDY];
  const STUDIES_HEADING = OTHER_STUDIES.length > 1
    ? 'IronBenchmark has two other open studies — both free for respondents:'
    : 'IronBenchmark has one other open study — free for respondents:';

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
        to:      [email],
        subject: "Confirmed — AI in Heavy Equipment Sales: 2026 Benchmark",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1A2F3E; background: #F5F3EF;">

            <div style="margin-bottom: 28px;">
              <span style="font-size: 20px; font-weight: 700; color: #1A2F3E; letter-spacing: -0.02em;">Iron<span style="color: #C47B2E;">Benchmark</span></span>
            </div>

            <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 14px; line-height: 1.3;">Thank you — the report is coming your way.</h1>

            <p style="color: #444; line-height: 1.7; margin: 0 0 20px; font-size: 15px;">
              As a contributor to the <strong>AI in Heavy Equipment Sales: 2026 Benchmark</strong>, you'll receive the full findings before public release — delivered to your inbox when it publishes.
            </p>

            <p style="color: #444; line-height: 1.7; margin: 0 0 24px; font-size: 15px;">
              This is the first benchmark on AI adoption in construction, agricultural, and industrial equipment sales — real data on what tools are in use, where adoption stalls, and how confident practitioners are about their position versus competitors.
            </p>

            <div style="background: #fff; border-left: 4px solid #C47B2E; padding: 16px 20px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
              <p style="margin: 0; font-size: 14px; color: #C47B2E; font-weight: 600;">What's in the report</p>
              <ul style="margin: 8px 0 0; padding-left: 20px; font-size: 13px; color: #444; line-height: 1.7;">
                <li>AI tool adoption rates — what's actually in use across the industry</li>
                <li>Top use cases — where AI is delivering vs. where it's falling flat</li>
                <li>The barriers — what's slowing adoption in equipment sales</li>
                <li>The competitor confidence gap — how salespeople assess their position</li>
                <li>Where the industry is headed — ranked by practitioners</li>
              </ul>
            </div>

            <div style="background: #EEF3F7; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
              <p style="margin: 0; font-size: 13px; color: #6B7C88; line-height: 1.5;">
                🔒 <strong style="color: #1A2F3E;">Your data is private.</strong> No individual responses are shared or used for sales targeting. All findings are anonymized and aggregated.
              </p>
            </div>

            <p style="color: #444; line-height: 1.7; margin: 0 0 16px; font-size: 14px;">
              ${STUDIES_HEADING}
            </p>
            <ul style="font-size: 14px; color: #444; line-height: 1.9; padding-left: 20px; margin: 0 0 24px;">
              ${OTHER_STUDIES.join('')}
            </ul>

            <hr style="border: none; border-top: 1px solid #DDD9D2; margin: 24px 0;" />
            <p style="font-size: 12px; color: #999; margin: 0; line-height: 1.6;">
              IronBenchmark · Independent research for the equipment industry — no sponsors<br>
              <a href="https://ironbenchmark.com" style="color: #1A2F3E;">ironbenchmark.com</a> · <a href="mailto:info@ironbenchmark.com" style="color: #1A2F3E;">info@ironbenchmark.com</a><br>
              You're receiving this because you completed the AI in Heavy Equipment Sales: 2026 Benchmark survey.
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
      // The response is already recorded. Failing here would make the client retry
      // and write a second Beehiiv subscriber for the same person, so report success
      // and flag the missing confirmation instead.
    }
  } catch (err) {
    console.error('Resend exception:', submissionId, err);
  }

  return res.status(200).json({
    success: true, submissionId, confirmationSent,
    beehiivOk, archiveOk, archiveStatus, confirmStatus,
  });
}
