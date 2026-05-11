import { Link } from "@tanstack/react-router"
import { useIsFetching } from "@tanstack/react-query"
import type { SourceID } from "@shared/types"
import { NavBar } from "../navbar"
import { currentSourcesAtom, goToTopAtom, titleModeAtom } from "~/atoms"

function GoTop() {
  const { ok, fn: goToTop } = useAtomValue(goToTopAtom)
  return (
    <button
      type="button"
      title="Go To Top"
      className={$("i-ph:arrow-fat-up-duotone", ok ? "op-50 btn" : "op-0")}
      onClick={goToTop}
    />
  )
}

function Refresh() {
  const currentSources = useAtomValue(currentSourcesAtom)
  const { refresh } = useRefetch()
  const refreshAll = useCallback(() => refresh(...currentSources), [refresh, currentSources])

  const isFetching = useIsFetching({
    predicate: (query) => {
      const [type, id] = query.queryKey as ["source" | "entire", SourceID]
      return (type === "source" && currentSources.includes(id)) || type === "entire"
    },
  })

  return (
    <button
      type="button"
      title="Refresh"
      className={$("i-ph:arrow-counter-clockwise-duotone btn", isFetching && "animate-spin i-ph:circle-dashed-duotone")}
      onClick={refreshAll}
    />
  )
}

function TitleModeToggle() {
  const [titleMode, setTitleMode] = useAtom(titleModeAtom)
  const translated = titleMode === "translated"

  return (
    <button
      type="button"
      title={translated ? "显示原文标题" : "显示翻译标题"}
      className={$([
        "h-8 rounded-full border px-1 text-xs font-bold flex items-center gap-1",
        "border-primary-600/30 bg-base/35 text-neutral-200",
      ])}
      onClick={() => setTitleMode(translated ? "original" : "translated")}
    >
      <span className={$("px-2 py-1 rounded-full", !translated && "bg-primary-600 text-white")}>原文</span>
      <span className={$("px-2 py-1 rounded-full", translated && "bg-primary-600 text-white")}>译文</span>
    </button>
  )
}

export function Header() {
  return (
    <>
      <span className="flex justify-self-start">
        <Link to="/" className="flex gap-2 items-center">
          <img
            src="/ns-avatar.jpg"
            alt="NS新闻汇总"
            className="h-11 w-11 rounded-full object-cover"
          />
          <span className="text-2xl font-bold line-height-none! whitespace-nowrap">
            NS新闻汇总
          </span>
        </Link>
      </span>
      <span className="justify-self-center">
        <span className="hidden md:(inline-block)">
          <NavBar />
        </span>
      </span>
      <span className="justify-self-end flex gap-2 items-center text-xl text-primary-600 dark:text-primary">
        <GoTop />
        <TitleModeToggle />
        <Refresh />
      </span>
    </>
  )
}
