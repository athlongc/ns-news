import type { NewsItem, SourceID, SourceResponse } from "@shared/types"
import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion, useInView } from "framer-motion"
import { useWindowSize } from "react-use"
import { forwardRef, useImperativeHandle } from "react"
import { OverlayScrollbar } from "../common/overlay-scrollbar"
import { titleModeAtom, type TitleMode } from "~/atoms"
import { safeParseString } from "~/utils"

export interface ItemsProps extends React.HTMLAttributes<HTMLDivElement> {
  id: SourceID
  /**
   * 是否显示透明度，拖动时原卡片的样式
   */
  isDragging?: boolean
}

interface NewsCardProps {
  id: SourceID
}

type TranslationMap = Record<string, string>

const TRANSLATION_CACHE_KEY = "title-translations.zh-CN"
const officialNintendoSourceIds: SourceID[] = [
  "nintendo-japan",
  "nintendo-hongkong",
  "nintendo-official",
  "nintendo-europe",
]
const sourceIconMap: Partial<Record<SourceID, string>> = {
  "4gamer-switch": "/icons/4gamer-switch.svg",
  "game-watch": "/icons/game-watch.svg",
  "reddit-switch": "/icons/reddit-switch.svg",
  "reddit-switch2": "/icons/reddit-switch.svg",
  "famiboards-gaming": "/icons/famiboards.svg",
  "famitsu-switch": "/icons/famitsu-switch.svg",
}

export const CardWrapper = forwardRef<HTMLElement, ItemsProps>(({ id, isDragging, style, ...props }, dndRef) => {
  const ref = useRef<HTMLDivElement>(null)
  const isNintendoTheme = sources[id].color === "nintendo"

  const inView = useInView(ref, {
    once: true,
  })

  useImperativeHandle(dndRef, () => ref.current! as HTMLDivElement)

  return (
    <div
      ref={ref}
      className={$(
        "flex flex-col h-500px rounded-2xl p-4 cursor-default",
        // "backdrop-blur-5",
        "transition-opacity-300",
        isDragging && "op-50",
        !isNintendoTheme && `bg-${sources[id].color}-500 dark:bg-${sources[id].color}-500 bg-op-90!`,
      )}
      style={{
        background: isNintendoTheme
          ? "linear-gradient(180deg, rgba(230, 0, 18, 0.26) 0%, rgba(230, 0, 18, 0.10) 90px, #202124 190px)"
          : undefined,
        border: isNintendoTheme ? "1px solid rgba(230, 0, 18, 0.34)" : undefined,
        boxShadow: isNintendoTheme ? "0 18px 45px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.05)" : undefined,
        transformOrigin: "50% 50%",
        ...style,
      }}
      {...props}
    >
      {inView && <NewsCard id={id} />}
    </div>
  )
})

