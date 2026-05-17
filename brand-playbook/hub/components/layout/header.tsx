interface HeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
}

export function Header({ title, description, action }: HeaderProps) {
  return (
    <div className="flex items-center justify-between px-8 py-5 border-b border-border sticky top-0 z-10 bg-background">
      <div>
        <h1 className="text-lg font-bold text-foreground tracking-tight leading-none" style={{ fontFamily: 'var(--font-display)' }}>{title}</h1>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  )
}
