# Production website analytics

Greenskeeper uses existing PostHog project **663528**, the public write-only project token, ingestion `https://us.i.posthog.com`, dashboard host `https://us.posthog.com`, and `site: "greenskeeper"`. Swingalysis remains in this same project with its own label. No new project, payment setup, or paid product is required. All captured events share the project allowance.

## Hosting and activation

`site.json` and `CNAME` set `https://getgreenskeeper.com`. Live responses confirm GitHub Pages hosting; `https://www.getgreenskeeper.com` redirects to the apex domain. `.github/workflows/publish.yml` packages `_site` and deploys from `main` using GitHub Pages. It runs Python, Node, tool/accessibility browser tests, and offline analytics browser checks before uploading the artifact.

Only `scripts/package_site.py` adds the production marker and the public route manifest to every HTML page, including support, privacy, and terms. `assets/analytics.js` additionally requires HTTPS and either production hostname. Localhost, GitHub preview hosts, arbitrary hosts, WebDriver acceptance runs, and `window.__GK_ACCEPTANCE_TEST__` are excluded. Generated source pages are inactive until packaged. Initial pageviews are manual; script reloading and query/hash-only history changes do not count again. Full navigation, path-changing history updates, and back-forward cache restores count once.

The former unconfigured Plausible sender was replaced. This static site has no frontend runtime dependencies: a small explicit sender calls the [PostHog capture API](https://posthog.com/docs/api/capture). There is no SDK, remote settings request, session replay, automatic click capture, heatmap, performance collection, automatic exception capture, or flag/survey product to activate accidentally. Payloads retain both `api_key` and `properties.token`.

## Dashboard

[Greenskeeper traffic and actions](https://us.posthog.com/project/663528/dashboard/2208120) shows daily unique browsers, minute-by-minute page activity over the last hour, referral origins, all-tool actions, CTA targets, and import/export outcomes. Both dashboard and insights filter `site=greenskeeper` and exclude `verification_test=true`. Daily buckets use the project's UTC timezone. Counts describe anonymous browsers, not identified people; opt-outs/ad blockers undercount. Page activity is not proof a visitor is still online.

## Coverage and event contract

| Surface | Events and fixed categories |
| --- | --- |
| All public pages and navigation | `$pageview`; approved routes only, otherwise `/other` |
| Home, tools index, journal, articles, support, legal pages | `cta_clicked` for App Store, Swingalysis, tools, journal, support, and five tool routes; fixed placement only |
| All editable tools | `tool_engaged` once on first trusted input |
| Trip planner | `form_submission` activity-save attempt/success/failure; `tool_action` edit/remove/example/reset; import attempt/completed/failed; JSON/calendar/copy exports |
| Budget | First successful calculation, expense add/remove, reset, reuse saved trip; copy or fallback text export |
| Daylight | Submitted calculation attempt/success/failure; first successful interactive calculation; geolocation attempt/success/failure without coordinates; copy/text export |
| Membership | Submitted calculation attempt/success/failure; first successful interactive calculation; copy/text export |
| Swing analyzer introduction | Pageview and outbound Swingalysis CTAs; editor actions are tracked by Swingalysis's existing integration, not duplicated here |
| Journal | Debounced search and category-filter usage, without search words or category contents |
| All print controls | `print_requested`; never claims a PDF was saved |

`export_attempted`, `export_completed`, and `export_failed` use only `format` values `calendar`, `trip-file`, `text`, or `clipboard`. Clipboard failure records a failure before an attempted fallback text download. Completion means clipboard success or browser download initiation, not proof of disk save. Native HTML validation can prevent a submit handler entirely; no success event is emitted for blocked forms. Autosaving, repeated recalculation, mouse movement and scrolling are not tracked.

## Privacy and reliability

Every outgoing event is allowlisted. Properties are rebuilt from fixed categories plus a random local browser ID, public route, referrer origin/domain, `site`, `environment`, test marker, and required transport fields. No form contents, email addresses, names, notes, files, filenames, upload data, calculator inputs/results, search text, arbitrary query strings, fragments, raw user agent, or error messages are transmitted. `$process_person_profile=false` prevents person profiles; `$geoip_disable=true` prevents IP geolocation. The provider still sees ordinary network information needed to receive requests. Fetch omits credentials and referrer headers; analytics exceptions and rejected requests never interrupt tool operations.

The [privacy page](https://getgreenskeeper.com/privacy.html) offers browser opt-out and re-enable controls. Tracking checks Do Not Track, Global Privacy Control, the existing Greenskeeper and Swingalysis opt-out keys, PostHog's standard token-specific opt-out, and Plausible's browser ignore flag before every send. Re-enable never overrides privacy signals or other existing opt-outs. If storage is unavailable, tracking remains off. Turning tracking off removes the anonymous ID and takes effect in the current tab immediately and other tabs on their next attempted event.

## Checks and production verification

```
python3 -m unittest discover -s tests -v
npm test
python3 scripts/package_site.py
npm run test:browser
npm run test:analytics-browser
```

The complete tool suite needs a local `_site` preview server on port 4173. The analytics browser suite intercepts the production domain with local artifact files and mocks all PostHog requests by default, so CI creates no ingestion events.

After deployment, explicitly run `PRODUCTION_ANALYTICS_VERIFY=1 npm run test:analytics-browser`. This opens actual production pages and exercises all four local tools, the fifth tool's landing page, journal, support and legal pages. Its isolated browser sets `greenskeeper:analytics-verification=true` in session storage; that permits WebDriver verification on production and labels **every** event `verification_test=true`. Privacy preferences still take precedence. The script reports its random distinct ID for ingestion queries. Query actual PostHog events for that ID and marker to confirm delivery; HTTP success alone is not sufficient. These events are tests, excluded from the customer dashboard, and still count toward the shared event allowance. Keep ordinary acceptance tests in default offline mode.
