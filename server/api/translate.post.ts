import { myFetch } from "#/utils/fetch"

interface TranslateRequest {
  target?: string
  texts?: string[]
}

const translationCache = new Map<string, string>()

function translationKey(target: string, text: string) {
  return `${target}:${text}`
}

function parseGoogleTranslateResponse(response: any, fallback: string) {
  const segments = response?.[0]
  if (!Array.isArray(segments)) return fallback
  const translatedText = segments.map(segment => segment?.[0]).filter(Boolean).join("")
  return translatedText || fallback
}

async function translateTitle(text: string, target: string) {
  const key = translationKey(target, text)
  const cached = translationCache.get(key)
  if (cached) return cached

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`
    const response = await myFetch<any>(url, {
      retry: 1,
      timeout: 8000,
    })
    const translatedText = parseGoogleTranslateResponse(response, text)
    translationCache.set(key, translatedText)
    return translatedText
  } catch (error) {
    logger.warn("translate title failed", error)
    return text
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody<TranslateRequest>(event)
  const target = body.target || "zh-CN"
  const texts = [...new Set((body.texts ?? []).map(text => text.trim()).filter(Boolean))].slice(0, 50)

  const items = await Promise.all(texts.map(async text => ({
    text,
    translatedText: await translateTitle(text, target),
  })))

  return {
    target,
    items,
  }
})
