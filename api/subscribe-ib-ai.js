// Vercel Serverless Function: /api/subscribe-ib-ai
// Handles AI in Heavy Equipment Sales: 2026 Benchmark survey submission
// - Adds respondent to Beehiiv with tag "ironbenchmark-ai-2026-respondent"
// - Sends confirmation email via Resend
// - Stores all 13-question responses as custom fields for analysis

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
        subject: "You're in — AI in Heavy Equipment Sales: 2026 Benchmark",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1A2F3E; background: #F5F3EF;">

            <div style="margin-bottom: 28px;">
              <span style="font-size: 20px; font-weight: 700; color: #1A2F3E; letter-spacing: -0.02em;">Iron<span style="color: #C47B2E;">Benchmark</span></span>
            </div>

            <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 14px; line-height: 1.3;">You're in. The report is coming your way.</h1>

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
              IronBenchmark has two other open studies — both free for respondents:
            </p>
            <ul style="font-size: 14px; color: #444; line-height: 1.9; padding-left: 20px; margin: 0 0 24px;">
              <li><a href="https://ironbenchmark.com/survey" style="color: #1A2F3E;">Heavy Equipment State of Marketing 2026</a> — budget allocation, channel ROI, and digital maturity for dealer and OEM marketing leaders.</li>
              <li><a href="https://ironbenchmark.com/dealer-response" style="color: #1A2F3E;">The Dealer Response Report 2026</a> — how dealers manage customer communications across every channel and the downstream impact on deals. (Dealers only.)</li>
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
