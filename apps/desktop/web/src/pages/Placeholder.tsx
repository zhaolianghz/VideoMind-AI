interface PlaceholderProps {
  title: string
}

export function Placeholder({ title }: PlaceholderProps) {
  return (
    <div className="max-w-4xl">
      <h1 className="mb-1 text-2xl font-bold">{title}</h1>
      <p className="mb-8 text-neutral-500">该模块将在后续迭代中实现</p>
      <div className="rounded-xl border border-dashed border-white/10 bg-neutral-900/50 p-16 text-center text-neutral-600">
        🚧 建设中
      </div>
    </div>
  )
}
