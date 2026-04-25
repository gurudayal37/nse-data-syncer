'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import { X, StickyNote } from 'lucide-react'

interface Note {
  id: number
  note: string
  created_at: string
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default function StockNotes({
  symbol,
  initialNotes,
}: {
  symbol: string
  initialNotes: Note[]
}) {
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const apiUrl = `/api/stock/${encodeURIComponent(symbol)}/notes`

  const addNote = async () => {
    const trimmed = input.trim()
    if (!trimmed || busy) return
    setBusy(true)
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: trimmed }),
      })
      const data = await res.json()
      if (data.note) {
        setNotes((prev) => [data.note, ...prev])
        setInput('')
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto'
        }
      }
    } finally {
      setBusy(false)
    }
  }

  const deleteNote = async (id: number) => {
    setBusy(true)
    try {
      const res = await fetch(apiUrl, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (data.notes) setNotes(data.notes)
    } finally {
      setBusy(false)
    }
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      addNote()
    }
  }

  const autoResize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`
  }

  return (
    <div className="space-y-2">
      {/* Input row */}
      <div className="flex gap-2 items-start">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); autoResize() }}
          onKeyDown={onKey}
          placeholder="Add a note… (⌘↵ to save)"
          disabled={busy}
          rows={1}
          className="flex-1 px-2.5 py-1.5 text-xs text-gray-800 placeholder-gray-400 bg-white border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:opacity-50 overflow-hidden leading-relaxed"
        />
        <button
          onClick={addNote}
          disabled={busy || !input.trim()}
          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          <StickyNote className="w-3 h-3" />
          Save
        </button>
      </div>

      {/* Notes list — scrollable, max 3 visible */}
      {notes.length > 0 && (
        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
          {notes.map((n) => (
            <div
              key={n.id}
              className="group relative bg-amber-50 border border-amber-100 rounded-lg px-3 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] text-amber-500 font-medium mb-0.5">{fmtDate(n.created_at)}</p>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{n.note}</p>
                </div>
                <button
                  onClick={() => deleteNote(n.id)}
                  disabled={busy}
                  className="shrink-0 text-amber-300 hover:text-red-500 disabled:opacity-40 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
                  aria-label="Delete note"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {notes.length === 0 && (
        <p className="text-xs text-gray-400 italic">No notes yet.</p>
      )}
    </div>
  )
}
