# Local review — Greenskeeper free tools and Swingalysis

Both repositories were fetched before work. No changes have been pushed, merged to main, or deployed.

## Greenskeeper

- Branch: `codex/free-golf-tools`
- Checkout: `/Users/jakelevato/Documents/Swift/greenskeeper`
- Preview: http://127.0.0.1:4173/tools/
- Rebuild: `python3 scripts/build.py`
- Serve: `python3 -m http.server 4173 --bind 127.0.0.1`
- Release artifact: `python3 scripts/package_site.py` (output `_site/`)

Try the planner's example trip, add an overlapping event, edit it, and download the calendar and JSON file. The budget can reuse the saved trip's group size and nights. Blank prices remain unknown. The daylight calculator supports presets and exact coordinates/timezones; check 9 versus 18 holes and late tee times. Membership compares first-year and recurring costs. Swingalysis's page links to its existing domain and editor.

## Swingalysis

- Branch: `codex/greenskeeper-branding`
- Isolated checkout: `/private/tmp/swing-greenskeeper-branding`
- Preview: http://127.0.0.1:3010/
- Original checkout: `/Users/jakelevato/Documents/Projects/swing` — its existing analyzer and end-to-end test edits were preserved.
- Install with the pinned pnpm 10.34.5: `pnpm install --frozen-lockfile`
- From the isolated checkout: `pnpm check`
- Production build: `pnpm --filter @swingalysis/web exec next build --webpack`
- Preview: `pnpm --filter @swingalysis/web start --hostname 127.0.0.1 --port 3010`

The default Turbopack build stalled in the local sandbox; the supported Next.js production Webpack build completed. No bundler configuration was changed for deployment.

The rebrand uses the existing Greenskeeper logo, course badges, Canvas image, colors, fonts, and pill-shaped buttons. Check the landing page, recording guide, privacy/accuracy pages, and editor. The invitation opens from “Meet your golf memory book” or the editor's Greenskeeper button. Successful screenshot/video exports offer a nonblocking nudge; dismissing it suppresses repeat invitations for that browser session. Escape closes the dialog and restores keyboard focus. There is no new telemetry or cross-app video transfer.

Public cross-site links intentionally still point to the production domains. Use the two local URLs above to review both feature branches before releasing them together. No local-only URLs are baked into published pages.

## Verification

- Greenskeeper: Python site-generation/link/metadata tests, Node calculation tests, and headless Chromium frontend/accessibility checks. The browser suite records desktop and 390px phone screenshots.
- Swingalysis: formatting, ESLint, TypeScript, existing unit tests, production build, and Chromium end-to-end tests, including the new invitation/dismissal and mobile branding flows.
- Screenshots from the local pass: `/private/tmp/greenskeeper-tools-qa/`.
- All browser work is headless. No native applications or user browser sessions were controlled.

There is no ranking guarantee or SEO campaign in this change. Existing page-generation metadata is preserved; a later SEO pass can refine content and query targeting.

### Completed check results

- Greenskeeper: 13 Python tests and 14 calculation tests passed. The headless browser suite passed tool interactions, storage fallback, responsive overflow/image checks, and WCAG A/AA checks on the hub and all five tool pages. Twelve desktop/phone screenshots were captured.
- Swingalysis: formatting, lint, TypeScript, 41 unit tests, and the production Webpack build passed. All 18 Chromium end-to-end tests passed, including serious/critical accessibility checks across the public pages and editor.
- Desktop and phone screenshots were visually reviewed. Contrast and mobile-brand visibility issues identified during that pass were corrected and covered by the passing final accessibility/layout tests.
