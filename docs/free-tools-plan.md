# Greenskeeper free tools plan

Planning date: September 30, 2026. Repository updated by fetching origin and fast-forwarding main to `7f338c6`. This is a product proposal, not an implemented release.

## Recommendation

Integrate the existing Swingalysis product into Greenskeeper's free-tools offering first, retaining swingalysis.com as its editor domain. Then build a connected set of free tools for the person organizing a golf trip: a trip planner, a budget calculator, and a multi-round pairing generator. Follow with a course-handicap calculator and a course-list map after validating the app export format.

Each tool should work independently, without signup, on mobile. Its useful output should be available before an app-download CTA. A person arriving from search should finish their task in minutes, then discover the other tools naturally.

The differentiator is a reliable plan people can act on: dates, tee times, costs, groups, booking deadlines, and a clean summary for the group chat. Generic AI destination recommendations would put us into an already crowded category and introduce unverified prices and availability.

## Current constraints

- The website uses Python-generated HTML, CSS, and small vanilla JavaScript enhancements. GitHub Pages deployment has no application backend or database. Reuse this structure; no framework migration is needed.
- Existing pages already have canonicals, descriptions, Open Graph metadata, a sitemap, and destination articles. Tool routes must be added to the builder and public packaging path.
- This repository has no Swift sources. The app's export, import, and deep-link capabilities have not been verified.
- The published privacy page describes local app storage and optional personal iCloud backups. A web page cannot read that app storage directly. Do not promise automatic course sync.
- Existing destination guides cover Scottsdale, San Diego, Myrtle Beach, Palm Springs, and Traverse City. They provide relevant starting points for planner links, but are not a verified database of prices, coordinates, ratings, or live tee times.
- Baseline check: `/usr/bin/python3 -m unittest discover -s tests -v` passes 11 of 13 tests. Two generated-article tests inherit a description longer than the generator's 170-character limit from the newest article. Give those tests a stable valid fixture before a release. The default Homebrew Python additionally has a local expat linking problem; that is separate from site code.
- The README still describes scheduled AI publishing, while the fetched workflow now only deploys on push or manual dispatch. Update that documentation during implementation.
- The production homepage could not be retrieved by the research browser. Repository findings are verified locally; live deployment and Search Console performance remain unverified.

## Priorities

These priorities reflect usefulness, product fit, and implementation feasibility. Search phrases are hypotheses, not measured search volumes or ranking predictions.

| Priority | Tool | Useful outcome | Search intent to validate | Effort / dependency |
| --- | --- | --- | --- | --- |
| 1 | Golf Trip Planner | A day-by-day schedule with tee times, lodging notes, deadlines, and a group-chat summary | golf trip planner; golf trip itinerary template | Medium; manual course entry initially |
| 2 | Golf Trip Budget Calculator | Total and per-person costs, scenario comparison, and expense settlement | golf trip cost calculator; golf trip budget | Low to medium; no course API |
| 3 | Golf Pairing Generator | Multi-round groups with fewer repeated playing companions | golf pairing generator; golf trip foursome generator | Medium; constrained scheduling algorithm |
| 4 | Course & Playing Handicap Calculator | Strokes received at particular tees and an explanation of the result | course handicap calculator; golf handicap strokes calculator | Low to medium for an 18-hole version; user enters ratings |
| 5 | Golf Bucket List Map | A portable, printable map and list of played / wanted courses | golf bucket list map; map of golf courses played | Medium to high; coordinates and app export support |
| 6 | Tee-Time Booking Reminder Builder | Calendar reminders for when reservations open and cancellation deadlines | golf tee time booking reminder; tee time booking window | Low to medium; user supplies actual course policy |
| 7 | Can I Finish Before Dark? | Latest suggested tee time for 9 or 18 holes using pace and a daylight buffer | golf sunset calculator; latest tee time before dark | Medium; accurate location, timezone, and solar calculation |
| 8 | Golf Membership Break-Even Calculator | Rounds needed to justify a membership or multi-round pass | golf membership cost calculator; golf membership worth it | Low; explicit fee and usage assumptions |

