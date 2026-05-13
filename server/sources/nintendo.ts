import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import type { SourceGetter } from "#/types"
import { defineSource } from "#/utils/source"

const FamiboardsBaseURL = "https://famiboards.com"
const FamitsuBaseURL = "https://www.famitsu.com"
type FamiboardsThread = NewsItem & { replies: number, views: number }

function cleanText(value: unknown) {
  return load(`<span>${String(value ?? "")}</span>`).text().replace(/\s+/g, " ").trim()
}

function parseCompactNumber(value: string) {
  const text = value.replace(/,/g, "").trim()
  if (!text || text === "–") return 0
  const match = text.match(/^([\d.]+)\s*([KM])?$/i)
  if (!match) return Number.parseInt(text, 10) || 0
  const num = Number(match[1])
  const unit = match[2]?.toUpperCase()
  if (unit === "M") return Math.round(num * 1_000_000)
  if (unit === "K") return Math.round(num * 1_000)
  return num
}

function withSource(source: string, item: NewsItem): NewsItem {
  return {
    ...item,
    source,
  }
}

function rssSource(source: string, url: string, limit?: number): SourceGetter {
  return async () => {
    const data = await rss2json(url)
    if (!data?.items.length) throw new Error(`Cannot fetch ${source} RSS data`)

    return data.items.slice(0, limit).map(item => withSource(source, {
      id: (item as any).id ?? item.link,
      title: cleanText(item.title),
      url: item.link,
      pubDate: item.created,
    }))
  }
}

function redditTopDaySource(source: string, subreddit: string): SourceGetter {
  return async () => {
    const since = Date.now() - 24 * 60 * 60 * 1000
    const data = await rss2json(`https://www.reddit.com/r/${subreddit}/top/.rss?t=day&limit=25`)
    if (!data?.items.length) throw new Error(`Cannot fetch ${source} RSS data`)

    return data.items
      .filter(item => item.created && new Date(item.created).getTime() >= since)
      .slice(0, 10)
      .map(item => withSource(source, {
        id: (item as any).id ?? item.link,
        title: cleanText(item.title),
        url: item.link,
        pubDate: item.created,
      }))
  }
}

async function fetchFamiboardsPage(page: number) {
  const path = page === 1
    ? "/forums/gaming/?order=last_post_date&direction=desc"
    : `/forums/gaming/page-${page}?order=last_post_date&direction=desc`
  const html = await myFetch(new URL(path, FamiboardsBaseURL).toString())
  const $ = load(String(html))
  const since = Date.now() - 24 * 60 * 60 * 1000
  const items: FamiboardsThread[] = []

  $(".js-threadList > .structItem--thread").each((_, el) => {
    const item = $(el)
    const link = item.find(".structItem-title a[data-tp-primary]").first()
    const title = cleanText(link.text())
    const href = link.attr("href")
    const startTime = item.find(".structItem-startDate time").attr("datetime")
    const latestTime = item.find(".structItem-latestDate").attr("datetime")
    const meta = item.find(".structItem-cell--meta dd").map((_, dd) => cleanText($(dd).text())).get()
    const createdAt = startTime ? new Date(startTime).getTime() : Number.NaN
    if (!title || !href || !Number.isFinite(createdAt) || createdAt < since) return

    const replies = parseCompactNumber(meta[0] ?? "")
    const views = parseCompactNumber(meta[1] ?? "")
    items.push({
      ...withSource("Famiboards", {
        id: href,
        title,
        url: new URL(href, FamiboardsBaseURL).toString(),
        pubDate: startTime,
        extra: {
          info: `${replies} replies / ${views} views`,
          date: latestTime,
        },
      }),
      replies,
      views,
    })
  })

  return items
}

async function fetchFamiboardsHtml24h() {
  const pages = await Promise.all([1, 2, 3, 4, 5].map(fetchFamiboardsPage))
  const unique = new Map<string | number, FamiboardsThread>()
  pages.flat().forEach(item => unique.set(item.id, item))
  const items = [...unique.values()]
    .sort((a, b) => b.replies - a.replies || b.views - a.views)
    .map(({ replies, views, ...item }) => item)
    .slice(0, 10)

  if (!items.length) throw new Error("Cannot parse Famiboards Gaming 24h threads")
  return items
}

