import { useEffect, useRef, useState, type ReactNode } from 'react'

type Props = {
  /** Conteúdo do botão que abre o painel. */
  label: ReactNode
  className?: string
  align?: 'left' | 'right'
  /** Painel para cima (usado no prompt bar, que fica no rodapé). */
  up?: boolean
  title?: string
  children: (close: () => void) => ReactNode
}

export function Dropdown({ label, className = '', align = 'left', up = false, title, children }: Props) {
  const [open, setOpen] = useState(false)
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointer(event: MouseEvent) {
      if (host.current && !host.current.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const classes = ['dropdown-panel', align === 'right' ? 'to-right' : '', up ? 'to-up' : ''].filter(Boolean).join(' ')

  return <div className="dropdown" ref={host}>
    <button className={className} title={title} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      {label}
    </button>
    {open && <div className={classes} role="menu">{children(() => setOpen(false))}</div>}
  </div>
}

type ItemProps = {
  children: ReactNode
  onClick?: () => void
  active?: boolean
  danger?: boolean
}

export function DropdownItem({ children, onClick, active, danger }: ItemProps) {
  const classes = ['dropdown-item', active ? 'active' : '', danger ? 'danger' : ''].filter(Boolean).join(' ')
  return <button className={classes} role="menuitem" onClick={onClick}>{children}</button>
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return <span className="dropdown-label">{children}</span>
}
