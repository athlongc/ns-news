import { sources } from "./sources"
import { typeSafeObjectEntries, typeSafeObjectFromEntries } from "./type.util"
import type { ColumnID, HiddenColumnID, Metadata, SourceID } from "./types"

export const columns = {
  home: {
    zh: "首页",
  },
  "nintendo-japan": {
    zh: "任天堂日本",
  },
  "nintendo-hongkong": {
    zh: "任天堂香港",
  },
  "nintendo-official": {
    zh: "任天堂美国",
  },
  "nintendo-europe": {
    zh: "任天堂欧洲",
  },
  "nintendo-life": {
    zh: "Nintendo Life",
  },
  "nintendo-everything": {
    zh: "Nintendo Everything",
  },
  "gonintendo": {
    zh: "GoNintendo",
  },
  "my-nintendo-news": {
    zh: "My Nintendo News",
  },
  "ninten-switch": {
    zh: "Ninten Switch",
  },
  china: {
    zh: "国内",
  },
  world: {
    zh: "国际",
  },
  tech: {
    zh: "科技",
  },
  finance: {
    zh: "财经",
  },
  focus: {
    zh: "关注",
  },
  realtime: {
    zh: "实时",
  },
  hottest: {
    zh: "最热",
  },
} as const

export const fixedColumnIds = [
  "home",
  "focus",
  "nintendo-japan",
  "nintendo-hongkong",
  "nintendo-official",
  "nintendo-europe",
  "nintendo-life",
  "nintendo-everything",
  "gonintendo",
  "my-nintendo-news",
  "ninten-switch",
] as const satisfies Partial<ColumnID>[]
export const hiddenColumns = Object.keys(columns).filter(id => !fixedColumnIds.includes(id as any)) as HiddenColumnID[]

export const metadata: Metadata = typeSafeObjectFromEntries(typeSafeObjectEntries(columns).map(([k, v]) => {
  switch (k) {
    case "home":
      return [k, {
        name: v.zh,
        sources: typeSafeObjectEntries(sources).filter(([, v]) => !v.redirect).map(([k]) => k as SourceID),
      }]
    case "focus":
      return [k, {
        name: v.zh,
        sources: [] as SourceID[],
      }]
    case "hottest":
      return [k, {
        name: v.zh,
        sources: typeSafeObjectEntries(sources).filter(([, v]) => v.type === "hottest" && !v.redirect).map(([k]) => k),
      }]
    case "realtime":
      return [k, {
        name: v.zh,
        sources: typeSafeObjectEntries(sources).filter(([, v]) => v.type === "realtime" && !v.redirect).map(([k]) => k),
      }]
    default:
      return [k, {
        name: v.zh,
        sources: typeSafeObjectEntries(sources).filter(([, v]) => v.column === k && !v.redirect).map(([k]) => k),
      }]
  }
}))