const famiboardsGaming24h: SourceGetter = async () => {
  try {
    return await fetchFamiboardsHtml24h()
  } catch (e) {
    if (process.env.FAMIBOARDS_RSS_FALLBACK !== "true") throw e
  }

  const since = Date.now() - 24 * 60 * 60 * 1000
  const data = await rss2json(`${FamiboardsBaseURL}/forums/gaming/index.rss`, {
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml, */*",
      "Accept-Language": "en-US,en;q=0.9",
    },
  })
  const items = data?.items
    .filter(item => item.created && new Date(item.created).getTime() >= since)
    .slice(0, 10)
    .map(item => withSource("Famiboards", {
      id: (item as any).id ?? item.link,
      title: cleanText(item.title),
      url: item.link,
      pubDate: item.created,
    })) ?? []

  if (!items.length) throw new Error("Cannot parse Famiboards Gaming 24h threads")
  return items
}

function famitsuArticleUrl(item: { id: string | number, publishedAt?: string | null, redirectUrl?: string | null }) {
  if (item.redirectUrl) return item.redirectUrl
  const date = item.publishedAt ? new Date(item.publishedAt) : new Date()
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  return `${FamitsuBaseURL}/article/${year}${month}/${item.id}`
}

const famitsuSwitch: SourceGetter = async () => {
  const html = await myFetch(`${FamitsuBaseURL}/category/switch/page/1`)
  const $ = load(String(html))
  const nextData = $("#__NEXT_DATA__").text()
  const data = JSON.parse(nextData)
  const articles = data?.props?.pageProps?.categoryArticleDataForPc
  if (!Array.isArray(articles) || !articles.length) throw new Error("Cannot parse Famitsu Switch articles")

  return articles
    .filter(item => item?.title && item?.publishedAt && !item?.isPr)
    .slice(0, 30)
    .map(item => withSource("Famitsu Switch", {
      id: item.id,
      title: cleanText(item.title),
      url: famitsuArticleUrl(item),
      pubDate: item.publishedAt,
    }))
}

function extractNintendoUrl(article: Record<string, any>) {
  const relativeUrl = article["url({\"relative\":true})"] ?? article.url ?? article.slug
  return new URL(relativeUrl, "https://www.nintendo.com").toString()
}

const nintendoOfficial: SourceGetter = async () => {
  const html = await myFetch("https://www.nintendo.com/us/whatsnew/")
  const $ = load(String(html))
  const nextData = $("#__NEXT_DATA__").text()
  const data = JSON.parse(nextData)
  const state = data?.props?.pageProps?.initialApolloState
  const root = state?.ROOT_QUERY
  const collectionKey = root && Object.keys(root).find(key => key.startsWith("newsArticles("))
  const refs = collectionKey ? root[collectionKey]?.items : undefined
  if (!Array.isArray(refs) || !refs.length) throw new Error("Cannot parse Nintendo official news")

  return refs
    .map((ref: any) => state?.[ref?.__ref])
    .filter(Boolean)
    .map((article: Record<string, any>) => withSource("任天堂美国", {
      id: article.id ?? article.slug,
      title: cleanText(article.title),
      url: extractNintendoUrl(article),
      pubDate: article.publishDate,
    }))
}

const nintendoHongKong: SourceGetter = async () => {
  const html = await myFetch("https://www.nintendo.com/hk/topics/")
  const $ = load(String(html))
  const items: NewsItem[] = []

  $(".ncmn-softUnit--list a.ncmn-u-linkbox").each((_, el) => {
    const item = $(el)
    const href = item.attr("href")
    const title = cleanText(item.find(".ncmn-softUnit__name").first().text())
    const date = cleanText(item.find(".ncmn-softUnit__release").first().text())

    if (!href || !title) return
    const url = new URL(href, "https://www.nintendo.com").toString()
    items.push(withSource("任天堂香港", {
      id: href,
      title,
      url,
      pubDate: date ? new Date(date.replace(/\./g, "-")).toISOString() : undefined,
    }))
  })

  if (!items.length) throw new Error("Cannot parse Nintendo Hong Kong topics")
  return items
}

export default defineSource({
  "nintendo-official": nintendoOfficial,
  "nintendo-europe": rssSource("Nintendo UK / Europe", "https://www.nintendo.co.uk/news.xml"),
  "nintendo-japan": rssSource("Nintendo Japan", "https://www.nintendo.co.jp/news/whatsnew.xml"),
  "nintendo-hongkong": nintendoHongKong,
  "nintendo-life": rssSource("Nintendo Life", "https://www.nintendolife.com/feeds/latest"),
  "nintendo-everything": rssSource("Nintendo Everything", "https://nintendoeverything.com/feed"),
  "gonintendo": rssSource("GoNintendo", "https://gonintendo.com/feeds/all.xml"),
  "my-nintendo-news": rssSource("My Nintendo News", "https://mynintendonews.com/feed"),
  "ninten-switch": rssSource("Ninten Switch", "https://ninten-switch.com/feed"),
  "4gamer-switch": rssSource("4Gamer Switch", "https://www.4gamer.net/rss/nintendo_switch/nintendo_switch_news.xml"),
  "game-watch": rssSource("GAME Watch", "https://game.watch.impress.co.jp/data/rss/1.0/gmw/feed.rdf"),
  "reddit-switch": redditTopDaySource("Reddit Switch", "NintendoSwitch"),
  "reddit-switch2": redditTopDaySource("Reddit Switch 2", "NintendoSwitch2"),
  "famiboards-gaming": famiboardsGaming24h,
  "famitsu-switch": famitsuSwitch,
})
