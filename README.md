# Greenskeeper website

Premium static marketing site and searchable golf journal for https://getgreenskeeper.com. No npm dependencies or database. The supplied Canvas screenshot is in `images/canvas-preview.png`.

## Preview and edit

```sh
python3 scripts/build.py
python3 -m http.server 4173
```

Open http://localhost:4173. Edit `templates/home.html` for homepage copy, `assets/site.css` for styling, and `content/posts/*.json` for articles; then rebuild. `index.html`, `home.html`, and `blog/` are generated. Existing legal and support documents are preserved. `home.html` stays available with the root canonical URL for old links.

Articles render as complete HTML without JavaScript, with unique titles/descriptions, canonicals, BlogPosting metadata, linked sources, related guides, and a small product CTA after the article. Search and category filtering enhance the journal when JavaScript is available. Illustrations are decorative, not photos of the named courses. Article read times are calculated from content.

## GitHub Pages setup

1. Push these changes to `main` in `j5ke/greenskeeper`.
2. In repository **Settings → Pages**, set the build source to **GitHub Actions**. Keep the custom domain set to `getgreenskeeper.com` and enable HTTPS after DNS validation. `CNAME` is included. Existing working DNS at Vercel does not need to change.
3. The included workflow builds and deploys on pushes to main, or through **Actions → Website and daily golf journal → Run workflow**. The artifact contains only public site files, excluding scripts, drafts, and credentials.

GitHub deployment reference: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

## Enable daily AI publishing

1. Add repository Actions secret `OPENAI_API_KEY` with an API key from a funded OpenAI API project. Never put this key in the website, repository, or browser.
2. Add repository Actions variable `AI_PUBLISHING_ENABLED` with value `true`.
3. Optionally set Actions variable `OPENAI_MODEL`; the default is `gpt-4.1`.
4. Ensure repository rules allow the workflow to push generated articles to `main`. If main requires PRs, use a PR-based publishing process before enabling the timer; the direct-push workflow deliberately fails rather than bypassing branch protections.
5. Manually run the workflow with **Generate one researched article** checked to verify the API key and deployment before leaving it unattended.

The schedule is daily at **13:23 UTC** (7:23 a.m. MDT / 6:23 a.m. MST). GitHub schedules can run late and scheduled workflows in inactive public repos can be disabled by GitHub. An exhausted topic queue or failed research causes a visible failed Actions run; it does not publish a filler article. Set `AI_PUBLISHING_ENABLED=false` to pause scheduled generation; ordinary deployments still work.

The timer uses two server-side Responses API calls: web research with source metadata, then JSON article composition. It consumes paid API usage. It requires 600–1800 body words, at least three URLs from the actual research, valid metadata, and unique titles/slugs; it skips another AI article on the same UTC day. New posts carry an AI-assistance note. These checks validate structure and source provenance, not every factual claim. Review early posts and periodically audit course access and booking advice. Never promise search rankings. Official integration reference: https://developers.openai.com/api/docs/guides/tools-web-search

`content/topics.json` contains 30 destination briefs. Add unique IDs and distinct topics before the queue runs out. Published posts retain their `topic_id`, so successful topics are not repeated. Failed runs leave the topic available for retry. The final CTA comes from the template; generated article bodies cannot promote Greenskeeper.

To push content from another daily AI service, add a JSON file matching an existing post under `content/posts/`, run tests and `python3 scripts/build.py`, then push to `main`. GitHub Pages deploys it with the same layout and SEO features. There is intentionally no unauthenticated browser publishing endpoint.

## Verification

```sh
python3 -m unittest discover -s tests -v
node --check assets/journal.js
python3 scripts/package_site.py
```

Live API generation and production deployment require the GitHub configuration above; local tests mock AI responses and do not spend API credits.