A packing checklist is a useful planner feature but is weaker as the first standalone tool. Delay generic distance calculators, swing advice, live booking engines, and a full tournament scoring product: they fit Greenskeeper less closely or require much more infrastructure.

## First release: three tools, one reusable trip format

### Golf Trip Planner — `/tools/golf-trip-planner/`

Flow: trip name and dates → golfers → rounds and activities → review and export. Show a realistic sample trip immediately, with a clear button to replace it with the user's own trip.

Inputs: course name and optional official URL, date, tee time, holes, estimated round duration, accommodation, manually entered travel buffers, booking status, and deadlines. Keep required fields minimal. Distinguish proposed tee times from confirmed reservations.

Outputs: daily agenda, missing-booking list, overlapping-event warnings, copyable plain-text itinerary, printable layout / browser Save as PDF, and calendar export. Use local date and timezone deliberately; a destination timezone must not silently become the browser's timezone.

Provide browser autosave, JSON file download/import, and a clear reset action. Explain that browser saving stays in that browser and is not a backup. If storage is unavailable, keep the tool usable in memory and offer download. Private browsing and cleared storage should not cause silent loss claims.

Use optional links to existing destination guides to help people choose courses. Do not claim live availability, automatic booking, verified travel times, or current prices. Course selection and a route map can follow once we have dependable data.

Acceptance: a user can create a three-day, eight-person trip; add multiple rounds; identify a schedule conflict; reload a saved draft; download and reimport it; and export an understandable itinerary on a phone.

### Golf Trip Budget Calculator — `/tools/golf-trip-budget-calculator/`

Flow: golfers and currency → shared / individual costs → compare scenarios → optionally record who paid.

Inputs: green fees by round, carts/caddies, lodging, transport, meals, optional taxes/tips, and contingency. Label each cost as per person, per night, per room, per round, or total so users do not accidentally multiply it twice. Support different participants in an expense for partial attendance or non-golfers. Start with one currency per trip.

Outputs: category breakdown, total, per-person obligations, and a side-by-side scenario such as three rounds versus four. Optional settlement should show who pays whom after accounting for deposits and expenses already paid. Round in integer currency units and reconcile residual cents deterministically.

Show incomplete costs explicitly; zero must not mean unknown. All sample prices must be labeled illustrative. Users supply quotes and estimates. Allow adding the budget to a planner draft without retyping.

Acceptance: shared hotel costs, individual flights, partial attendance, and deposits produce reconciled totals; changing group size affects only appropriate expenses; exports explain all assumptions.

### Golf Pairing Generator — `/tools/golf-pairing-generator/`

Flow: paste golfer names → choose rounds and group size → optionally set keep-together / keep-apart constraints → generate and review.

Outputs: groups by round, a count of repeated pairings, editable assignments, and a printable / copyable schedule. Handle threesomes and nonmultiples of four. Let an organizer lock one round and regenerate the others. Transfer the roster from the planner when available.

Optimize repeated playing companions first. If constraints prevent a repeat-free schedule, show the remaining repeats clearly. A bounded search that finds a good schedule is acceptable; do not claim it proves the optimal solution. Team balancing by handicap can be a later mode, with its tradeoff against pairing variety explained.

Acceptance: nobody is omitted or duplicated in a round; locked groups stay fixed; conflicting constraints are explained; repeated pairs are counted correctly; generation has a time limit and works on mobile.

## Handicap scope

Start with **course handicap and playing handicap**, using an existing Handicap Index and manually entered tee-specific Course Rating, Slope Rating, and par. Include a small guide to finding these on the scorecard or official course site and let users save their tee values locally.

The USGA formula is `Course Handicap = Handicap Index × (Slope / 113) + (Course Rating − par)`. Retain the unrounded result when applying an allowance to calculate Playing Handicap, then round the final result. Explain plus handicaps correctly and test ties / sign conventions against official examples. Avoid confusing a player's existing index with strokes received for one course.

