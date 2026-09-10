import copy
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch
from urllib.parse import urlparse, unquote
from xml.etree import ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import build
import generate_post as generator

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links=[]
        self.ids=set()
        self.h1=0
    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs)
        if tag=='h1': self.h1+=1
        if 'id' in attrs: self.ids.add(attrs['id'])
        if tag in ('a','img','script','link'):
            url=attrs.get('href',attrs.get('src',''))
            if url: self.links.append(url)

class SiteTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.root=Path(self.temp.name)
        for directory in ('templates','content','assets','images'):
            shutil.copytree(build.ROOT/directory,self.root/directory)
        for name in ('site.json','support.html','privacy.html','terms.html'):
            shutil.copy2(build.ROOT/name,self.root/name)
        self.post=copy.deepcopy(build.read_posts()[0])
        self.post.pop('ai_assisted',None)
        self.post.pop('topic_id',None)
        self.post['date']='2026-01-01'
        self.post['slug']='fixture-golf-guide'
        # Keep tests independent of today's scheduled post and consumed topic queue.
        for article in (self.root/'content/posts').glob('*.json'):
            article.unlink()
        (self.root/'content/posts/fixture-golf-guide.json').write_text(json.dumps(self.post))
    def tearDown(self):
        self.temp.cleanup()
    def test_build_links_metadata_and_sitemap(self):
        build.build(self.root)
        pages=[self.root/'index.html',self.root/'home.html']+list((self.root/'blog').rglob('*.html'))
        for page in pages:
            with self.subTest(page=page):
                source=page.read_text()
                parsed=Links();parsed.feed(source)
                self.assertEqual(parsed.h1,1)
                self.assertIn('rel="canonical"',source)
                self.assertNotIn('{{',source)
                for link in parsed.links:
                    url=urlparse(link)
                    if url.scheme or url.netloc: continue
                    target=page.parent/unquote(url.path) if url.path else page
                    if target.is_dir(): target=target/'index.html'
                    self.assertTrue(target.exists(),f'{page}: {link}')
                    if url.fragment and target.suffix=='.html':
                        target_parser=Links();target_parser.feed(target.read_text())
                        self.assertIn(url.fragment,target_parser.ids)
        sitemap=ET.parse(self.root/'sitemap.xml')
        locations=[x.text for x in sitemap.findall('.//{*}loc')]
        self.assertEqual(len(locations),len(build.read_posts(self.root))+2)
        self.assertTrue(all(x.startswith('https://getgreenskeeper.com/') for x in locations))
    def test_article_product_link_only_at_end(self):
        text=build.article_page(self.post,[self.post],json.loads((self.root/'site.json').read_text()))
        self.assertEqual(text.count('apps.apple.com'),1)
        self.assertGreater(text.index('apps.apple.com'),text.index('class="article-cta"'))
        self.assertIn('BlogPosting',text)
    def test_homepage_uses_real_badge_collection(self):
        build.build(self.root)
        source=(self.root/'index.html').read_text()
        badges=('badge-island-green.png','badge-eagle.png','badge-lakeside.png','badge-coastal.png','badge-fairway.png','badge-golfer.png','badge-sunrise.png')
        for badge in badges:
            self.assertIn('images/'+badge,source)
            self.assertTrue((self.root/'images'/badge).exists())
        self.assertEqual(source.count('class="real-badge '),7)
        self.assertGreaterEqual(source.count('class="sprinkle '),8)
    def test_escape_untrusted_article(self):
        self.post['title']='<script>alert(1)</script>'
        self.post['sections'][0]['paragraphs']=['<img src=x onerror=alert(1)>']
        text=build.article_page(self.post,[self.post],json.loads((self.root/'site.json').read_text()))
        self.assertNotIn('<script>alert',text)
        self.assertNotIn('<img src=x',text)
        self.assertIn('&lt;img',text)
    def test_reject_unsafe_slug_and_links(self):
        self.post['slug']='../../escape'
        with self.assertRaises(ValueError): build.validate(self.post)
        self.post['slug']='safe-slug'
        self.post['sections'][0]['sources']=[{'title':'Unsafe','url':'javascript:alert(1)'}]
        with self.assertRaises(ValueError): build.validate(self.post)
    def test_reject_duplicate_slugs(self):
        (self.root/'content/posts/duplicate.json').write_text(json.dumps(self.post))
        with self.assertRaises(ValueError): build.read_posts(self.root)
    def test_ai_incomplete_response_fails(self):
        with self.assertRaises(ValueError): generator.response_text({'status':'incomplete'})
    def test_missing_api_key_fails_without_network(self):
        with patch.dict('os.environ',{},clear=True),patch.object(generator,'urlopen') as network:
            with self.assertRaises(ValueError): generator.request_api({})
            network.assert_not_called()
    def test_same_day_rerun_has_no_api_cost(self):
        self.post.update(ai_assisted=True,date=datetime.now(timezone.utc).date().isoformat())
        with patch.object(generator,'read_posts',return_value=[self.post]),patch.object(generator,'request_api') as api:
            generator.main(self.root)
            api.assert_not_called()
    def valid_generated(self):
        post=copy.deepcopy(self.post)
        post.update(slug='new-distinct-guide',title='A distinct researched golf guide',category='Destinations')
        post['sections']=[{'heading':f'Course {i}','paragraphs':['Useful course comparison and planning detail. '*40], 'sources':[{'title':f'Course {i} official','url':f'https://example.com/course-{i}'}]} for i in range(3)]
        return post
    def test_generated_quality_checks(self):
        post=self.valid_generated()
        urls={s['sources'][0]['url'] for s in post['sections']}
        generator.check_generated(post,[],urls)
        with self.assertRaises(ValueError): generator.check_generated(post,[post],urls)
        with self.assertRaises(ValueError): generator.check_generated(post,[],{'https://example.com/other'})
        post['intro']='Download Greenskeeper today'
        with self.assertRaises(ValueError): generator.check_generated(post,[],urls)
    def test_generation_writes_once_after_valid_research(self):
        post=self.valid_generated()
        urls=[{'url':s['sources'][0]['url']} for s in post['sections']]
        research={'status':'completed','output':[{'type':'web_search_call','action':{'sources':urls}},{'type':'message','content':[{'type':'output_text','text':'Verified research notes.'}]}]}
        answer={'status':'completed','output':[{'type':'message','content':[{'type':'output_text','text':json.dumps(post)}]}]}
        with patch.object(generator,'request_api',side_effect=[research,answer]) as api:
            generator.main(self.root)
            generator.main(self.root)
            self.assertEqual(api.call_count,2)
        saved=json.loads((self.root/'content/posts/new-distinct-guide.json').read_text())
        self.assertTrue(saved['ai_assisted'])
        self.assertEqual(saved['topic_id'],'destination-01')
    def test_failure_never_writes_article(self):
        before=set((self.root/'content/posts').iterdir())
        with patch.object(generator,'request_api',return_value={'status':'completed','output':[]}):
            with self.assertRaises(ValueError): generator.main(self.root)
        self.assertEqual(before,set((self.root/'content/posts').iterdir()))
    def test_exhausted_queue_fails_before_api(self):
        (self.root/'content/topics.json').write_text('[]')
        with patch.object(generator,'request_api') as api:
            with self.assertRaises(ValueError): generator.main(self.root)
            api.assert_not_called()

if __name__=='__main__': unittest.main()