function NewsCard({ id }: NewsCardProps) {
  const { refresh } = useRefetch()
  const titleMode = useAtomValue(titleModeAtom)
  const isNintendoTheme = sources[id].color === "nintendo"
  const { data, isFetching, isError } = useQuery({
    queryKey: ["source", id],
    queryFn: async ({ queryKey }) => {
      const id = queryKey[1] as SourceID
      let url = `/s?id=${id}`
      const headers: Record<string, any> = {}
      if (refetchSources.has(id)) {
        url = `/s?id=${id}&latest`
        const jwt = safeParseString(localStorage.getItem("jwt"))
        if (jwt) headers.Authorization = `Bearer ${jwt}`
        refetchSources.delete(id)
      } else if (cacheSources.has(id)) {
        // wait animation
        await delay(200)
        return cacheSources.get(id)
      }

      const response: SourceResponse = await myFetch(url, {
        headers,
      })

      function diff() {
        try {
          if (response.items && sources[id].type === "hottest" && cacheSources.has(id)) {
            response.items.forEach((item, i) => {
              const o = cacheSources.get(id)!.items.findIndex(k => k.id === item.id)
              item.extra = {
                ...item?.extra,
                diff: o === -1 ? undefined : o - i,
              }
            })
          }
        } catch (e) {
          console.error(e)
        }
      }

      diff()

      cacheSources.set(id, response)
      return response
    },
    placeholderData: prev => prev,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retry: false,
  })
  const titles = useMemo(() => {
    return data?.items?.map(item => decodeHtmlText(item.title).trim()).filter(Boolean) ?? []
  }, [data?.items])
  const { data: translations } = useQuery({
    queryKey: ["title-translations", "zh-CN", titles],
    queryFn: () => getTranslations(titles),
    enabled: titleMode === "translated" && titles.length > 0,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  })

  return (
    <>
      <div className={$("flex justify-between mx-2 mt-0 mb-2 items-center")}>
        <div className="flex gap-2 items-center">
          <a
            className={$("w-8 h-8 bg-cover", officialNintendoSourceIds.includes(id) ? "rounded-lg" : "rounded-full")}
            target="_blank"
            href={sources[id].home}
            title={sources[id].desc}
            style={{
              backgroundImage: `url(${getSourceIcon(id)}), url(/icons/default.png)`,
            }}
          />
          <span className="flex flex-col">
            <span className="flex items-center gap-2">
              <span
                className="text-xl font-bold"
                title={sources[id].desc}
              >
                {sources[id].name}
              </span>
              {sources[id]?.title && <span className={$("text-sm", `color-${sources[id].color} bg-base op-80 bg-op-50! px-1 rounded`)}>{sources[id].title}</span>}
            </span>
            <span className="text-xs op-70"><UpdatedTime isError={isError} updatedTime={data?.updatedTime} /></span>
          </span>
        </div>
        <div className={$("flex gap-2 text-lg", `color-${sources[id].color}`)}>
          <button
            type="button"
            className={$("btn i-ph:arrow-counter-clockwise-duotone", isNintendoTheme && "color-nintendo-300 op-80", isFetching && "animate-spin i-ph:circle-dashed-duotone")}
            onClick={() => refresh(id)}
          />
        </div>
      </div>

      <OverlayScrollbar
        className={$([
          "h-full p-2 overflow-y-auto rounded-2xl bg-base bg-op-92!",
          isFetching && `animate-pulse`,
          !isNintendoTheme && `sprinkle-${sources[id].color}`,
        ])}
        style={{
          backgroundColor: isNintendoTheme ? "rgba(18, 18, 20, 0.94)" : undefined,
          border: isNintendoTheme ? "1px solid rgba(255, 255, 255, 0.06)" : undefined,
        }}
        options={{
          overflow: { x: "hidden" },
        }}
        defer
      >
        <div className={$("transition-opacity-500", isFetching && "op-20")}>
          {!!data?.items?.length && (sources[id].type === "hottest"
            ? <NewsListHot items={data.items} titleMode={titleMode} translations={translations ?? {}} />
            : <NewsListTimeLine items={data.items} titleMode={titleMode} translations={translations ?? {}} />)}
        </div>
      </OverlayScrollbar>
    </>
  )
}

function UpdatedTime({ isError, updatedTime }: { updatedTime: any, isError: boolean }) {
  const relativeTime = useRelativeTime(updatedTime ?? "")
  if (relativeTime) return `${relativeTime}更新`
  if (isError) return "获取失败"
  return "加载中..."
}

function DiffNumber({ diff }: { diff: number }) {
  const [shown, setShown] = useState(true)
  useEffect(() => {
    setShown(true)
    const timer = setTimeout(() => {
      setShown(false)
    }, 5000)
    return () => clearTimeout(timer)
  }, [setShown, diff])

  return (
    <AnimatePresence>
      { shown && (
        <motion.span
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 0.5, y: -7 }}
          exit={{ opacity: 0, y: -15 }}
          className={$("absolute left-0 text-xs", diff < 0 ? "text-green" : "text-red")}
        >
          {diff > 0 ? `+${diff}` : diff}
        </motion.span>
      )}
    </AnimatePresence>
  )
}
function ExtraInfo({ item }: { item: NewsItem }) {
  if (item?.extra?.info) {
    return <>{item.extra.info}</>
  }
  if (item?.extra?.icon) {
    const { url, scale } = typeof item.extra.icon === "string" ? { url: item.extra.icon, scale: undefined } : item.extra.icon
    return (
      <img
        src={url}
        style={{
          transform: `scale(${scale ?? 1})`,
        }}
        className="h-4 inline mt--1"
        referrerPolicy="no-referrer"
        onError={e => e.currentTarget.style.display = "none"}
      />
    )
  }
}

function NewsUpdatedTime({ date }: { date: string | number }) {
  const relativeTime = useRelativeTime(date)
  return <>{relativeTime}</>
}