For the first version, target 18 holes and identify the USGA rules basis. Add nine-hole support only after validating its distinct rules and examples. Do not label the output a newly issued or official Handicap Index. A full index estimator requires score histories, differential adjustments, caps, exceptional-score handling, and current nine-hole expected-score treatment; it is not just an average of scores.

Useful follow-up: optional per-hole stroke allocation from a user-entered stroke-index order, including handicaps above 18. Automated course rating lookup is a separate data-access question; no dependable licensed API has been established in this research.

Official references:
- [USGA course and playing handicap explanation](https://www.usga.org/content/usga/home-page/handicapping/world-handicap-system/world-handicap-system-usga-golf-faqs/faqs---calculate-course-handicap-and-playing-handicap.html/1000)
- [USGA calculator](https://digital-pd.usga.org/content/usga/home-page/course-handicap-calculator.html)
- [USGA nine-hole treatment](https://www.usga.org/content/dam/usga/pdf/2024-revision/Detailed-Infographic-2024-9-hole-scores.pdf)

## App and map bridge

Local-only storage does not prevent a web tool; it means the user must explicitly transfer the data.

1. Begin with paste/manual entry and documented CSV/JSON import for course lists.
2. Inspect the app repository and any existing backup/export format before promising compatibility.
3. Add an app action such as “Export course list for trip planning.” Proposed fields: format version, course identifier, name, locality, country, optional coordinates, and played/bucket-list status. Do not include private photos or personal notes by default.
4. The web tool reads the selected file in the browser, previews its contents, validates size and structure, and asks which courses belong on this trip. Flag duplicate or unmatched courses for review.
5. Generate a map only for courses with valid coordinates; offer a useful list for the rest. Choose a map/tile provider and check attribution, usage, and network data behavior before implementation. Do not geocode private lists silently.
6. Explore an explicit import back into the app after its supported file types or deep links are known. A website-only change cannot establish this integration.

Downloads and copyable summaries are enough for the first release. Live collaboration and short persistent sharing links need a backend. An optional URL-fragment snapshot could work without server persistence but is still readable by anyone receiving it, may be too long, and will not update; do not make it the default sharing promise.

## SEO requirements to build in

Own one clear search task per route. Keep the planner and budget tool separate because they solve different tasks, with distinct explanatory content. Place them under `/tools/`, link the hub from navigation and the homepage, and add all public routes to the sitemap.

Render each title, description, H1, instructions, worked example, limitations, sources, and relevant internal links as static HTML. JavaScript powers calculations and editing. When JavaScript is disabled, explain how to enable the interactive tool rather than leaving an empty shell. This fits the existing site's architecture and Google's guidance about rendering and crawlable links.

Each tool page should include the tool near the top, an original example with visible input/output, an explanation of assumptions, relevant questions, and links to the next useful step. Keep content focused on the actual task. Add accurate WebPage/BreadcrumbList metadata where appropriate; do not invent reviews or ratings.

Do not create indexed URLs for every private draft or parameter combination. Use a stable base-page canonical and exclude private draft contents from metadata. If hosted user plans are added later, give them an explicit private/noindex policy and access design. Canonicals alone are not privacy controls.

Use existing destination articles to introduce the planner in context. Begin with a few genuinely researched destination examples, not hundreds of templated city pages. Preload a planner template through an explicit action rather than creating thin duplicate landing pages.

FAQ text can help users, but do not build an SEO plan around FAQ rich results: Google's current documentation says that feature stopped appearing in Search in May 2026.

Ranking is not guaranteed. Research here confirms competitors exist; it does not establish search volume, keyword difficulty, or the site's authority.

References:
- [Google JavaScript SEO guidance](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Google people-first content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [Google canonical URL guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Google Search documentation updates, including FAQ retirement](https://developers.google.com/search/updates)
- [GolfTripHQ: existing free trip organizer](https://www.golftriphq.com/)
- [The Weekend Major: competing tools catalogue](https://theweekendmajor.com/tools)

## Handoff for the separate SEO agent

Review these proposed routes before implementation locks page titles and copy. Validate keyword demand and search-result intent; no paid-volume estimates have been collected. Suggest one primary query and a small set of related queries for each page. Compare the actual top-ranking tools' usability, useful outputs, content, and backlinks, not just their word counts.

Audit Search Console indexing and current destination-page performance if authorized access is available. Recommend internal links from those guides, original example content, and title/description copy. Verify which structured-data features are currently supported. Identify relevant golf-trip organizers, clubs, newsletters, and travel writers who might find a printable tool worth referencing; prepare outreach ideas without sending messages.

Ownership: implementation handles routes, static rendering, canonicals, sitemap, accessibility, performance, and exports. The SEO agent handles query validation, editorial positioning, internal-link recommendations, and acquisition ideas. Agree route names first so parallel work does not collide.

## Delivery sequence and measurement

1. Repair the existing fixture failures and stale deployment documentation. Define a versioned trip schema, currency/date rules, and shared draft storage.
2. Build the tools hub and the three first-release tools, preserving existing site design. Add JSON import/export, text copy, print styles, and planner calendar export.
3. Verify calculations and schedule constraints with meaningful unit tests. Verify generated pages, canonicals, links, sitemap inclusion, and `_site` packaging. Manually check phone layouts, keyboard use, screen-reader labels/status messages, storage failure, and malformed imports.
4. Add SEO-reviewed page copy and contextual links from relevant guides; preview all outputs before publishing.
5. Follow with the 18-hole handicap calculator. Implement the app export and map only after inspecting the app and selecting a data/provider approach.

If analytics are added, record task events without golfer names, notes, private itineraries, or imported course lists: tool started, useful result produced, export completed, validation failure, and app CTA selected. Confirm the website's privacy disclosures match actual behavior.

Evaluate success through organic clicks to tool pages, the share of starts reaching a useful output, export usage, and app CTA clicks. Search Console CTR and query position help diagnose acquisition; they do not show whether the tool solved the task. App installs require an attribution method beyond a website CTA click.

Start with this coherent set and expand based on actual use. The booking reminder builder is a strong next addition because a saved course reservation deadline is actionable and can reuse the planner's calendar export.

## Swingalysis integration and additional tools

Added after reviewing `/Users/jakelevato/Documents/Projects/swing` on September 30, 2026. A successful remote fetch confirms local main and origin/main both point to `7686bd7`, with zero commits ahead or behind. Existing uncommitted changes in `apps/web/src/components/analyzer.tsx` and `apps/web/e2e/core-flows.spec.ts` were preserved. No Swingalysis source changes or deployments were made during this planning review. The research browser could not retrieve swingalysis.com, so production behavior remains unverified.

### Position Swingalysis as the first available tool

The existing Next.js product supports local MP4/MOV review, frame stepping, manual drawing references, side-by-side and overlay comparison, screenshots, and annotated-video download. Browser projects and JSON backups save drawing/settings data, not the original videos. Users must reopen source videos when returning to a project.

This is a usable swing-review product, not an automated AI coach. The site's accuracy page explicitly excludes inferred biomechanics and launch-monitor measurements. Marketing must match those capabilities.

Proposed first integration:

1. Add a prominent Swingalysis card to Greenskeeper's `/tools/` hub: “Free golf swing video analyzer — review, draw, compare, and export.”
2. Create `/tools/golf-swing-analyzer/` as an original Greenskeeper introduction with a short workflow, screenshots, limitations, and a clear link to the Swingalysis editor. Keep this page useful on its own; do not copy the Swingalysis homepage.
3. Add “Swingalysis by Greenskeeper” branding and a “More free golf tools” link on Swingalysis's landing page and shared informational pages. Keep its domain and recognizable product name.
4. Offer a restrained Greenskeeper CTA after a successful export and on the landing page: “Keep the courses and memories behind your game.” Do not imply the app already stores swing-review projects or synchronizes them.
5. Use nonpersonal source/campaign parameters for navigation attribution if desired. Actual conversion-event tracking is a separate decision: Swingalysis currently states that it has no telemetry service, so adding analytics requires updating that disclosure.

Keep the editor as a first-party experience at swingalysis.com for the first release. An embedded iframe adds uncertainty around mobile layout, file selection, downloads, fullscreen, and browser storage. Hosting a second copy under Greenskeeper also creates a second browser-storage origin; saved Swingalysis projects would not automatically appear there.

If a later migration is warranted, first design explicit project export/import, explain that videos remain separate, select one canonical public location, and validate redirects and browser behavior. A direct branded link now is the smallest reliable integration; it does not preclude deeper integration later.

### SEO ownership across the domains

Ask the SEO agent to choose a primary search owner for swing-review queries. My recommendation is Swingalysis for the editor and its detailed recording/comparison tutorials; Greenskeeper's tools hub and introduction provide discovery and the broader product context.

Avoid putting the same homepage copy on both domains. Distinct useful pages may each have their own canonical. If substantially duplicate pages are eventually served, choose one canonical owner deliberately rather than expecting both copies to rank independently.

Inspect deployment and metadata before launch. The reviewed Swingalysis root layout has a title and description but no explicit metadataBase or canonical; that is a concrete audit item, not evidence of its current search performance. Verify sitemap, robots, per-page metadata, crawlability, and production URLs separately.

### More tools worth considering

These are product hypotheses, with no verified search-volume estimates. Favor tools that yield a reusable result over generic advice generators.

| Addition | Useful inputs and output | Scope / priority |
| --- | --- | --- |
| Swing Tempo Calculator | Mark takeaway, top, and impact in a clip; show backswing time, downswing time, and their ratio | Strong Swingalysis extension. Validate source timestamps and slow-motion recording rate; do not present a universal ideal ratio or automatic diagnosis. |
| Swing Recording Setup Assistant | Select face-on/down-the-line and handedness; get a clear camera-placement illustration and capture checklist | Small extension of Swingalysis's existing recording guide. Valuable before users create unusable clips. |
| Printable Swing Comparison Sheet | Pick matching frames from two clips; export a dated side-by-side sheet with club, camera view, and user notes | Reuses comparison/screenshots. Useful for a lesson, before/after practice, or a coach conversation. |
| Golf Club Gapping Worksheet | Enter measured carry samples by club; show typical carry, variability, and overlap with neighboring clubs | Strong standalone candidate. Distinguish carry from total distance and comparable measurement conditions; do not infer distance from swing video. |
| Golf Practice Session Builder | Choose available time, facilities, and a focus; get an editable timed practice card with measurable tasks | Follow-up candidate. Use explicit user goals and reviewed drills; a questionnaire alone cannot diagnose swing faults. |
| Golf Round Pace Planner | Tee time, target duration, holes, and planned stops produce time checkpoints | Small deterministic calculator, printable as a card; later reuse in the trip planner and daylight tool. |
| Trip Course Shortlist Comparison | Compare user-entered fees, travel time, access, cancellation terms, and group preferences | Better as a planner feature first. Makes tradeoffs explicit without pretending to have live course data. |

Revised order: connect Swingalysis → launch planner/budget/pairings → add course handicap → add club gapping and one focused Swingalysis extension → app course export/map. Booking reminders and shortlist comparison can ship as planner features. Avoid launching a dozen shallow pages just to target keywords.

### Integration acceptance checks

- Greenskeeper tool links reach the correct live Swingalysis landing page/editor and provide a clear return path.
- Existing analyzer work remains intact; run its checks and relevant end-to-end flows after any actual source changes.
- Branding and CTAs do not obstruct editing, file controls, or exports on mobile.
- The local-video promise remains true, and any analytics changes match the privacy disclosure.
- No claims of app synchronization, automatic AI coaching, or launch-monitor metrics appear without implementation and validation.
- Confirm one primary search owner per topic and distinct content across the domains before publishing.
