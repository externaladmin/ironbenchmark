# IronBenchmark.com — Master Plan
*Heavy Equipment Dealer & OEM Marketing Intelligence · April 2026*

---

## The One-Line Brief

Build the first annual benchmark report for heavy equipment dealer and OEM marketing leaders — combining publicly available data with a short practitioner survey — positioned as a credible research publication, hosted on its own branded domain, and used to build a list of 500+ qualified marketing decision-makers.

**This is not a SaaS product. It is a research brand that earns trust before selling anything.**

---

## Model: Claude — Which Version and Why

Token efficiency matters here. This project involves three types of AI work, each with a different cost/quality tradeoff:

| Task | Best Model | Why |
|---|---|---|
| Web research sweeps (scraping, summarizing public data) | **claude-haiku-4-5** | Fast, cheap, good enough for data extraction. ~10x cheaper than Sonnet per token. |
| Survey instrument + report writing (quality matters) | **claude-sonnet-4-6** | Best quality-to-cost ratio for long-form writing. Use only for final drafts. |
| Data analysis + synthesis (tables, inferences, comparisons) | **claude-haiku-4-5** | Structured outputs are well within Haiku's capability. Save Sonnet for prose. |
| Anything you paste into Cowork manually | **claude-sonnet-4-6** | Default for interactive sessions — quality is worth it for your direct work. |

**Practical rule:** All scheduled/automated research tasks use Haiku. Everything you review and ship uses Sonnet for final polish only.

**Estimated token cost for this entire project:** Under $2.00 total if automated tasks use Haiku throughout. The report itself (final Sonnet pass) adds maybe $0.15.

---

## Part 1: Brand & Domain

**Name:** IronBenchmark.com
— "Iron" is the industry's own word for heavy equipment. "Benchmark" signals exactly what the product is and makes every title self-explanatory: *The 2026 IronBenchmark Report.*

**Check domain availability:** ironbenchmark.com (~$12/yr on Cloudflare Registrar)
**Fallback options:** ironbenchmark.co · dealerbenchmark.com · equipmentmarketer.com

**Visual identity:**
- Background: `#F5F3EF` (warm off-white — research/print feel)
- Primary: `#1A2F3E` (dark navy — authority)
- Accent: `#C47B2E` (iron/bronze — industry texture)
- Fonts: DM Serif Display (headlines) + DM Sans (body) — same stack as dealer.html, signals quality
- Aesthetic: clean research house — think McKinsey one-pager meets trade publication, not startup landing page

**The website is one page at launch.** No blog, no nav, no product features. Just:
1. Report cover mockup (designed — not a screenshot)
2. Two-sentence description of what the report covers
3. Live respondent counter: *"214 dealer and OEM marketing leaders have already responded"*
4. "Take the 5-minute survey" CTA → Tally form
5. "Already responded? Get early access" email field → Beehiiv
6. Methodology note (2 sentences)
7. Footer: "Presented by [Your Company Name]" — tasteful, not a pitch

---

## Part 2: The Survey Instrument

**Platform: Custom HTML (`ironbenchmark_survey.html`)** — built and owned entirely by us. Self-hosted on Vercel alongside ironbenchmark_website.html. Responses POST to `/api/subscribe-ib` (Vercel serverless function), which adds respondents to Beehiiv with all 15-question answers stored as custom fields, and fires a confirmation email via Resend. No third-party form platform needed — no Tally, no Typeform, no per-response fees, and full control over design and data.

**Length: 15 questions. Target completion time: 5 minutes.**

The golden rule of B2B surveys: every question must be one they'd want the answer to from their peers. If a question doesn't make them think "I'd love to know what everyone else said about this," cut it.

---

### The 15 Questions

**Section A — Context (5 questions, 75 seconds)**

1. *What best describes your role?*
   - Dealer marketing manager / director
   - OEM marketing manager / director
   - Dealer principal or GM with marketing oversight
   - Marketing agency serving equipment dealers
   - Other

2. *How many locations does your dealership or company operate?*
   - 1–2 locations
   - 3–10 locations
   - 11–25 locations
   - 26+ locations / national

3. *What is your approximate annual marketing budget (all channels)?*
   - Under $50K
   - $50K–$150K
   - $150K–$500K
   - $500K–$1M
   - Over $1M

4. *How many people (FTE or equivalent) work on marketing at your company?*
   - Just me
   - 2–3 people
   - 4–10 people
   - More than 10

5. *How is your marketing function structured?*
   - Entirely in-house
   - Primarily in-house, some agency support
   - Mix of in-house and agency
   - Primarily agency, small in-house team
   - Just me — no agency

**Section B — Channel Spend (4 questions, 90 seconds)**

