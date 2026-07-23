import { useI18n } from '../i18n'

interface PlaceholderProps {
  title: string
}

export function Placeholder({ title }: PlaceholderProps) {
  const { t } = useI18n()
  return (
    <div className="max-w-4xl">
      <h1 className="mb-1 text-2xl font-bold">{title}</h1>
      <p className="mb-8 text-secondary">{t('placeholder.subtitle')}</p>
      <div className="rounded-xl border border-dashed border-app bg-surface p-16 text-center text-secondary">
        {t('placeholder.building')}
      </div>
    </div>
  )
}
