// Vercel Serverless Function: /api/subscribe-ib
// Handles IronBenchmark survey submission
// - Adds respondent to Beehiiv with tag "ironbenchmark-2026-respondent"
// - Sends confirmation email via Resend
// - Stores all 15-question responses as custom fields for analysis

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, region, responses } = req.body;

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
      ...(region                    ? [{ name: 'ib_region',              value: region }]                      : []),
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
      ...(r.q13_performance         ? [{ name: 'ib_performance',         value: r.q13_performance }]           : []),
      ...(r.q14_maturity            ? [{ name: 'ib_maturity',            value: r.q14_maturity }]              : []),
      ...(r.q15_crm_usage           ? [{ name: 'ib_crm_usage',           value: r.q15_crm_usage }]             : []),
      ...(r.q16_lead_response       ? [{ name: 'ib_lead_response',       value: r.q16_lead_response }]         : []),
      ...(r.q17_buyer_visibility    ? [{ name: 'ib_buyer_visibility',    value: r.q17_buyer_visibility }]      : []),
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
          utm_campaign:        'ironbenchmark-2026',
          tags:                ['ironbenchmark-2026-respondent'],
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
        from:    'IronBenchmark <hello@ironbenchmark.com>',
        to:      [email],
        subject: "You're in — 2026 IronBenchmark Report",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1A2F3E; background: #F5F3EF;">

            <div style="margin-bottom: 28px;">
              <span style="font-size: 20px; font-weight: 700; color: #1A2F3E; letter-spacing: -0.02em;">Iron<span style="color: #C47B2E;">Benchmark</span></span>
            </div>

            <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 14px; line-height: 1.3;">You're in. The report is coming your way.</h1>

            <p style="color: #444; line-height: 1.7; margin: 0 0 20px; font-size: 15px;">
              As a contributor to the 2026 IronBenchmark Report, you'll receive the full findings before public release — delivered to your inbox within 60 days of survey close.
            </p>

            <p style="color: #444; line-height: 1.7; margin: 0 0 24px; font-size: 15px;">
              The report covers budget allocation benchmarks, channel ROI rankings, trade show spend analysis, and digital maturity across the industry — data from real practitioners, not analysts.
            </p>

            <div style="background: #fff; border-left: 4px solid #C47B2E; padding: 16px 20px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
              <p style="margin: 0; font-size: 14px; color: #C47B2E; font-weight: 600;">What's in the report</p>
              <ul style="margin: 8px 0 0; padding-left: 20px; font-size: 13px; color: #444; line-height: 1.7;">
                <li>Channel budget allocation — how your peers are spending</li>
                <li>Best ROI by channel — ranked by respondents</li>
                <li>Trade show cost modeling — what a presence actually costs</li>
                <li>Digital adoption benchmarks — where the industry actually is</li>
                <li>Team structure — in-house vs. agency across company sizes</li>
              </ul>
            </div>

            <div style="background: #EEF3F7; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
              <p style="margin: 0; font-size: 13px; color: #6B7C88; line-height: 1.5;">
                🔒 <strong style="color: #1A2F3E;">Your data is private.</strong> No individual responses are shared or used for sales targeting. All findings are anonymized and aggregated.
              </p>
            </div>

            <p style="color: #444; line-height: 1.7; margin: 0 0 24px; font-size: 14px;">
              Know another dealer or OEM marketing leader who'd benefit from early access? Forward them the survey — the more practitioners who contribute, the stronger the data for everyone.
            </p>

            <hr style="border: none; border-top: 1px solid #DDD9D2; margin: 24px 0;" />
            <p style="font-size: 12px; color: #999; margin: 0; line-height: 1.6;">
              IronBenchmark · Independent research for heavy equipment marketing leaders<br>
              <a href="https://ironbenchmark.com" style="color: #1A2F3E;">ironbenchmark.com</a> · <a href="mailto:contact@ironbenchmark.com" style="color: #1A2F3E;">contact@ironbenchmark.com</a><br>
              You're receiving this because you completed the 2026 IronBenchmark survey.
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
