# Search and conversion measurement

Implemented October 1, 2026. Search visibility is not a ranking guarantee. Analytics collection is **off** until the owner supplies the provider configuration.

## Search coverage

| Page | Main search intent |
| --- | --- |
| Greenskeeper homepage | golf course tracker, golf course bucket list app |
| Tool hub | free golf tools |
| Trip planner | golf trip planner, buddies golf trip itinerary |
| Trip budget | golf trip budget calculator, golf trip cost per person |
| Daylight | golf daylight calculator, finish golf before dark, latest tee time |
| Membership | golf membership break-even calculator, is a golf membership worth it |
| Greenskeeper Swingalysis page | Swingalysis by Greenskeeper introduction |
| Swingalysis homepage | free online golf swing analyzer, golf swing video analysis |
| Swingalysis recording guide | how to record a golf swing, face-on and down-the-line camera setup |
| Swingalysis accuracy guide | 2D golf swing analysis accuracy and limitations |

Distinct, self-canonical pages serve different needs. The editor and its demo/import/compare query variants are `noindex,follow`; the substantive homepage is the swing analyzer's search landing page. Swingalysis canonicals use **www.swingalysis.com**, matching Vercel's existing apex redirect. Greenskeeper canonicals use **getgreenskeeper.com**, matching Pages. Existing URLs remain intact. `/home.html` shares the homepage canonical and is excluded from the sitemap.

Tool instructions, examples and answers are rendered in HTML before JavaScript executes. Schema describes actual organizations, pages, breadcrumbs, articles and browser apps. It contains no fabricated reviews, ratings, rankings or FAQ-rich-result promises. Journal articles link to the trip, budget and daylight tools.

## Owner setup: search performance

1. Add Domain properties for `getgreenskeeper.com` and `swingalysis.com` in Google Search Console. Verify the generated TXT record through the domain's DNS provider. Verification requires the owner's account/DNS access; it is not completed by publishing code.
2. Submit `https://getgreenskeeper.com/sitemap.xml` and `https://www.swingalysis.com/sitemap.xml`.
3. Inspect the homepage, tool hub, all five tool URLs, Swingalysis homepage and recording guide. Confirm Google-selected canonical and rendered content; request indexing for the new landing pages.
4. Check indexing exclusions, mobile Core Web Vitals and search queries weekly after traffic accumulates. Compare successive 28-day periods by page/query/country/device. Do not treat a single rank check or small sample as a trend.
5. Add both sites to Bing Webmaster Tools, optionally importing verified Search Console properties.

## Analytics recommendation

Use one Plausible account with a separate site/dashboard for each domain. It works with both static GitHub Pages and Next.js on Vercel, provides referral/campaign and approximate geographic reporting, and supports the small event vocabulary below without sending tool contents. It is a paid service after its trial; confirm the current plan's custom properties/funnel features before purchasing. No account or subscription has been created.

GA4 is an alternative if a Google property is already in use or a no-subscription analytics product is required. It would need its own integration, consent configuration appropriate to deployment, and cross-domain setup. Do not paste a GA identifier into the Plausible fields. Vercel Analytics alone would split the two sites' measurement and its custom-event availability depends on plan.

Separate domains do not imply a unified person/session funnel in cookieless analytics. Use outbound click events on the originating site and referral reports on the destination. Aggregate these, without claiming individual journeys are stitched.

## Activate the prepared Plausible integration

1. Add both domains in Plausible and copy each site's current installation snippet. Only the public script URL is needed, in the form `https://plausible.io/js/pa-<site-specific-id>.js`. Do not send an API key or password.
2. Greenskeeper: set `plausible_script` in `site.json` to that site's script URL, then run `python scripts/build.py`, test and deploy.
3. Swingalysis: set Vercel production environment variable `NEXT_PUBLIC_PLAUSIBLE_SCRIPT` to that site's script URL and redeploy. Its security policy allows Plausible only when this value is present and valid.
4. Turn off provider automatic outbound/file/form tracking; the integration explicitly disables those to avoid sending full link destinations or field contents. Leave custom events available.
5. Add custom-event goals with these **exact** names. Choose a plan that supports the properties you want to segment.

| Event | Meaning | Properties |
| --- | --- | --- |
| App Store click | A click to Greenskeeper's App Store listing, not an install | site, tool, placement |
| Swingalysis click | Click from Greenskeeper to Swingalysis | site, tool, placement |
| Greenskeeper click | Click from Swingalysis to Greenskeeper | site, tool, placement |
| Analyzer open | Click to the editor or demo | site, tool, placement, mode |
| Tool engaged | First actual input interaction per page load | site, tool |
| Tool export completed | Browser copy succeeded or file download was initiated | site, tool, format |
| Swing export completed | Editor emitted its successful export event | site, tool |

No user-entered content is attached. Exact location, budgets, notes, names, media, filenames and arbitrary query parameters are excluded. Referrer paths are reduced to origins. Campaign parameters are length/character checked. Campaign tags must not contain personal information.

The collector stays off on localhost/preview domains, with Do Not Track or Global Privacy Control, or when `greenskeeper:analytics-opt-out` is `true` in local storage. No proxy bypasses blockers. Ad blockers and privacy choices mean counts will be incomplete.

6. Validate using Plausible's installation checker and a normal production visit (without opt-out headers). Inspect network payloads, verify exactly one pageview per navigation, click a CTA, and confirm the event arrives in the dashboard. Confirm disabled/opted-out visits produce no collector request. Automated tests exercise the integration with a fake collector; they are not proof a real account is receiving data.
7. Update the privacy wording from “disabled until configured” when activating collection. The planned disclosure already describes the event scope.

## App conversion and campaign attribution

Greenskeeper's existing privacy policy identifies AppsFlyer for native app attribution. A web App Store click is only an intent signal. To measure installs, onboarding and subscriptions, generate approved AppsFlyer OneLink campaign URLs in the existing account and wire those into CTA destinations, then validate against the app's existing SDK/deep-link handling. No AppsFlyer account changes or inferred install tracking were added here.

Use controlled campaign tags for external distribution, e.g. `?utm_source=newsletter&utm_medium=email&utm_campaign=fall_golf&utm_content=daylight`. Do not tag ordinary internal links with new acquisition UTMs, which would overwrite the real source.

## Weekly optimization

Track landing-page visitors → tool engagement → useful export → App Store clicks, segmented by source, page and device. Track cross-site clicks separately. Use country/region as an approximate audience signal, not a golfer's exact location. Pair this with Search Console impressions, clicks, CTR and query/page performance. Improve high-impression/low-CTR titles, pages with engagement but few app clicks, and mobile steps with drop-offs. Change one major variable at a time and record the date; measure installs in AppsFlyer before claiming app acquisition gains.

## Sources

- https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- https://developers.google.com/search/docs/appearance/structured-data/software-app
- https://support.google.com/webmasters/answer/9008080
- https://plausible.io/docs/plausible-script
- https://plausible.io/docs/script-extensions
- https://plausible.io/docs/custom-event-goals
- https://plausible.io/docs/custom-locations
- https://vercel.com/docs/analytics/limits-and-pricing