6. *Which channels are you actively investing in right now? (select all that apply)*
   - Trade shows and events
   - Google Search Ads
   - Google Display / YouTube
   - LinkedIn Ads
   - Facebook / Instagram Ads
   - Trade publication advertising (print or digital)
   - Email marketing to your own list
   - SEO / content marketing
   - None currently

7. *For the channels you selected above — which represents your largest single budget allocation?*
   — Single select from channels selected in Q6 (or "Even split across channels")

8. *Roughly what share of your total marketing budget goes to trade shows and events?*
   - Less than 10%
   - 10–25%
   - 26–40%
   - 41–60%
   - More than 60%
   - I'm not sure / we don't track this

   > *Why these three replace sliders:* Asking respondents to allocate precise percentages across channels that must total 100% is a well-documented survey drop-off point. This multi-select + single-largest approach captures the same actionable intelligence — which channels are used, which dominates the budget — without the UX friction. The trade show share is isolated because it's the most strategically interesting finding and warrants its own question.

9. *Which digital channels are you actively investing in right now? (select all)*
   - Google Search Ads
   - Google Display / YouTube
   - LinkedIn Ads
   - Facebook / Instagram Ads
   - Email marketing
   - SEO / content
   - None currently

**Section C — Performance & Pain (5 questions, 105 seconds)**

10. *Which single channel delivered your best ROI in the last 12 months? (pick one)*
    - Trade shows / events
    - Google Search Ads
    - LinkedIn Ads
    - Facebook / Instagram Ads
    - Trade publication advertising
    - Email marketing
    - SEO / content / word of mouth
    - I don't track ROI by channel

11. *What's your estimated cost-per-qualified-lead from your best-performing channel?*
    - Under $50
    - $50–$200
    - $200–$500
    - $500–$1,500
    - Over $1,500
    - I don't track this

12. *What's your single biggest marketing challenge right now? (pick one)*
    - Generating enough quality leads
    - Justifying marketing ROI to leadership
    - Keeping up with digital / knowing what works
    - Differentiating from competitors in my region
    - Retaining customers / repeat business
    - Finding and keeping good marketing staff

13. *In the next 12 months, where are you planning to increase spending?*
    — Same channel list as Q9, multi-select

14. *Looking at your marketing results over the last 12 months — how would you describe your overall performance?*
    - Strong — we hit our lead and revenue goals
    - Mixed — some channels worked well, others didn't
    - Disappointing — we underperformed vs. expectations
    - Hard to say — we don't have clear metrics to evaluate

   > *Why Q14 was changed:* The original "how confident are you in your mix" framing reads as a soft anxiety trigger — a savvy marketing director will recognize it as a lead-gen setup question, which can undermine trust in the research brand. This replacement asks for a genuine self-assessment of results, which produces equally usable data (the "mixed/disappointing + no metrics" cluster is a strong finding) without feeling manipulative. If the confidence gap is central to your report narrative, make it an output finding derived from Q14 + Q10 combined — not a direct question.

**Section D — Access (1 question, 30 seconds)**

15. *Enter your email to receive the full 2026 IronBenchmark Report when published (free, before public release).*
    — Email field, required to submit
    — Optional: *"What state or region are you in?"* (for segmentation)

---

**Why this instrument works:**

Questions 6–9 give them peer spending benchmarks — the #1 thing they can't get anywhere else. Question 10 (best ROI channel) produces the most quotable, shareable finding in the entire report. Questions 4–5 (team size and structure) answer the "am I normal?" anxiety every marketing leader has. Question 12 validates their professional reality. Question 14 creates mild productive anxiety ("only X% of respondents said they're confident their mix is optimized"). The email isn't a gate — it's the delivery mechanism for something they genuinely want, framed as early access before public release.

---

## Part 3: Public Data Research (Sections 1–3 of the Report)

This is what makes IronBenchmark feel like a real research firm, not a survey. You publish real data from public sources before a single survey response comes in.

### Data Sources and Research Tasks

**Research Task 1: Trade Publication Rate Cards**

Sources:
- equipmentworld.com/advertise
- constructionequipmentguide.com/advertise
- forconstructionpros.com/advertise
- roadsandbridges.com/advertise
- dieselprogress.com/advertise

Collect: full-page print rate, digital banner CPM, newsletter placement rate, sponsored content rate. Build a comparison table. This becomes: *"What does trade media actually cost? A rate card comparison across the top 5 heavy equipment publications."*

**Research Task 2: Trade Show Floor & Booth Cost Modeling**

Sources:
- CONEXPO-CON/AGG 2026 exhibitor prospectus (conexpoconagg.com) — booth rate per sq ft, public
- AED Summit 2026 exhibitor kit (aednet.org) — booth pricing, public
- ICUEE 2025 exhibitor prospectus — public
- Cross-reference with public exhibitor lists to map company → booth size → inferred spend

Build a cost model: 10x10 all-in cost, 20x20, 30x30 — including setup, graphics, staffing estimate, travel. This becomes: *"What does a trade show presence actually cost? A fully-loaded cost model."*

