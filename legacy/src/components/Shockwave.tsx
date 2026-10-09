import { useCallback, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react'

type Pulse = { id: number; x: number; y: number }

export function Shockwave({ children, className = '' }: { children: ReactNode; className?: string }) {
  const [pulse, setPulse] = useState<Pulse | null>(null)

  const trigger = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setPulse({ id: Date.now(), x: event.clientX - rect.left, y: event.clientY - rect.top })
  }, [])

  return <div className={`web-shockwave ${className}`} onClickCapture={trigger}>
    {children}
    {pulse && <span key={pulse.id} className="shockwave-ring" style={{ '--shock-x': `${pulse.x}px`, '--shock-y': `${pulse.y}px` } as CSSProperties} aria-hidden="true" />}
  </div>
}
