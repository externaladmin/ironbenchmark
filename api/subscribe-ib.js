// Vercel Serverless Function: /api/subscribe-ib
// Handles IronBenchmark survey submission
// - Adds respondent to Beehiiv with tag "ironbenchmark-2026-respondent"
// - Sends confirmation email via Resend
// - Stores all 15-question responses as custom fields for analysis

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

  const { email: rawEmail, region, responses } = req.body || {};

  // Same rule the browser applies, enforced here too — the browser checks are a
  // convenience and a direct POST never runs them. Normalising once means every
  // downstream use (Beehiiv, Resend, the archive) gets the same address.
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
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

  const STUDY        = 'state-of-marketing-2026';
  const BEEHIIV_TAGS = ['ironbenchmark-2026-respondent'];
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
      region: region || '',
      responses: r,
    };

    const rows = Object.entries(record.responses).map(([k, v]) =>
      '<tr><td style="padding:4px 14px 4px 0;color:#5A7060;vertical-align:top;white-space:nowrap;">' + esc(k) +
      '</td><td style="padding:4px 0;color:#1C3A2A;">' + esc(v) + '</td></tr>'
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
          '<div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;line-height:1.6;color:#1C3A2A;">' +
          '<p><strong>' + esc(email) + '</strong> · ' + esc(submittedAt) + '</p>' +
          '<p>Beehiiv: ' + esc(beehiivStatus) + '</p>' +
          '<table style="border-collapse:collapse;">' + rows + '</table>' +
          '<p style="margin-top:20px;color:#5A7060;">Machine-readable copy below — parse between the markers to rebuild the dataset.</p>' +
          '<pre style="background:#F6F4EE;padding:12px;border-radius:6px;white-space:pre-wrap;word-break:break-word;">' +
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
  let tagsOk        = false;

  try {
    // ── 1. Add subscriber to Beehiiv with survey data ─────────────────────────
    const customFields = [
      ...(region                    ? [{ name: 'ib_region',              value: region }]                      : []),
      ...(r.org_type                ? [{ name: 'ib_org_type',            value: r.org_type }]                  : []),
      ...(r.q1_role                 ? [{ name: 'ib_role',                value: r.q1_role }]                   : []),
      ...(r.q2_locations            ? [{ name: 'ib_locations',           value: r.q2_locations }]              : []),
      ...(r.q3_budget               ? [{ name: 'ib_budget',              value: r.q3_budget }]                 : []),
      ...(r.q4_team_size            ? [{ name: 'ib_team_size',           value: r.q4_team_size }]              : []),
      ...(r.q5_structure            ? [{ name: 'ib_structure',           value: r.q5_structure }]              : []),
      ...(r.q6_brand_lines          ? [{ name: 'ib_brand_lines',         value: r.q6_brand_lines }]            : []),
      ...(r.q7_channels             ? [{ name: 'ib_channels',            value: r.q7_channels }]               : []),
      ...(r.q8_largest_channel      ? [{ name: 'ib_largest_channel',     value: r.q8_largest_channel }]        : []),
      ...(r.q9_increase_spend       ? [{ name: 'ib_increase_spend',      value: r.q9_increase_spend }]         : []),
      ...(r.q10_best_roi            ? [{ name: 'ib_best_roi',            value: r.q10_best_roi }]              : []),
      ...(r.q11_cost_per_lead       ? [{ name: 'ib_cost_per_lead',       value: r.q11_cost_per_lead }]         : []),
      ...(r.q12_challenge           ? [{ name: 'ib_challenge',           value: r.q12_challenge }]             : []),
      ...(r.q12b_client_ask         ? [{ name: 'ib_client_ask',         value: r.q12b_client_ask }]           : []),
      ...(r.q13_performance         ? [{ name: 'ib_performance',         value: r.q13_performance }]           : []),
      ...(r.q14_maturity            ? [{ name: 'ib_maturity',            value: r.q14_maturity }]              : []),
      ...(r.q15_crm_usage           ? [{ name: 'ib_crm_usage',           value: r.q15_crm_usage }]             : []),
      ...(r.q16_lead_response       ? [{ name: 'ib_lead_response',       value: r.q16_lead_response }]         : []),
      ...(r.q17_buyer_visibility    ? [{ name: 'ib_buyer_visibility',    value: r.q17_buyer_visibility }]      : []),
      // Flips the flag /api/partial sets, so the abandonment segment in Beehiiv
      // drops anyone who came back and finished.
      { name: 'ib_completed', value: 'yes' },
    ];

    const beehiivRes = await fetch(
      `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUB_ID}/subscriptions?expand[]=tags`,
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
          utm_campaign:        'ironbenchmark-2026',
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
    } else {
      // The create endpoint does not accept tags — passing them there had them
      // silently discarded, so no subscriber was ever tagged. They need their
      // own call against the id the create returns.
      let created = null;
      try { created = await beehiivRes.json(); } catch (e) { /* body already consumed or empty */ }

      // The same endpoint drops custom fields that do not exist on the
      // publication, and only says so in a warning nobody was reading.
      const warnings = created?.data?.warnings || created?.warnings;
      if (warnings && warnings.length) {
        console.warn('Beehiiv warnings:', submissionId, JSON.stringify(warnings));
      }

      const existingTags = (created?.data?.tags || [])
        .map((t) => (typeof t === 'string' ? t : t?.name))
        .filter(Boolean);

      const subId = created?.data?.id;
      if (!subId) {
        console.error('Beehiiv: no subscription id returned', submissionId);
      } else {
        try {
          const tagRes = await fetch(
            `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUB_ID}/subscriptions/${subId}/tags`,
            {
              method:  'POST',
              headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${BEEHIIV_API_KEY}`,
              },
              // The tags endpoint replaces the set rather than adding to it, so a
              // completion would otherwise wipe the partial tag — and any other
              // tag the subscriber already carried. Post the union instead.
              body: JSON.stringify({ tags: [...new Set([...existingTags, ...BEEHIIV_TAGS])] }),
            }
          );
          tagsOk = tagRes.ok;
          if (!tagRes.ok) {
            console.error('Beehiiv tag error:', submissionId, tagRes.status, await tagRes.text());
          }
        } catch (err) {
          console.error('Beehiiv tag exception:', submissionId, err);
        }
      }
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
  // This study has three audiences (dealer / OEM / agency), so the parts of the
  // email that address the reader are chosen from org_type. A single generic line
  // necessarily talks past two thirds of respondents.
  const ORG = ['dealer', 'oem', 'agency'].includes(r.org_type) ? r.org_type : 'dealer';

  const FORWARD_LINE = {
    dealer: 'Know another dealer marketing leader who\'d benefit from early access? Forward them the survey — the more practitioners who contribute, the stronger the data for everyone.',
    oem:    'Know another OEM marketing leader — or a dealer in your network — who\'d benefit from early access? Forward them the survey — the more practitioners who contribute, the stronger the data for everyone.',
    agency: 'Know another agency lead working equipment accounts, or a dealer or OEM client who\'d benefit? Forward them the survey — the more practitioners who contribute, the stronger the data for everyone.',
  }[ORG];

  // The Dealer Response study is dealers-only, so it is offered to dealers alone
  // and the heading counts whatever actually gets listed.
  const AI_STUDY = '<li style="margin-bottom:6px;"><a href="https://ironbenchmark.com/ai-sales" style="color:#1C3A2A;">AI in Heavy Equipment Sales: 2026 Benchmark</a> — the first benchmark on AI adoption in equipment sales. Tool usage, barriers, and the competitor confidence gap.</li>';
  const DR_STUDY = '<li style="margin-bottom:6px;"><a href="https://ironbenchmark.com/dealer-response" style="color:#1C3A2A;">The Dealer Response Report 2026</a> — how dealers manage customer communications across every channel, and the downstream impact on deals and reputation.</li>';
  const OTHER_STUDIES = ORG === 'dealer' ? [DR_STUDY, AI_STUDY] : [AI_STUDY];
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
        subject: "Confirmed — Heavy Equipment State of Marketing 2026",
        html: `
          <div style="font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1C3A2A; background: #F6F4EE;">

            <div style="margin-bottom: 28px;">
              <span style="font-family: 'DM Serif Display', Georgia, 'Times New Roman', serif; font-size: 24px; color: #1C3A2A; letter-spacing: -0.02em;">Iron<span style="color: #C9A84C;">Benchmark</span></span>
            </div>

            <h1 style="font-family: 'DM Serif Display', Georgia, 'Times New Roman', serif; font-size: 26px; font-weight: 400; color: #1C3A2A; margin: 0 0 14px; line-height: 1.25;">Thank you — the report is coming your way.</h1>

            <p style="color: #444; line-height: 1.7; margin: 0 0 20px; font-size: 15px;">
              As a contributor to <strong>Heavy Equipment State of Marketing 2026</strong>, you'll receive the full findings ahead of release — delivered to your inbox when it publishes.
            </p>

            <p style="color: #444; line-height: 1.7; margin: 0 0 24px; font-size: 15px;">
              The report covers budget allocation benchmarks, channel ROI rankings, trade show spend analysis, and digital maturity across the industry — data from real practitioners, not analysts.
            </p>

            <div style="background: #fff; border-left: 4px solid #C9A84C; padding: 16px 20px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
              <p style="margin: 0; font-size: 14px; color: #C9A84C; font-weight: 600;">What's in the report</p>
              <ul style="margin: 8px 0 0; padding-left: 20px; font-size: 13px; color: #444; line-height: 1.7;">
                <li>Channel budget allocation — how your peers are spending</li>
                <li>Best ROI by channel — ranked by respondents</li>
                <li>Trade show cost modeling — what a presence actually costs</li>
                <li>Digital adoption benchmarks — where the industry actually is</li>
                <li>Team structure — in-house vs. agency across company sizes</li>
              </ul>
            </div>


            <p style="color: #444; line-height: 1.7; margin: 0 0 24px; font-size: 14px;">
              ${FORWARD_LINE}
            </p>

            <p style="color: #444; line-height: 1.7; margin: 0 0 12px; font-size: 14px;">
              ${STUDIES_HEADING}
            </p>
            <ul style="font-size: 14px; color: #444; line-height: 1.7; padding-left: 20px; margin: 0 0 24px;">
              ${OTHER_STUDIES.join('')}
            </ul>

            <p style="font-size: 13px; color: #5A7060; line-height: 1.6; margin: 0 0 20px;">
              We also share other IronBenchmark research and industry insights from time to time. You can opt out of those whenever you like — there's an unsubscribe link in every one.
            </p>

            <hr style="border: none; border-top: 1px solid #D8D5C8; margin: 24px 0;" />
            <p style="font-size: 12px; color: #5A7060; margin: 0; line-height: 1.6;">
              IronBenchmark · Independent research for the equipment industry — no sponsors<br>
              <a href="https://ironbenchmark.com" style="color: #1C3A2A;">ironbenchmark.com</a> · <a href="mailto:info@ironbenchmark.com" style="color: #1C3A2A;">info@ironbenchmark.com</a><br>
              You're receiving this because you completed the Heavy Equipment State of Marketing 2026 survey.
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
    beehiivOk, tagsOk, archiveOk, archiveStatus, confirmStatus,
  });
}
