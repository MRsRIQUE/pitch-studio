import { useCallback, useRef, useState } from 'react'

type Snapshot<T> = { past: T[]; present: T; future: T[] }

const LIMIT = 60

/**
 * Histórico linear para undo/redo. `set` empilha uma nova versão;
 * `replace` altera o presente sem criar ponto de retorno (usado em
 * arraste contínuo de sliders, que senão inunda a pilha).
 */
export function useHistory<T>(initial: T) {
  const [state, setState] = useState<Snapshot<T>>({ past: [], present: initial, future: [] })
  const pending = useRef<number | null>(null)

  const set = useCallback((updater: T | ((current: T) => T)) => {
    setState((snapshot) => {
      const next = typeof updater === 'function' ? (updater as (current: T) => T)(snapshot.present) : updater
      if (Object.is(next, snapshot.present)) return snapshot
      return { past: [...snapshot.past, snapshot.present].slice(-LIMIT), present: next, future: [] }
    })
  }, [])

  const replace = useCallback((updater: T | ((current: T) => T)) => {
    setState((snapshot) => {
      const next = typeof updater === 'function' ? (updater as (current: T) => T)(snapshot.present) : updater
      return { ...snapshot, present: next }
    })
  }, [])

  /** Agrupa alterações rápidas (slider) num único ponto de undo. */
  const commitLater = useCallback((updater: T | ((current: T) => T)) => {
    if (pending.current === null) {
      setState((snapshot) => ({ past: [...snapshot.past, snapshot.present].slice(-LIMIT), present: snapshot.present, future: [] }))
    } else {
      window.clearTimeout(pending.current)
    }
    replace(updater)
    pending.current = window.setTimeout(() => { pending.current = null }, 500)
  }, [replace])

  const undo = useCallback(() => {
    setState((snapshot) => {
      if (snapshot.past.length === 0) return snapshot
      const previous = snapshot.past[snapshot.past.length - 1]
      return { past: snapshot.past.slice(0, -1), present: previous, future: [snapshot.present, ...snapshot.future] }
    })
  }, [])

  const redo = useCallback(() => {
    setState((snapshot) => {
      if (snapshot.future.length === 0) return snapshot
      const [next, ...rest] = snapshot.future
      return { past: [...snapshot.past, snapshot.present], present: next, future: rest }
    })
  }, [])

  const reset = useCallback((value: T) => {
    setState({ past: [], present: value, future: [] })
  }, [])

  return {
    doc: state.present,
    set,
    replace,
    commitLater,
    undo,
    redo,
    reset,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  }
}