function decodeHtmlText(text: string) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
}

function loadTranslationCache(): TranslationMap {
  if (typeof window === "undefined") return {}
  const cache = safeParseString(localStorage.getItem(TRANSLATION_CACHE_KEY))
  if (!cache || typeof cache !== "object" || Array.isArray(cache)) return {}
  return cache as TranslationMap
}

function saveTranslationCache(cache: TranslationMap) {
  if (typeof window === "undefined") return
  localStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify(cache))
}

async function getTranslations(titles: string[]): Promise<TranslationMap> {
  const cache = loadTranslationCache()
  const uniqueTitles = [...new Set(titles.map(title => title.trim()).filter(Boolean))]
  const missingTitles = uniqueTitles.filter(title => !cache[title])

  if (missingTitles.length) {
    const response = await myFetch<{
      items: Array<{ text: string, translatedText: string }>
    }>("translate", {
      method: "POST",
      body: {
        target: "zh-CN",
        texts: missingTitles,
      },
    })

    response.items.forEach((item) => {
      if (item.text && item.translatedText) cache[item.text] = item.translatedText
    })
    saveTranslationCache(cache)
  }

  return cache
}

function getNewsTitle(item: NewsItem, titleMode: TitleMode, translations: TranslationMap) {
  const originalTitle = decodeHtmlText(item.title)
  if (titleMode === "translated") return translations[originalTitle] || originalTitle
  return originalTitle
}

function getSourceIcon(id: SourceID) {
  if (officialNintendoSourceIds.includes(id)) return "/icons/nintendo-official-avatar.svg"
  if (sourceIconMap[id]) return sourceIconMap[id]
  return `/icons/${id}.png`
}

function NewsItemMeta({ item }: { item: NewsItem }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-400/80">
      {item.source && <span>{item.source}</span>}
      {(item.pubDate || item?.extra?.date) && (
        <span><NewsUpdatedTime date={(item.pubDate || item?.extra?.date)!} /></span>
      )}
    </span>
  )
}
function NewsListHot({ items, titleMode, translations }: { items: NewsItem[], titleMode: TitleMode, translations: TranslationMap }) {
  const { width } = useWindowSize()
  return (
    <ol className="flex flex-col gap-2">
      {items?.map((item, i) => (
        <a
          href={width < 768 ? item.mobileUrl || item.url : item.url}
          target="_blank"
          key={item.id}
          title={titleMode === "translated" ? decodeHtmlText(item.title) : item.extra?.hover}
          className={$(
            "flex gap-2 items-center items-stretch relative cursor-pointer [&_*]:cursor-pointer transition-all",
            "hover:bg-neutral-400/10 rounded-md pr-1 visited:(text-neutral-400)",
          )}
        >
          <span className={$("bg-neutral-400/10 min-w-6 flex justify-center items-center rounded-md text-sm")}>
            {i + 1}
          </span>
          {!!item.extra?.diff && <DiffNumber diff={item.extra.diff} />}
          <span className="self-start line-height-none">
            <span className="mr-2 text-base">
              {getNewsTitle(item, titleMode, translations)}
            </span>
            <span className="text-xs text-neutral-400/80 truncate align-middle">
              <ExtraInfo item={item} />
            </span>
          </span>
        </a>
      ))}
    </ol>
  )
}

function NewsListTimeLine({ items, titleMode, translations }: { items: NewsItem[], titleMode: TitleMode, translations: TranslationMap }) {
  const { width } = useWindowSize()
  return (
    <ol className="border-s border-neutral-400/50 flex flex-col ml-1 gap-3">
      {items?.map(item => (
        <li key={`${item.id}-${item.pubDate || item?.extra?.date || ""}`} className="flex flex-col pl-2">
          <a
            className={$(
              "px-1 hover:bg-neutral-400/10 rounded-md visited:(text-neutral-400/80)",
              "cursor-pointer [&_*]:cursor-pointer transition-all",
            )}
            href={width < 768 ? item.mobileUrl || item.url : item.url}
            title={titleMode === "translated" ? decodeHtmlText(item.title) : item.extra?.hover}
            target="_blank"
            rel="noopener noreferrer"
          >
            {getNewsTitle(item, titleMode, translations)}
          </a>
          <span className="px-1">
            <NewsItemMeta item={item} />
          </span>
        </li>
      ))}
    </ol>
  )
}
