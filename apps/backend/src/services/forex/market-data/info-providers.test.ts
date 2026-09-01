import assert from 'node:assert/strict';
import { parseFaireconomyCalendar, parseRssItems } from './info-providers.js';

function testRss(): void {
  const items = parseRssItems(
    `<?xml version="1.0"?><rss><channel>
      <item><title><![CDATA[EUR rises]]></title><link>https://example.test/a</link><pubDate>Mon, 01 Sep 2026 12:00:00 GMT</pubDate></item>
      <item><title>USD falls</title><link>https://example.test/b</link><pubDate>Tue, 02 Sep 2026 12:00:00 GMT</pubDate></item>
    </channel></rss>`,
    40,
    'example.test'
  );
  assert.equal(items.length, 2);
  assert.equal(items[0]?.headline, 'EUR rises');
  assert.equal(items[0]?.source, 'example.test');
  assert.ok(items[0]?.time?.startsWith('2026-09-01'));
}

function testCalendar(): void {
  const events = parseFaireconomyCalendar([
    { title: 'CPI y/y', country: 'USD', date: '2026-09-01T12:00:00-04:00', impact: 'High', forecast: '2.1%', previous: '2.0%' },
    { title: 'Holiday', country: 'All', date: '2026-09-02T00:00:00-04:00', impact: 'Holiday', forecast: '', previous: '' },
    { title: '' },
  ]);
  assert.equal(events.length, 2);
  assert.equal(events[0]?.currency, 'USD');
  assert.equal(events[0]?.impact, 'High');
  assert.equal(events[0]?.forecast, '2.1%');
  assert.equal(events[0]?.actual, null);
  assert.equal(events[1]?.currency, null);
}

testRss();
testCalendar();
console.log('info-providers.test.ts ok');
