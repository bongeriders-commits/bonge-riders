// api/news.js
// Server-side RSS aggregator. Runs on Vercel's Node runtime, so these fetches
// are server-to-server — no browser CORS restrictions apply, and we don't
// depend on any third-party CORS proxy (which kept failing in production).

const SOURCES = [
  { id: 'aljazeera', name: 'Al Jazeera',    cat: 'world',    url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { id: 'bbc',       name: 'BBC News',      cat: 'world',    url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { id: 'guardian',  name: 'The Guardian',  cat: 'world',    url: 'https://www.theguardian.com/world/rss' },
  { id: 'npr',       name: 'NPR',           cat: 'world',    url: 'https://feeds.npr.org/1004/rss.xml' },
  { id: 'nation',    name: 'Nation Kenya',  cat: 'kenya',    url: 'https://nation.africa/kenya/rss' },
  { id: 'standard',  name: 'The Standard',  cat: 'kenya',    url: 'https://www.standardmedia.co.ke/rss/headlines.php' },
  { id: 'capitalke', name: 'Capital FM',    cat: 'kenya',    url: 'https://www.capitalfm.co.ke/news/feed/' },
  { id: 'bbcbiz',    name: 'BBC Business',  cat: 'business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { id: 'aljbiz',    name: 'AJ Economy',    cat: 'business', url: 'https://www.aljazeera.com/xml/rss/economy.xml' },
  { id: 'bbcsport',  name: 'BBC Sport',     cat: 'sports',   url: 'https://feeds.bbci.co.uk/sport/rss.xml' },
];

function tag(itemXml, tagName) {
  // Grabs the first <tagName>...</tagName> (with any namespace prefix) —
  // handles both CDATA and plain text content.
  const re = new RegExp(`<(?:[\\w]+:)?${tagName}[^>]*>([\\s\\S]*?)<\\/(?:[\\w]+:)?${tagName}>`, 'i');
  const m = itemXml.match(re);
  if (!m) return null;
  return m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
}

function attr(itemXml, tagName, attrName) {
  const re = new RegExp(`<(?:[\\w]+:)?${tagName}[^>]*\\s${attrName}=["']([^"']+)["'][^>]*/?>`, 'i');
  const m = itemXml.match(re);
  return m ? m[1] : null;
}

function extractImage(itemXml, description) {
  const media = attr(itemXml, 'media:content', 'url') || attr(itemXml, 'media:thumbnail', 'url');
  if (media) return media;
  const enclosureUrl = attr(itemXml, 'enclosure', 'url');
  if (enclosureUrl && /image|jpg|jpeg|png|gif/i.test(itemXml.match(/<enclosure[^>]*>/i)?.[0] || '')) return enclosureUrl;
  if (description) {
    const m = description.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (m) return m[1];
  }
  return null;
}

async function fetchSource(source) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BongeRidersNewsBot/1.0)' },
    });
    clearTimeout(timeout);
    if (!res.ok) return { source, articles: [], ok: false };

    const xml = await res.text();
    const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
    const articles = itemBlocks.slice(0, 12).map((block) => {
      const title = tag(block, 'title');
      const link = tag(block, 'link');
      const pubDateRaw = tag(block, 'pubDate') || tag(block, 'date');
      const description = tag(block, 'description');
      const img = extractImage(block, description);
      return {
        title,
        link,
        date: pubDateRaw ? new Date(pubDateRaw).toISOString() : null,
        source: source.name,
        cat: source.cat,
        img,
      };
    }).filter((a) => a.title && a.link);

    return { source, articles, ok: true };
  } catch (e) {
    return { source, articles: [], ok: false };
  }
}

module.exports = async (req, res) => {
  const cat = (req.query.cat || 'all').toLowerCase();
  const wanted = cat === 'all' ? SOURCES : SOURCES.filter((s) => s.cat === cat);

  const results = await Promise.all(wanted.map(fetchSource));

  const articles = results
    .flatMap((r) => r.articles)
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  const sources = results.map((r) => ({ id: r.source.id, name: r.source.name, cat: r.source.cat, ok: r.ok }));

  // Cache at Vercel's edge for 10 minutes, serve stale for up to an hour
  // while revalidating in the background — keeps this fast and cheap.
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ articles, sources });
};