**Research Task 3: Facebook & LinkedIn Ad Library Monitoring**

Sources:
- Facebook Ad Library (free, public): facebook.com/ads/library — search "Caterpillar dealers," "Komatsu," "Case Construction," "John Deere dealers," "Volvo CE," top 20 dealer groups
- LinkedIn Ad Library (public, partial): linkedin.com/ad-library

Collect: which brands/dealers are running ads, ad formats in use, how long campaigns have been running (signals commitment), geographic targeting where visible. This becomes: *"Digital advertising adoption: who's in, who's out, and what formats are winning."*

**Research Task 4: Dealer Website & SEO Presence Benchmarking**

Sources:
- SimilarWeb free tier (rough traffic for top 50 dealer websites)
- SEMrush free tier (Google Ads presence — yes/no, rough keyword count)
- Manual check: does the dealer website have a live chat? A lead form? A blog? Mobile-optimized?

Score top 50 dealers on a simple 5-point Digital Maturity Index: website quality, paid search presence, social ads activity, email capture on site, content/blog. This becomes: *"Digital maturity across the industry: where most dealers actually are."*

---

## Part 4: The Report Structure

**Title:** *The 2026 IronBenchmark Report: Heavy Equipment Dealer & OEM Marketing*
**Subtitle:** *Data from 200+ practitioners + public market analysis*
**Length:** 25 pages (designed PDF)
**Tone:** Factual, direct, peer-to-peer — not consulting-speak

---

### Report Outline

**Cover + Methodology (2 pages)**
- Report title, year, "Presented by [Your Company]"
- Methodology: survey dates, respondent count, breakdown by company type and size (dealer vs. OEM split called out explicitly), data sources for public data sections, note on anonymization

**Executive Summary (1 page)**
- 5 headline findings — the most surprising, most shareable numbers. This is what gets quoted in AED presentations and forwarded on LinkedIn. Lead with the ROI channel finding (Q10) — it will be the most counterintuitive result.

**Section 1: What Trade Media Actually Costs — and Who's Spending (4 pages)**
- Part A: Rate card comparison table across top 5 publications — CPM benchmarks by format (print vs. digital display vs. newsletter vs. sponsored content), what $10K/yr buys you in each publication
- Part B: Who's actually spending — PDF analysis of real trade pub issues (brand, ad size, position, frequency, inferred annual spend range). *This is the section nobody else has ever published.*
- Key finding: which brands are the most consistent trade media investors, and what their implied commitment signals about their strategy

**Section 2: The True Cost of a Trade Show Presence (3 pages)**
- Fully-loaded cost models by booth size (10×10 through 40×40) — booth space, setup, graphics, staffing, travel
- CONEXPO vs. AED Summit comparison
- Inferred spend by company type from public exhibitor floor maps
- Key finding: what % of industry marketing budget goes to events vs. what respondents actually report — the gap between perception and reality

**Section 3: Digital Adoption — Where the Industry Actually Is (4 pages)**
- Facebook + LinkedIn ad library findings: who's running ads, what formats, how long
- Digital Maturity Index: top 50 dealers scored across 5 dimensions (website, paid search, social ads, email capture, content)
- OEM vs. dealer digital adoption gap
- Key finding: the digital adoption gap by company size — where the laggards are and what they're missing

**Section 4: Budget Allocation + Cost Per Lead (4 pages)**
- Channel budget allocation — weighted averages from survey data
- Dealer vs. OEM split: where their priorities diverge
- Breakdown by company size (1–2 locations vs. 3–10 vs. 11+)
- Cost-per-lead by channel — ranked
- Key finding: the channel with the best reported ROI vs. where budget is actually concentrated (the misalignment finding)

**Section 5: Team Structure — How the Function Is Built (2 pages)**
- Team size by company size — how many FTEs at a 3-location dealer vs. a 20-location group
- In-house vs. agency breakdown — what's being outsourced and what's kept internal
- OEM vs. dealer structural differences
- Key finding: the in-house vs. agency split that surprises most people

