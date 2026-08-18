import { useEffect, useId, useRef, type ReactNode } from 'react'

export interface DialogAction<T extends string> {
  value: T
  label: string
  variant?: 'primary' | 'secondary' | 'danger'
}

export function ActionDialog<T extends string>({
  open,
  title,
  description,
  actions,
  busy = false,
  busyLabel = 'Processando...',
  onAction,
  onClose,
}: {
  open: boolean
  title: string
  description: ReactNode
  actions: DialogAction<T>[]
  busy?: boolean
  busyLabel?: string
  onAction: (value: T) => void
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      window.requestAnimationFrame(() => cancelRef.current?.focus())
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="action-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={busy}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
      onClose={() => {
        if (open && !busy) onClose()
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <div className="action-dialog-content">
        <div className="action-dialog-copy">
          <h2 id={titleId}>{title}</h2>
          <div id={descriptionId}>{description}</div>
        </div>
        <div className="action-dialog-actions">
          <button ref={cancelRef} type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancelar</button>
          {actions.map((action) => (
            <button
              type="button"
              className={`button ${action.variant ?? 'primary'}`}
              disabled={busy}
              key={action.value}
              onClick={() => onAction(action.value)}
            >
              {busy ? busyLabel : action.label}
            </button>
          ))}
        </div>
      </div>
    </dialog>
  )
}
