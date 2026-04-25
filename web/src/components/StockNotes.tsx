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
    hour: '2-digit', minute: '2-digit',
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
        if (textareaRef.current) textareaRef.current.style.height = 'auto'
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
    // Cmd/Ctrl+Enter to submit
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      addNote()
    }
  }

  const autoResize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  return (
    <div className="space-y-4">
      {/* Input area */}
      <div className="flex flex-col gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); autoResize() }}
          onKeyDown={onKey}
          placeholder="Add a research note… (⌘↵ to save)"
          disabled={busy}
          rows={2}
          className="w-full px-3 py-2 text-sm text-gray-800 placeholder-gray-400 bg-white border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:opacity-50 overflow-hidden"
        />
        <div className="flex justify-end">
          <button
            onClick={addNote}
            disabled={busy || !input.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <StickyNote className="w-3.5 h-3.5" />
            Save Note
          </button>
        </div>
      </div>

      {/* Notes list */}
      {notes.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No notes yet.</p>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => (
            <div
              key={n.id}
              className="group relative bg-amber-50 border border-amber-100 rounded-lg px-4 py-3"
            >
              <p className="text-xs text-amber-500 font-medium mb-1">{fmtDate(n.created_at)}</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{n.note}</p>
              <button
                onClick={() => deleteNote(n.id)}
                disabled={busy}
                className="absolute top-2.5 right-2.5 text-amber-300 hover:text-red-500 disabled:opacity-40 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Delete note"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
