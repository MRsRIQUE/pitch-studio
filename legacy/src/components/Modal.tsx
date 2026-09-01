import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

type Props = {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}

export function Modal({ title, onClose, children, wide }: Props) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return <div className="modal-backdrop" onClick={onClose}>
    <div className={wide ? 'modal wide' : 'modal'} role="dialog" aria-label={title} onClick={(event) => event.stopPropagation()}>
      <header className="modal-header">
        <strong>{title}</strong>
        <button onClick={onClose} title="Fechar"><X size={17} /></button>
      </header>
      <div className="modal-body">{children}</div>
    </div>
  </div>
}
