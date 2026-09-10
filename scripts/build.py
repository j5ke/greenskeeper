"""Dependency-free static site builder. Content is text, never executable HTML."""
import argparse
import html
import json
import math
import os
from pathlib import Path
import re
from datetime import date, datetime, timezone
from urllib.parse import urlparse
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
CATEGORIES = ('Bucket lists', 'Destinations', 'Trip planning')
TONES = ('sage', 'coast', 'terracotta')

def esc(value):
    return html.escape(str(value), quote=True)

def safe_url(value):
    parsed = urlparse(value)
    if parsed.scheme != 'https' or not parsed.netloc or parsed.username or parsed.password:
        raise ValueError('Source URLs must be absolute HTTPS URLs')
    return value

def validate(post):
    for field in ('slug', 'title', 'description', 'date', 'category', 'intro', 'sections'):
        if field not in post:
            raise ValueError(f'Missing {field}')
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', post['slug']):
        raise ValueError('Invalid slug')
    for field in ('title', 'description', 'intro'):
        if not isinstance(post[field], str) or not post[field].strip():
            raise ValueError(f'Invalid {field}')
    if date.fromisoformat(post['date']) > datetime.now(timezone.utc).date():
        raise ValueError('Publication date cannot be in the future')
    if post['category'] not in CATEGORIES or post.get('tone', 'sage') not in TONES:
        raise ValueError('Invalid category or artwork tone')
    if not isinstance(post['sections'], list) or len(post['sections']) < 3:
        raise ValueError('At least three useful sections required')
    for section in post['sections']:
        if not isinstance(section.get('heading'), str) or not section['heading'].strip():
            raise ValueError('Section heading required')
        if not isinstance(section.get('paragraphs'), list) or not section['paragraphs']:
            raise ValueError('Section paragraphs required')
        if any(not isinstance(p, str) or not p.strip() for p in section['paragraphs']):
            raise ValueError('Empty paragraph')
        for source in section.get('sources', []):
            safe_url(source['url'])
            if not source.get('title'):
                raise ValueError('Source title required')
    return post

def read_posts(root=ROOT):
    posts = [validate(json.loads(p.read_text())) for p in (root / 'content/posts').glob('*.json')]
    if len({p['slug'] for p in posts}) != len(posts):
        raise ValueError('Duplicate article slug')
    return sorted(posts, key=lambda p: (p['date'], p['slug']), reverse=True)

def minutes(post):
    words = len((' '.join([post['intro']] + [p for s in post['sections'] for p in s['paragraphs']])).split())
    return max(1, math.ceil(words / 200))

FLAG = '<svg viewBox="0 0 80 80" fill="none" aria-hidden="true"><ellipse cx="40" cy="63" rx="30" ry="10" stroke="currentColor"/><path d="M40 63V10l25 10-25 10" stroke="currentColor" stroke-width="2"/><circle cx="25" cy="57" r="3" fill="currentColor"/></svg>'
CONTOURS = '<svg class="contours" viewBox="0 0 500 650" fill="none" aria-hidden="true">' + ''.join(f'<ellipse cx="270" cy="330" rx="{r}" ry="{r*1.5}" stroke="currentColor" transform="rotate(-30 270 330)"/>' for r in range(80,550,36)) + '</svg>'

def artwork(post):
    return f'''<div class="post-art {esc(post.get('tone', 'sage'))}" aria-hidden="true"><svg viewBox="0 0 600 360" fill="none"><path d="M-40 310C100 80 220 380 390 80S680 160 640 10" stroke="currentColor" stroke-width="100" opacity=".12"/><path d="M-60 330C70 75 240 350 380 90S660 100 650 10" stroke="currentColor" stroke-width="1" opacity=".35"/><path d="M-20 350C90 105 260 380 410 120S690 130 680 40" stroke="currentColor" stroke-width="1" opacity=".35"/><ellipse cx="310" cy="210" rx="66" ry="25" fill="currentColor" opacity=".15"/><path d="M310 210V100l49 19-49 19" stroke="currentColor" stroke-width="3"/><circle cx="276" cy="202" r="6" fill="#fff"/></svg><span>{esc(post.get('location', post['category']))}</span></div>'''

