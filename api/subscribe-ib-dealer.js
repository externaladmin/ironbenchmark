// Vercel Serverless Function: /api/subscribe-ib-dealer
// Handles The Dealer Response Report 2026 survey submission
// - Adds respondent to Beehiiv with tag "ironbenchmark-dealer-response-2026-respondent"
// - Sends confirmation email via Resend
// - Stores all 16-question responses as custom fields for analysis

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, study, responses } = req.body;

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

  try {
    // ── 1. Add subscriber to Beehiiv with survey data ─────────────────────────
    const customFields = [
      ...(r.q1_role              ? [{ name: 'ibdr_role',              value: r.q1_role }]              : []),
      ...(r.q2_locations         ? [{ name: 'ibdr_locations',         value: r.q2_locations }]         : []),
      ...(r.q3_brand_lines       ? [{ name: 'ibdr_brand_lines',       value: r.q3_brand_lines }]       : []),
      ...(r.q4_website           ? [{ name: 'ibdr_website',           value: r.q4_website }]           : []),
      ...(r.q5_channels          ? [{ name: 'ibdr_channels',          value: r.q5_channels }]          : []),
      ...(r.q6_primary_channel   ? [{ name: 'ibdr_primary_channel',   value: r.q6_primary_channel }]   : []),
      ...(r.q7_volume_visibility ? [{ name: 'ibdr_volume_visibility', value: r.q7_volume_visibility }] : []),
      ...(r.q8_response_owner    ? [{ name: 'ibdr_response_owner',    value: r.q8_response_owner }]    : []),
      ...(r.q9_response_speed    ? [{ name: 'ibdr_response_speed',    value: r.q9_response_speed }]    : []),
      ...(r.q10_salesperson_leaving ? [{ name: 'ibdr_salesperson_leaving', value: r.q10_salesperson_leaving }] : []),
      ...(r.q11_quote_followup   ? [{ name: 'ibdr_quote_followup',    value: r.q11_quote_followup }]   : []),
      ...(r.q12_hardest_challenge? [{ name: 'ibdr_hardest_challenge', value: r.q12_hardest_challenge }]: []),
      ...(r.q13_lost_deal        ? [{ name: 'ibdr_lost_deal',         value: r.q13_lost_deal }]        : []),
      ...(r.q14_google_rating    ? [{ name: 'ibdr_google_rating',     value: r.q14_google_rating }]    : []),
      ...(r.q15_review_monitoring? [{ name: 'ibdr_review_monitoring', value: r.q15_review_monitoring }]: []),
      ...(r.q16_review_asking    ? [{ name: 'ibdr_review_asking',     value: r.q16_review_asking }]    : []),
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
          utm_campaign:        'dealer-response-2026',
          tags:                ['ironbenchmark-dealer-response-2026-respondent'],
          custom_fields:       customFields,
        }),
      }
    );

    if (!beehiivRes.ok) {
      const errBody = await beehiivRes.text();
      console.error('Beehiiv error:', beehiivRes.status, errBody);
      // Non-fatal — continue to send confirmation email
    }

    // ── 2. Send confirmation email via Resend ────────────────────────────────
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from:    'IronBenchmark <info@ironbenchmark.com>',
        to:      [email],
        subject: "You're in — The Dealer Response Report 2026",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1A2F3E; background: #F5F3EF;">

            <div style="margin-bottom: 28px;">
              <span style="font-size: 20px; font-weight: 700; color: #1A2F3E; letter-spacing: -0.02em;">Iron<span style="color: #C47B2E;">Benchmark</span></span>
            </div>

            <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 14px; line-height: 1.3;">You're in. The report is coming your way.</h1>

            <p style="color: #444; line-height: 1.7; margin: 0 0 20px; font-size: 15px;">
              As a contributor to <strong>The Dealer Response Report 2026</strong>, you'll receive the full findings before public release — delivered to your inbox when it publishes.
            </p>

            <p style="color: #444; line-height: 1.7; margin: 0 0 24px; font-size: 15px;">
              This is the first benchmark on how equipment dealers manage customer communications — across phone, email, web forms, live chat, text, WhatsApp, and social — and how response practices connect to deals won and reputation earned.
            </p>

            <div style="background: #fff; border-left: 4px solid #C47B2E; padding: 16px 20px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
              <p style="margin: 0; font-size: 14px; color: #C47B2E; font-weight: 600;">What's in the report</p>
              <ul style="margin: 8px 0 0; padding-left: 20px; font-size: 13px; color: #444; line-height: 1.7;">
                <li>Channel coverage — which dealers are active on which channels</li>
                <li>Response speed benchmarks — average first-response times by channel</li>
                <li>Who owns the lead — how dealers assign and manage incoming inquiries</li>
                <li>Follow-up behavior — what happens after a quote goes out</li>
                <li>Reputation management — how dealers monitor and generate reviews</li>
              </ul>
            </div>

            <div style="background: #EEF3F7; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
              <p style="margin: 0; font-size: 13px; color: #6B7C88; line-height: 1.5;">
                🔒 <strong style="color: #1A2F3E;">Your data is private.</strong> No individual responses are shared or used for sales targeting. All findings are anonymized and aggregated.
              </p>
            </div>

            <p style="color: #444; line-height: 1.7; margin: 0 0 16px; font-size: 14px;">
              IronBenchmark has two other open studies — both free for respondents:
            </p>
            <ul style="font-size: 14px; color: #444; line-height: 1.9; padding-left: 20px; margin: 0 0 24px;">
              <li><a href="https://ironbenchmark.com/survey" style="color: #1A2F3E;">Heavy Equipment State of Marketing 2026</a> — budget allocation, channel ROI, and digital maturity for dealer and OEM marketing leaders.</li>
              <li><a href="https://ironbenchmark.com/ai-sales" style="color: #1A2F3E;">AI in Heavy Equipment Sales: 2026 Benchmark</a> — the first benchmark on AI adoption in equipment sales. Tool usage, barriers, and the competitor confidence gap.</li>
            </ul>

            <hr style="border: none; border-top: 1px solid #DDD9D2; margin: 24px 0;" />
            <p style="font-size: 12px; color: #999; margin: 0; line-height: 1.6;">
              IronBenchmark · Independent research for the equipment industry — no sponsors<br>
              <a href="https://ironbenchmark.com" style="color: #1A2F3E;">ironbenchmark.com</a> · <a href="mailto:info@ironbenchmark.com" style="color: #1A2F3E;">info@ironbenchmark.com</a><br>
              You're receiving this because you completed The Dealer Response Report 2026 survey.
            </p>
          </div>
        `,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error('Resend error:', resendRes.status, errBody);
      return res.status(500).json({ error: 'Failed to send confirmation email' });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Unexpected error:', err);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
}
