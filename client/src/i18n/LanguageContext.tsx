import { createContext, useContext, useState, type ReactNode } from 'react'
import { translations, type Language, type TranslationKey } from './translations'

type TranslationVars = Record<string, string | number>

interface LanguageContextValue {
  lang: Language
  setLang: (l: Language) => void
  t: (key: TranslationKey, vars?: TranslationVars) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>(() => {
    const stored = localStorage.getItem('trivia_lang') as Language | null
    return stored === 'en' ? 'en' : 'es'
  })

  const handleSetLang = (l: Language) => {
    localStorage.setItem('trivia_lang', l)
    setLang(l)
  }

  const t = (key: TranslationKey, vars?: TranslationVars): string => {
    const template: string = translations[lang][key]
    if (!vars) return template
    return Object.entries(vars).reduce(
      (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
      template
    )
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang: handleSetLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider')
  return ctx
}