def card(post, prefix=''):
    return f'''<article class="post-card" data-post data-category="{esc(post['category'])}" data-search="{esc((post['title']+' '+post['description']+' '+post.get('location','')).lower())}"><a href="{prefix}blog/{esc(post['slug'])}/">{artwork(post)}<span class="post-meta">{esc(post['category'])} &nbsp; / &nbsp; {minutes(post)} min read</span><h3>{esc(post['title'])}</h3><p>{esc(post['description'])}</p><span class="read-link">Read the guide ↗</span></a></article>'''

def page(title, description, body, config, path='', prefix='', schema=None, journal=False, article=False):
    base = config.get('url', '').rstrip('/')
    canonical = base + '/' + path if base else ''
    meta = f'<link rel="canonical" href="{esc(canonical)}"><meta property="og:url" content="{esc(canonical)}">' if base else ''
    structured = '<script type="application/ld+json">'+json.dumps(schema, ensure_ascii=False).replace('<', '\\u003c')+'</script>' if schema else ''
    download_nav = '' if article else f'<a class="button small" href="{esc(config["app_store_url"])}">Get the app ↗</a>'
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(title)}</title><meta name="description" content="{esc(description)}">{meta}<meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(description)}"><meta property="og:type" content="{'article' if article else 'website'}"><meta property="og:site_name" content="Greenskeeper"><meta name="twitter:card" content="summary"><link rel="icon" href="{prefix}images/greenskeeper-logo.png"><link rel="stylesheet" href="{prefix}assets/site.css">{structured}{'<script defer src="'+prefix+'assets/journal.js"></script>' if journal else ''}</head>
<body><a class="skip" href="#main">Skip to content</a><header class="wrap"><nav class="nav" aria-label="Main navigation"><a class="brand" href="{prefix or './'}"><img src="{prefix}images/greenskeeper-logo.png" width="36" height="36" alt="">Greenskeeper</a><div class="nav-links"><a class="about-link" href="{prefix}home.html#your-game">The app</a><a href="{prefix}blog/" {'aria-current="page"' if journal else ''}>Journal</a>{download_nav}</div></nav></header><main id="main">{body}</main><footer class="wrap"><div class="footer"><a class="brand" href="{prefix or './'}">Greenskeeper<span aria-hidden="true">↗</span></a><div class="footer-links"><a href="{prefix}blog/">Journal</a><a href="{prefix}support.html">Support</a><a href="{prefix}privacy.html">Privacy</a><a href="{prefix}terms.html">Terms</a></div></div><div class="copyright">© {date.today().year} Greenskeeper. For the love of the game.</div></footer></body></html>'''

def article_page(post, posts, config):
    prefix = '../../'
    toc = ''.join(f'<a href="#section-{i}">{esc(s["heading"])}</a>' for i,s in enumerate(post['sections']))
    sections = ''.join(f'<section id="section-{i}"><h2>{esc(s["heading"])}</h2>'+''.join(f'<p>{esc(p)}</p>' for p in s['paragraphs'])+''.join(f'<p><a class="source-link" href="{esc(source["url"])}">{esc(source["title"])} ↗</a></p>' for source in s.get('sources',[]))+'</section>' for i,s in enumerate(post['sections']))
    note = '<p class="editor-note">This guide was created with AI assistance using the linked sources. Course access, rates, and conditions can change; confirm details directly before booking.</p>' if post.get('ai_assisted') else '<p class="editor-note">Our guides are editorial starting points, not official rankings. Confirm current access, rates, and course conditions directly before booking.</p>'
    body = f'''<div class="wrap"><div class="breadcrumb"><a href="../">Journal</a> / {esc(post['category'])}</div><header class="article-head"><span class="eyebrow">{esc(post['category'])}</span><h1>{esc(post['title'])}</h1><p>{esc(post['description'])}</p><span class="post-meta">Greenskeeper Journal · <time datetime="{post['date']}">{date.fromisoformat(post['date']).strftime('%B %d, %Y')}</time> · {minutes(post)} min read</span></header><div class="article-layout"><aside class="toc" aria-label="In this guide"><strong>IN THIS GUIDE</strong>{toc}</aside><article class="article-body"><p>{esc(post['intro'])}</p>{sections}{note}<aside class="article-cta"><p>A few more courses for your “one day” list?</p><a href="{esc(config['app_store_url'])}">Keep your golf bucket list in Greenskeeper ↗</a></aside></article></div><section class="related"><h2>A little more inspiration.</h2>{{RELATED}}</section></div>'''
    body = body.replace('{RELATED}', '<div class="journal-grid">'+''.join(card(p,prefix) for p in [p for p in posts if p['slug'] != post['slug']][:3])+'</div>')
    schema = {'@context':'https://schema.org','@type':'BlogPosting','headline':post['title'],'description':post['description'],'datePublished':post['date'],'dateModified':post['date'],'author':{'@type':'Organization','name':'Greenskeeper Journal'},'publisher':{'@type':'Organization','name':'Greenskeeper'},'articleSection':post['category']}
    if config.get('url'):
        schema['mainEntityOfPage'] = config['url'].rstrip('/')+'/blog/'+post['slug']+'/'
    return page(post['title']+' | Greenskeeper Journal',post['description'],body,config,'blog/'+post['slug']+'/',prefix,schema,article=True)

def build(root=ROOT, output=None):
    output = output or root
    config = json.loads((root/'site.json').read_text())
    config['url'] = os.environ.get('SITE_URL', config.get('url','')).rstrip('/')
    if config['url']:
        safe_url(config['url'])
    posts = read_posts(root)
    download = f'<a class="button" href="{esc(config["app_store_url"])}">Download for iPhone <span aria-hidden="true">↗</span></a>'
    home = (root/'templates/home.html').read_text()
    for key,value in {'DOWNLOAD':download,'CONTOURS':CONTOURS,'FLAG':FLAG,'APP_URL':esc(config['app_store_url']),'POSTS':''.join(card(p) for p in posts[:3])}.items():
        home = home.replace('{{'+key+'}}',value)
    output.mkdir(parents=True,exist_ok=True)
    home = page('Greenskeeper — Your Golf Course Memory Book','Track the courses you’ve played, build your golf bucket list, and share your journey. Download Greenskeeper for iPhone.',home,config)
    (output/'index.html').write_text(home)
    (output/'home.html').write_text(home)
    filters = ''.join(f'<button class="filter" data-filter="{c}" aria-pressed="{str(c=="All").lower()}">{c}</button>' for c in ('All',)+CATEGORIES)
    body = f'''<section class="wrap"><header class="journal-header"><span class="eyebrow">The Greenskeeper Journal</span><h1>Good golf.<br>Great places.</h1><p>Bucket-list courses, destinations worth the detour, and ideas for your next golf trip. Find your next “I have to play there.”</p></header><div class="journal-tools" hidden><div class="filters" aria-label="Filter guides">{filters}</div><label><span class="sr-only">Search golf guides</span><input class="search" type="search" id="journal-search" placeholder="Search places, courses…"></label></div><p class="sr-only" id="result-count" aria-live="polite"></p><div class="journal-grid journal-list">{''.join(card(p,'../') for p in posts)}</div><p class="empty" id="empty-results" hidden>No guides found. Try another destination or choose “All.”</p></section>'''
    (output/'blog').mkdir(exist_ok=True)
    (output/'blog/index.html').write_text(page('Golf Bucket Lists & Destination Guides | Greenskeeper Journal','Discover bucket-list golf courses, destination guides, and ideas for your next golf trip in the Greenskeeper Journal.',body,config,'blog/','../',journal=True))
    for post in posts:
        folder = output/'blog'/post['slug']
        folder.mkdir(exist_ok=True)
        (folder/'index.html').write_text(article_page(post,posts,config))
    (output/'.nojekyll').write_text('')
    if config['url']:
        xml = ET.Element('urlset',xmlns='http://www.sitemaps.org/schemas/sitemap/0.9')
        for path in ['', 'blog/']+[f'blog/{p["slug"]}/' for p in posts]:
            item=ET.SubElement(xml,'url')
            ET.SubElement(item,'loc').text=config['url']+'/'+path
        (output/'sitemap.xml').write_bytes(ET.tostring(xml,encoding='utf-8',xml_declaration=True))
        (output/'robots.txt').write_text(f'User-agent: *\nAllow: /\nSitemap: {config["url"]}/sitemap.xml\n')
    else:
        (output/'robots.txt').write_text('User-agent: *\nAllow: /\n')
    print(f'Built homepage, journal, and {len(posts)} articles.')

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',type=Path)
    args=parser.parse_args()
    build(output=args.output)
