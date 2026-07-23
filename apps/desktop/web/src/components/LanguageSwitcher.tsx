import { useI18n } from '../i18n'

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n()
  return (
    <div className="flex rounded-lg border border-app p-0.5">
      {(['zh', 'en'] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
            locale === l
              ? 'bg-fill text-primary'
              : 'text-secondary hover:text-primary'
          }`}
        >
          {l === 'zh' ? '中' : 'EN'}
        </button>
      ))}
    </div>
  )
}
