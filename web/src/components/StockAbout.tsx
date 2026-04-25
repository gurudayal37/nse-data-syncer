'use client'

import { useState, useRef } from 'react'
import { Pencil, Check, X } from 'lucide-react'

export default function StockAbout({
  symbol,
  initialAbout,
}: {
  symbol: string
  initialAbout: string | null
}) {
  const [about, setAbout] = useState(initialAbout ?? '')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const startEdit = () => {
    setDraft(about)
    setEditing(true)
    setTimeout(() => {
      const el = textareaRef.current
      if (el) { el.style.height = `${el.scrollHeight}px`; el.focus() }
    }, 0)
  }

  const cancel = () => setEditing(false)

  const save = async () => {
    setBusy(true)
    try {
      await fetch(`/api/stock/${encodeURIComponent(symbol)}/about`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ about: draft }),
      })
      setAbout(draft.trim())
      setEditing(false)
    } finally {
      setBusy(false)
    }
  }

  const autoResize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">About</p>
        {!editing && (
          <button
            onClick={startEdit}
            className="text-slate-300 hover:text-slate-500 transition-colors"
            title="Edit description"
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-1.5">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => { setDraft(e.target.value); autoResize() }}
            disabled={busy}
            rows={4}
            className="w-full px-2.5 py-2 text-xs text-slate-700 bg-white border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 leading-relaxed"
          />
          <div className="flex gap-1.5 justify-end">
            <button
              onClick={cancel}
              disabled={busy}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-40"
            >
              <X className="w-3 h-3" /> Cancel
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-40"
            >
              <Check className="w-3 h-3" /> Save
            </button>
          </div>
        </div>
      ) : about ? (
        <p className="text-xs text-slate-500 leading-relaxed line-clamp-4">{about}</p>
      ) : (
        <button
          onClick={startEdit}
          className="text-xs text-slate-300 italic hover:text-slate-400 transition-colors"
        >
          No description — click to add one
        </button>
      )}
    </div>
  )
}