**Section 6: What's Working, What's Next, and the Confidence Gap (3 pages)**
- Best ROI channel ranked (Q10 — the most quotable finding)
- Biggest marketing challenges ranked — dealer vs. OEM comparison
- Planned investment increases for next 12 months
- Confidence in current marketing mix (the anxiety chart — % who say they're not confident)
- Key finding: the confidence gap and what it signals about where the industry is headed

**Closing + About (2 pages)**
- Full methodology detail
- "About IronBenchmark" — one paragraph on the mission (independent, practitioner-focused, annual)
- "About [Your Company]" — 3 sentences on what you do, contact info, website
- Preview: 2027 survey opens [date]

---

## Part 5: Full Execution Sequence

> **How to use this section:** Each step has a status marker and a ready-to-paste prompt. Copy the prompt, paste into a new Cowork session, and I'll execute. Update markers as you go: `[ ]` not started · `[→]` in progress · `[x]` done.

---

### Phase 1 — Foundation
*You do this. Requires your logins. Est. time: 1 hour.*

- [ ] **Register ironbenchmark.com** — cloudflare.com/registrar (~$12/yr). Check ironbenchmark.com first; fallback: dealerbenchmark.com or equipmentmarketer.com
- [ ] **Create GitHub account** (if you don't have one) — github.com/signup (free)
- [ ] **Create Vercel account** — vercel.com/signup with GitHub login (free)
- [ ] **Create Beehiiv account** — beehiiv.com (free to 2,500 subscribers). This holds your email list and sends the report when published.
- [ ] **Connect domain to Vercel** — add CNAME record in Cloudflare pointing to Vercel

---

### Phase 2 — Survey Build
*✅ DONE — survey built as custom HTML.*

**Files delivered:**
- `ironbenchmark_survey.html` — full 4-section, 15-question survey. IronBenchmark brand, progress bar, checkbox + radio interactions, email capture, confirmation screen with forward ask.
- `api/subscribe-ib.js` — Vercel serverless function. On submit: adds respondent to Beehiiv with tag `ironbenchmark-2026-respondent` and all 15 question answers as custom fields; sends confirmation email via Resend.

**To deploy:** push both files to your GitHub repo alongside the existing `ironbenchmark_website.html`. The survey is accessible at `/survey` (add a route in `vercel.json`).

**Add this route to `vercel.json`:**
```json
{ "src": "/survey", "dest": "/ironbenchmark_survey.html" }
```

**Update the survey CTA links in `ironbenchmark_website.html`:** replace `INSERT_TALLY_URL` with `/survey`.

**Your side — one setup task:** Make sure `RESEND_API_KEY`, `BEEHIIV_API_KEY`, and `BEEHIIV_PUBLICATION_ID` are set in your Vercel environment variables (same vars used by ReadingCoachKit — you may already have them). Add `BEEHIIV_PUBLICATION_ID` if using a separate IronBenchmark publication in Beehiiv.

- [x] **Survey built as custom HTML** — no Tally account needed.

---

### Phase 3 — Website Build
*I do this. Est. time: 15 mins your side (review + push to GitHub).*

- [ ] **Trigger prompt — paste into Cowork:**

```
Build the IronBenchmark.com landing page as a single HTML file.

Brand: IronBenchmark.com — the first annual benchmark for heavy equipment dealer and OEM marketing leaders.
Colors: background #F5F3EF, primary #1A2F3E, accent #C47B2E
Fonts: DM Serif Display (headlines) + DM Sans (body) — load from Google Fonts

Page structure (single scroll, no nav):
1. Header: IronBenchmark wordmark (text-based, no image needed) + tagline "The 2026 Heavy Equipment Dealer Marketing Benchmark"
2. One-paragraph description: "For the first time, we're publishing real data on how heavy equipment dealers and OEM marketing leaders allocate budgets, what channels are delivering results, and where the industry is headed. 200+ practitioners. Fully anonymous. Free to access."
3. Respondent counter: live-looking counter showing "[ ] dealer and OEM marketing leaders have already responded" — hardcode a number that we'll update manually each week (start at 0, I'll tell you when to update)
4. Primary CTA: large button "Take the 5-minute survey →" linking to the Tally form URL (placeholder: INSERT_TALLY_URL)
5. Secondary CTA: "Already responded? Enter your email for early access when the report publishes" — simple email input field connected to Beehiiv (placeholder: INSERT_BEEHIIV_EMBED)
6. Three preview stats section: three placeholder stat cards we'll update as data comes in (e.g. "47% of respondents spend more than 30% of their budget on trade shows" — use placeholder text for now)
7. Methodology note: "Survey conducted April–June 2026. All responses anonymized and aggregated. Public data sourced from trade publication rate cards, event exhibitor prospectuses, and public ad libraries."
8. **Independence statement** (visible on the page, not buried in footer):
   > *"IronBenchmark is an independent annual research project. [Your Company] sponsors its publication to better understand the challenges facing dealer and OEM marketing leaders. All survey responses are anonymized and aggregated — individual responses are never shared or used for sales targeting."*
   This is a pre-launch requirement. It addresses the conflict-of-interest question before anyone asks it. A marketing director who spots "Presented by [Your Company]" will immediately wonder if this is a vendor lead-gen play. One sentence of transparency removes that concern entirely.
9. Footer: "© 2026 IronBenchmark · Presented by [Your Company] · contact@ironbenchmark.com"

Include GA4 tracking snippet placeholder in head.
Mobile responsive.
Save as ironbenchmark_website.html
```

---

### Phase 4a — Public Data Research (Sections 1–3)
*I do this via automated research. Uses Haiku model for cost efficiency. Est. time: 0 mins your side — I run it, deliver findings.*

- [ ] **Trigger prompt — paste into Cowork:**

```
Run the IronBenchmark public data research for Sections 1–3 of the report. Use the most cost-efficient approach — Haiku model where possible for data extraction, Sonnet only for final synthesis prose.

Research Task 1 — Trade Publication Rate Cards:
Visit the advertising/media kit pages for: equipmentworld.com, constructionequipmentguide.com, forconstructionpros.com, roadsandbridges.com, dieselprogress.com. For each: collect full-page print rate, digital banner CPM or flat rate, newsletter placement rate, sponsored content rate. If rate card is not public, note "contact for pricing." Build a comparison table.

Research Task 2 — Trade Show Cost Modeling:
Find the CONEXPO-CON/AGG 2026 and AED Summit 2026 exhibitor prospectuses (check conexpoconagg.com and aednet.org). Extract booth rate per sq ft and any mandatory fees. Build a fully-loaded cost model for booth sizes: 10x10, 20x20, 30x30, 40x40 — including estimated setup/teardown, graphics, staffing (3 staff × 5 days × travel/hotel), and shipping. Show total cost per show and total for both shows combined.

Research Task 3 — Facebook Ad Library Scan:
Search the Facebook Ad Library (facebook.com/ads/library) for active ads from: Caterpillar, Komatsu, Volvo Construction Equipment, Case Construction, John Deere Construction, Liebherr, Doosan Bobcat, Wacker Neuson, JLG Industries, Genie. For each: are they running ads (yes/no), ad format (image/video/carousel), rough campaign duration if visible, geographic targeting if visible. Build a table.

Research Task 4 — Dealer Digital Maturity Sample:
Pick 20 US heavy equipment dealers (mix of Cat, Komatsu, John Deere, independent). For each dealer website: (1) does it have a lead capture form, (2) does it have a blog or content section, (3) is it mobile-friendly (basic check), (4) is there a Google Ads presence (check via SEMrush free: semrush.com/analytics/overview — just yes/no). Score each 0–4. Build a Digital Maturity Index table.

Save all findings as ironbenchmark_public_data_research.md with clear section headers matching the tasks above.
```

---

### Phase 4b — Trade Publication PDF Analysis (Section 1, Part B)
*You supply the PDFs. I do the analysis. Uses Sonnet model (vision required for layout analysis). Est. cost: $2–$8 total depending on number of issues.*

This is the section nobody else has ever published — actual observed ad spend inferred from real issues, not rate card estimates.

**What to gather before running this phase:**
- Digital edition PDFs of Equipment World, Construction Equipment Guide, For Construction Pros, Roads & Bridges (and/or Diesel Progress)
- Target: 6–12 months of issues per publication (more issues = stronger consistency signal)
- Where to find them: publication websites often have digital edition archives; back issues may require a free account signup
- Even 3 issues per publication is enough to publish directional findings

**Model note:** Ad identification is a vision task — Sonnet handles this. Haiku's vision capability is not reliable enough for layout-based size estimation. Budget $0.30–$0.50 per 100-page issue. Ten issues ≈ $3–$5 total.

**Framing note for the report:** All spend inferences must be framed as estimates — *"Based on observed placements and published rate card pricing, estimated spend implies..."* Never stated as exact figures. This is accurate (rates are negotiated), legally clean (public data inference), and still highly credible.

- [ ] **Gather PDFs first, then trigger this prompt — paste into Cowork:**

```
Analyze the trade publication PDFs I'm uploading for the IronBenchmark report — Section 1, Part B: Who's Actually Spending.

For each PDF issue, identify every display advertisement (not editorial content, not house ads). For each ad found, record:
- Publication name and issue date
- Brand/advertiser name
- Ad size (estimate as fraction of page: full page, half page, quarter page, double-page spread, fractional)
- Page position (front section, back cover, inside front cover, inside back cover, mid-book, or general)
- Any notable placement (facing editorial, category-specific section)

After processing all issues, build:
1. A master ad log table — every ad sighting across all issues
2. A brand frequency table — how many times each brand appeared, across which publications
3. A spend inference table — cross-reference ad size and position against rate card data from ironbenchmark_public_data_research.md to estimate implied annual spend range per brand per publication. Label clearly as estimates.
4. A consistency index — which brands appeared in every issue vs. sporadically (signals budget commitment vs. campaign-based buying)

Frame all spend figures as: "Based on observed placements and published rate card pricing, [Brand]'s presence across [X] issues implies an estimated annual investment of $[low]–$[high] in [Publication]."

Save output as ironbenchmark_pdf_ad_analysis.md
```

---

### Phase 5 — LinkedIn Outreach Campaign
*You do this. 10–15 messages/day. Est. time: 20 mins/day for 30 days.*

This is the one phase that requires your active effort. There is no automation shortcut for the first 100 survey responses — this audience doesn't come to you via Google search. You go to them.

**Who to message:**
- Search LinkedIn: "dealer marketing manager," "equipment dealer marketing," "OEM marketing manager construction equipment," "heavy equipment marketing director"
- Filter: US, 2nd connections first (warm), company size 50–500 employees
- Target: 200 outreach messages over 30 days → expect 15–25% response rate → 30–50 completed surveys from LinkedIn alone

- [ ] **Trigger prompt — paste into Cowork:**

```
Write 5 variations of a LinkedIn connection request message for the IronBenchmark survey outreach. Each variation should be:
- Under 300 characters (LinkedIn connection request limit)
- Specific to the recipient's role (dealer marketing vs. OEM marketing)
- Lead with the peer benchmark angle, not "I'm doing a survey"
- Sound like a practitioner, not a vendor
- No pitch for any product or service

Also write 3 follow-up message templates (for after connection is accepted) that explain the survey, link to IronBenchmark.com, and reinforce the peer data angle. Follow-ups should be under 150 words each.
```

**Other outreach channels (lower lift, run in parallel):**
- Post the survey link in 2–3 relevant LinkedIn groups (AED members groups, construction equipment marketing groups) — organic, free
- Email the AED member services team asking if they'd share in their newsletter as a "member resource" — free if they say yes
- Post in any equipment industry Facebook groups you're a member of

---

### Phase 6 — Report Writing
*I do this when you hit 75+ survey responses. Est. time: 30 mins your side (review).*

Don't wait for 200 responses to start writing. At 75 responses you have enough data for directional findings. Publish with a note: *"This report reflects responses from [X] practitioners collected through [date]. The survey remains open — findings will be updated in the 2027 edition."*

- [ ] **Trigger prompt — paste into Cowork:**

```
Write the 2026 IronBenchmark Report using the data I'm pasting below.

Report structure from the IronBenchmark master plan (6 sections + cover + closing):
- Cover + Methodology
- Executive Summary: 5 headline findings — lead with the best ROI channel result (Q10), it will be the most counterintuitive
- Section 1: Trade Media — What It Costs + Who's Actually Spending. Part A: rate card comparison (from public_data_research.md). Part B: observed ad spend inference from PDF analysis (from ironbenchmark_pdf_ad_analysis.md). Frame all spend estimates as: "Based on observed placements and published rate card pricing, [Brand]'s presence implies an estimated annual investment of $X–$Y."
- Section 2: The True Cost of a Trade Show Presence (from public_data_research.md)
- Section 3: Digital Adoption — ad library findings + Digital Maturity Index (from public_data_research.md)
- Section 4: Budget Allocation + Cost Per Lead — survey data split by dealer vs. OEM and by company size. Call out the misalignment finding: where budget goes vs. where ROI actually comes from.
- Section 5: Team Structure — how marketing functions are built, in-house vs. agency split, by company size and dealer vs. OEM
- Section 6: What's Working, What's Next, and the Confidence Gap — best ROI channel ranked, challenges ranked, planned increases, confidence index
- Closing + About IronBenchmark + About [Your Company] + 2027 preview

Tone: factual, peer-to-peer, direct. No consulting jargon. Write as if a smart practitioner is sharing what they found with a peer, not presenting to a board. Target length: 25 pages at standard report density.

Here is my survey data export from Beehiiv (custom fields CSV — export from Beehiiv → Subscribers → Export with custom fields):
[PASTE BEEHIIV EXPORT CSV HERE]

Here is the public data research file:
[PASTE ironbenchmark_public_data_research.md CONTENTS HERE]

Here is the PDF ad analysis file:
[PASTE ironbenchmark_pdf_ad_analysis.md CONTENTS HERE]

Use claude-sonnet-4-6 for all prose. Save as ironbenchmark_2026_report_draft.md
```

---

### Phase 7 — Report Design & PDF
*I do this. Est. time: 20 mins your side (review + approve).*

- [ ] **Trigger prompt — paste into Cowork:**

```
Convert ironbenchmark_2026_report_draft.md into a professionally designed PDF report.

Design specs:
- Brand: IronBenchmark.com
- Colors: background #F5F3EF, primary #1A2F3E, accent #C47B2E
- Fonts: DM Serif Display (headlines, section titles) + DM Sans (body, captions)
- Cover page: large title, year, "Presented by [Your Company]", report cover illustration (abstract industrial/data visual using CSS/SVG — no stock images needed)
- Interior: clean two-column layout where appropriate, data tables styled with accent color headers, stat callout boxes for key findings
- Page numbers, section headers in running footer
- Final page: "About IronBenchmark" + contact info

Use the PDF skill to generate the output. Save as ironbenchmark_2026_report_FINAL.pdf
```

---

### Phase 8 — Distribution & List Activation
*I draft, you send. Est. time: 30 mins your side.*

**Referral mechanic note:** No gate, no referral tracking links, no "refer X friends to unlock" mechanics — those feel consumer-grade and will cheapen the brand with this audience. Instead, use a soft forward line in both the survey completion message (already added) and the launch email below. Framed as a favor to the industry, not a transaction. UTM parameters on the survey link (e.g. `?utm_source=email-forward`) are enough to see if forwarding is driving signups — no infrastructure needed.

- [ ] **Trigger prompt — paste into Cowork:**

```
Write the report launch email for the IronBenchmark Beehiiv list.

Context: The 2026 IronBenchmark Report is published. Everyone on the list either completed the survey or signed up for early access. This email delivers the report.

Email should:
- Subject line: 3 options to choose from (curiosity-driving, peer-benchmark angle)
- Opening: acknowledge they contributed or signed up, deliver the report immediately (PDF link or landing page link)
- 3-sentence teaser of the most surprising findings — make them want to open it right now
- CTA: "Download the full report →"
- Secondary CTA (soft, no gate): "Find this useful? Forward it to one person in your network who'd want it — that's how we make the 2027 data even stronger." Link to ironbenchmark.com with UTM parameter ?utm_source=email-forward so we can track referral signups passively.
- Closing: brief note on the 2027 edition survey opening — plant the seed for renewal

Tone: warm, direct, practitioner-to-practitioner. Not corporate. The forward ask should feel like a colleague recommendation, not a growth hack.
```

- [ ] **Update ironbenchmark.com** — swap survey CTA for report download CTA. Trigger this prompt:

```
Update ironbenchmark_website.html for the post-publication state. Replace the survey CTA with a report download CTA: "Download the 2026 IronBenchmark Report (Free)" linking to the PDF. Update the three preview stats to show real headline findings from the report. Keep the email capture field: "Get the 2027 survey and report updates." Save as ironbenchmark_website_v2.html
```

---

### Phase 9 — Ongoing Annual Cadence
*One research sweep per quarter. Annual report cycle.*

The 2027 edition is what turns this from a one-off project into a media brand. The list grows year over year. Sponsor conversations start at Year 2.

- [ ] **Set up the quarterly monitoring task — trigger this prompt:**

```
Set up a quarterly scheduled task for IronBenchmark.com. Every 90 days, run a research sweep:
- Check Facebook and LinkedIn ad libraries for new heavy equipment brand activity
- Check for any new trade show exhibitor prospectus releases (CONEXPO, AED, ICUEE)
- Scan Equipment World and Construction Equipment Guide for editorial coverage trends
- Check for any new AED or AEM market data publications

Summarize findings in a 1-page brief and save to outputs folder as ironbenchmark_quarterly_update_[date].md. Flag anything significant enough to update the live website stats. Use Haiku model for all research and extraction. Notify me when complete.
```

---

## Part 5b: Time Budget

**Setup: 6–8 hours (one-time, spread over 2–3 weeks)**
- Domain + GitHub + Vercel + Beehiiv accounts: 45 min
- Review and push the survey HTML to GitHub: 20 min
- Review and publish the website (HTML file review + GitHub upload): 30 min
- DNS setup + GA4: 30 min
- LinkedIn profile optimization for outreach (make sure your profile signals credibility): 30 min
- Total foundation: ~3 hours. Remaining 3–5 hours = first 2 weeks of LinkedIn outreach (10 min/day).

**Daily during survey collection period (30 days): 20–30 minutes**
- LinkedIn connection requests + follow-up messages: 15 min/day
- Check Tally responses (just a quick look at the counter): 2 min
- Post in one LinkedIn group or comment on one relevant post: 5 min
- Everything else (Beehiiv, Tally responses, website) runs itself

**Weekly:**
- Update the live respondent counter on the website: 5 min
- Review any direct replies or questions that come in via contact email: 10 min

**One-time at report writing threshold (75+ responses): 45 minutes your side**
- Export Tally CSV and paste into the report-writing prompt: 10 min
- Review the draft report I produce: 30 min
- Review the designed PDF before final publish: 5 min

**This is the leanest project in the portfolio.** Once the survey is live, your primary job for 30 days is the LinkedIn outreach (20 min/day). The AI handles everything else. Total active time to published report: approximately 15 hours.

---

## Part 6: What This Costs

| Item | Cost |
|---|---|
| Domain (ironbenchmark.com) | ~$12/year |
| Hosting (Vercel) | Free |
| Survey platform (Tally) | Free |
| Email list (Beehiiv, under 2,500) | Free |
| Analytics (GA4) | Free |
| AI research tasks (Haiku model) | ~$0.10–$0.30 total |
| Report writing (Sonnet model, one-time) | ~$0.15 |
| PDF design generation | Free (PDF skill) |
| LinkedIn outreach | Free (your time: 20 min/day × 30 days) |
| **Total cash cost** | **~$12/year** |
| Optional: AED newsletter sponsorship (to accelerate responses) | $500–$1,500 one-time if needed |

> **Note on survey data export:** All 15 survey answers are stored as custom fields on each Beehiiv subscriber (fields prefixed `ib_`). To export for analysis: Beehiiv dashboard → Subscribers → Export → select "include custom fields." Open in Excel/Google Sheets and pivot on any column. All multi-select answers (Q6, Q9, Q13) are stored as semicolon-delimited strings — use Text to Columns to split them.

---

## Part 7: What Success Looks Like

| Milestone | Target | Timeline |
|---|---|---|
| Survey live | — | Week 2 |
| First 25 responses | — | Week 3–4 |
| 75 responses (report writing threshold) | — | Week 6–8 |
| Report published | — | Week 10–12 |
| Email list size at publication | 200–400 names | Week 12 |
| LinkedIn shares of report | 50–150 | Week 12–14 |
| Inbound sponsor/partnership inquiries | 2–5 | Month 4–6 |
| 2027 survey opens | — | Month 13 |

---

## Part 8: The Credibility Checklist

Before you share the survey link with anyone, these things need to be true:

- [ ] ironbenchmark.com is live with real content (not a blank page)
- [ ] Methodology statement is on the website
- [ ] Survey completion message is professional and specific ("within 60 days" — not "soon")
- [ ] Email confirmation fires when someone submits the survey
- [ ] The word "annual" appears somewhere — "The first annual IronBenchmark Report" signals this is a series
- [ ] "Presented by [Your Company]" is visible but not the headline — you're the publisher, not the vendor
- [ ] Independence statement is on the page: "IronBenchmark is an independent research project. [Your Company] sponsors its publication to better understand dealer marketing challenges. All data is anonymized and never used for sales targeting."
- [ ] Contact email (contact@ironbenchmark.com) is live and monitored

---

## Part 9: Year 2 — Interactive Benchmark Explorer

**Reminder: Build this after the 2026 report publishes. Not before.**

Once the PDF report is out and you can see which sections get shared and which questions generate inbound emails, build the interactive version. The data will be real, the engagement signals will tell you what to surface, and the tool will be genuinely useful rather than speculative.

### What it is

A single-screen **benchmark explorer** — not a dashboard, not a BI tool. Three questions on entry (role, company size, budget range), then instant cohort filtering: a 3-location Cat dealer sees what other 3–10 location dealers said. An OEM marketing director sees what other OEM marketing directors said. Personalized benchmarks, not industry-wide averages.

### Why it's more valuable than the PDF

The PDF gives everyone the same numbers. The explorer gives each person *their* benchmark — the one they actually wanted. That personalization is what makes people return to it, share it, and come back for the 2027 edition.

### The second email capture moment

Gate bar at the bottom: "Download your personalized benchmark report" → email capture → PDF generated with their cohort's data highlighted. Captures emails from people who found the public report but never gave their email the first time.

### The monetization unlock

Sponsor pitch changes entirely once this exists. You're no longer selling adjacent to a PDF. You're selling placement inside an active tool that dealer marketing leaders use to benchmark themselves — a tool they return to. Price it accordingly.

### Build trigger — paste this into Cowork when ready:

```
Build the IronBenchmark interactive benchmark explorer as a single HTML file.

Data source: paste the cleaned Beehiiv export CSV (with custom fields) below — embed it directly as a JS object, no external database needed.

Functionality:
- Entry screen: 3 questions — role (dealer vs OEM), company size (locations), budget range. Large tap-friendly buttons, no dropdowns.
- Results screen: shows peer cohort answers for all 5 survey sections, filtered to their selections. Charts: horizontal bar charts for channel allocation, single stat callouts for key numbers, a "your cohort vs. all respondents" comparison line where relevant.
- Gate bar: "Download your personalized benchmark report" → email modal → generates a PDF summary of their cohort data → email captured to Beehiiv with tag "explorer-2026"
- Back button to adjust cohort filters

Design: IronBenchmark brand — background #F5F3EF, navy #1A2F3E, bronze #C47B2E, DM Serif Display + DM Sans. Clean, single column, mobile-first.

No frameworks. No external dependencies except Google Fonts. Pure HTML/CSS/JS.

[PASTE BEEHIIV EXPORT CSV HERE]

Save as ironbenchmark_explorer.html
```

---

*Ready to execute. Start with Phase 1 — register the domain and create your Tally, Beehiiv, and Vercel accounts. Then paste the Phase 2 prompt to build the survey, and Phase 3 to build the website. Public data research (Phase 4) runs in parallel — paste that prompt at the same time as Phase 3.*
