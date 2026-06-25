import { mkdir, writeFile } from "node:fs/promises";

const OUTPUT_PATH = new URL("../data/latest-updates.json", import.meta.url);
const MAX_ITEMS = 40;

const queries = [
  { label: "国交省 ウォーターPPP", query: "ウォーターPPP 国土交通省" },
  { label: "国交省 群マネ", query: "群マネ 国土交通省 インフラ" },
  { label: "国のHP ウォーターPPP", query: "ウォーターPPP site:go.jp OR site:mlit.go.jp" },
  { label: "コンセッション 水道", query: "水道 コンセッション PPP PFI" },
  { label: "管理・更新一体マネジメント", query: "管理・更新一体マネジメント方式 ウォーターPPP" },
  { label: "下水道 PPP", query: "下水道 ウォーターPPP コンセッション 管理更新一体" },
  { label: "日経関連", query: "ウォーターPPP OR 水道 コンセッション site:nikkei.com" },
  { label: "日経 群マネ関連", query: "群マネ インフラ site:nikkei.com" },
  { label: "ニュース横断", query: "ウォーターPPP OR 群マネ OR 水道コンセッション" }
];

function decodeEntities(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function textBetween(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return decodeEntities(match?.[1] || "").trim();
}

function stripHtml(value) {
  return decodeEntities(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeGoogleNewsUrl(url) {
  try {
    const parsed = new URL(url);
    const nested = parsed.searchParams.get("url");
    return nested || url;
  } catch {
    return url;
  }
}

function parseRss(xml, sourceLabel, queryLabel) {
  return [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map(match => {
    const itemXml = match[0];
    const title = stripHtml(textBetween(itemXml, "title"));
    const url = normalizeGoogleNewsUrl(textBetween(itemXml, "link"));
    const publishedRaw = textBetween(itemXml, "pubDate");
    const publishedDate = publishedRaw ? new Date(publishedRaw) : null;
    const source = stripHtml(textBetween(itemXml, "source")) || sourceLabel;
    const description = stripHtml(textBetween(itemXml, "description"));

    return {
      title,
      url,
      source,
      query: queryLabel,
      published: Number.isNaN(publishedDate?.getTime()) ? publishedRaw : publishedDate.toISOString(),
      description
    };
  }).filter(item => item.title && item.url);
}

async function fetchGoogleNews(queryConfig) {
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", queryConfig.query);
  url.searchParams.set("hl", "ja");
  url.searchParams.set("gl", "JP");
  url.searchParams.set("ceid", "JP:ja");

  const response = await fetch(url, {
    headers: {
      "user-agent": "water-ppp-gunmane-map/1.0 (+https://github.com/)"
    }
  });

  if (!response.ok) {
    throw new Error(`${queryConfig.label}: HTTP ${response.status}`);
  }

  return parseRss(await response.text(), "Google News", queryConfig.label);
}

function dedupe(items) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const key = `${item.title.replace(/\s+/g, " ").trim()}|${item.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

function sortByPublishedDesc(items) {
  return [...items].sort((a, b) => {
    const aTime = Date.parse(a.published || "") || 0;
    const bTime = Date.parse(b.published || "") || 0;
    return bTime - aTime;
  });
}

async function main() {
  const errors = [];
  const batches = await Promise.all(queries.map(async queryConfig => {
    try {
      return await fetchGoogleNews(queryConfig);
    } catch (error) {
      errors.push({ source: queryConfig.label, message: error.message });
      return [];
    }
  }));

  const items = sortByPublishedDesc(dedupe(batches.flat())).slice(0, MAX_ITEMS);
  const payload = {
    generatedAt: new Date().toISOString(),
    updatePolicy: "GitHub Actionsで定期実行。Google News RSS検索を使い、国交省等の公的サイト、日経関連、一般ニュースの公開見出し・リンクを収集します。本文や有料記事は取得しません。",
    queries,
    errors,
    items
  };

  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Wrote ${items.length} items to ${OUTPUT_PATH.pathname}`);
  if (errors.length) {
    console.warn(`${errors.length} source(s) failed`, errors);
  }
}

await main();
