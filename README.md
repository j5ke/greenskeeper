# Greenskeeper website

Premium static marketing site and searchable golf journal for https://getgreenskeeper.com. No frontend runtime dependencies or database. Node dependencies are development-only browser test tools. The supplied Canvas screenshot is in `images/canvas-preview.png`.

## Preview and edit

```sh
python3 scripts/build.py
python3 -m http.server 4173
```

Open http://localhost:4173. Edit `templates/home.html` for homepage copy, `assets/site.css` for styling, and `content/posts/*.json` for articles; then rebuild. `index.html`, `home.html`, `blog/`, and `tools/` are generated. Edit `scripts/tools.py`, `assets/tools.js`, `assets/tools-core.js`, and `assets/tools.css` for the five tools. Existing legal and support documents are preserved. `home.html` stays available with the root canonical URL for old links.

Articles render as complete HTML without JavaScript, with unique titles/descriptions, canonicals, BlogPosting metadata, linked sources, related guides, and a small product CTA after the article. Search and category filtering enhance the journal when JavaScript is available. Illustrations are decorative, not photos of the named courses. Article read times are calculated from content.

## GitHub Pages setup

1. Push these changes to `main` in `j5ke/greenskeeper`.
2. In repository **Settings → Pages**, set the build source to **GitHub Actions**. Keep the custom domain set to `getgreenskeeper.com` and enable HTTPS after DNS validation. `CNAME` is included. Existing working DNS at Vercel does not need to change.
3. The included workflow builds and deploys on pushes to main, or through **Actions → Website deploy → Run workflow**. The artifact contains only public site files, excluding scripts, drafts, and credentials.

GitHub deployment reference: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

## Free tools

`/tools/` contains the trip planner, budget calculator, golf daylight calculator, membership break-even calculator, and Swingalysis by Greenskeeper introduction. They use the existing site assets, colors, and button styles. Interactions and calculations run in the browser.

- Trip plans support editing, conflict detection, browser saving, JSON import/export, calendar export, text copy, and print/PDF. Times use the selected trip timezone.
- Budgets support shared, per-person, per-night, and per-person-per-night prices, participant counts, currencies, day trips, a smaller-group scenario, and browser saving. Blank costs stay explicitly unknown. A saved planner draft can supply group size and nights.
- Daylight estimates use NOAA/Meeus solar equations, course coordinates, an IANA timezone, expected pace, and a buffer before sunset. City presets are approximate; custom coordinates and opt-in geolocation are supported. Polar conditions and date-line timezones are handled. Weather, terrain, and course closing hours are not forecast.
- Membership comparisons include annual dues, monthly fees/minimums, initiation fees, and per-round charges. First and later years are shown separately. Inputs are illustrative defaults until replaced.
- Swingalysis stays on its existing domain; the web editor already supports local video review and exports. There is no automatic app/project sync.

All drafts stay in this browser. JSON and text downloads are portable backups. No signup, telemetry, or new service is required. Source videos and photos are not uploaded by these tools.

## Article generation

The current GitHub workflow deploys on pushes to `main` or manual dispatch. Scheduled AI publishing was removed upstream. `scripts/generate_post.py` remains available for an explicitly configured manual process; it is not called by the deployment workflow. Existing JSON articles can be edited and rebuilt normally.

## Verification

```sh
python3 -m unittest discover -s tests -v
node --check assets/journal.js
python3 scripts/package_site.py
```

Live API generation and production deployment require the GitHub configuration above; local tests mock AI responses and do not spend API credits.


## Frontend checks and local review

Requires Node 22+ for the test tools (not for the published website):

```sh
npm ci
npm test
npx playwright install chromium
python3 scripts/build.py
python3 -m http.server 4173 --bind 127.0.0.1
# In another terminal:
npm run test:browser
```

The browser suite runs headlessly. It checks tool interactions, imports/exports, saved drafts, restricted storage, desktop/phone overflow, images, and WCAG A/AA accessibility. Screenshots go to `/private/tmp/greenskeeper-tools-qa` by default; set `QA_OUTPUT` to any writable directory on other platforms. Set `TOOLS_BASE_URL` to test a packaged preview, or `CHROMIUM_EXECUTABLE` to use an existing Chromium installation. The GitHub workflow lives in `.github/workflows/test-tools.yml`.

For the exact GitHub Pages artifact, run `python3 scripts/package_site.py` and serve `_site` instead of the repository root. The artifact includes tool routes/assets and excludes tests, source scripts, planning docs, and Node packages.

Feature work is on `codex/free-golf-tools`. Nothing from this branch deploys until it is merged to `main`. The companion Swingalysis work uses `codex/greenskeeper-branding`; see `docs/local-review.md` for both preview locations.
