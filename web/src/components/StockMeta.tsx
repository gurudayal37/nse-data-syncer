'use client'

import { useState, useRef, useEffect } from 'react'
import { Pencil, Check, X } from 'lucide-react'

interface Props {
  symbol: string
  initial: {
    sector:     string | null
    subsector1: string | null
    subsector2: string | null
    subsector3: string | null
  }
}

type Field = 'sector' | 'subsector1' | 'subsector2' | 'subsector3'

const LABELS: Record<Field, string> = {
  sector:     'Sector',
  subsector1: 'Industry',
  subsector2: 'Group',
  subsector3: 'Sub-group',
}

function EnumInput({
  field,
  value,
  onChange,
}: {
  field: Field
  value: string
  onChange: (v: string) => void
}) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      if (!value.trim()) { setSuggestions([]); setOpen(false); return }
      const res = await fetch(`/api/stock-enums?field=${field}&q=${encodeURIComponent(value)}`)
      const data = await res.json()
      setSuggestions(data.values ?? [])
      setOpen((data.values ?? []).length > 0)
      setHighlighted(-1)
    }, 200)
  }, [value, field])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const pick = (v: string) => { onChange(v); setOpen(false) }

  return (
    <div ref={wrapRef} className="relative w-full">
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, suggestions.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, -1)) }
          else if (e.key === 'Enter' && highlighted >= 0) { e.preventDefault(); pick(suggestions[highlighted]) }
          else if (e.key === 'Escape') setOpen(false)
        }}
        placeholder={`Enter ${LABELS[field].toLowerCase()}…`}
        className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
        style={{ color: '#0f172a' }}
      />
      {open && (
        <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto text-sm">
          {suggestions.map((s, i) => (
            <li
              key={s}
              onMouseDown={() => pick(s)}
              style={{ color: i === highlighted ? undefined : '#0f172a' }}
              className={`px-3 py-2 cursor-pointer ${i === highlighted ? 'bg-sky-50 text-sky-700' : 'hover:bg-slate-50'}`}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function StockMeta({ symbol, initial }: Props) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [values, setValues] = useState({
    sector:     initial.sector     ?? '',
    subsector1: initial.subsector1 ?? '',
    subsector2: initial.subsector2 ?? '',
    subsector3: initial.subsector3 ?? '',
  })
  // snapshot to revert on cancel
  const snapshot = useRef(values)

  const startEdit = () => { snapshot.current = values; setEditing(true) }
  const cancel    = () => { setValues(snapshot.current); setEditing(false) }

  const save = async () => {
    setSaving(true)
    setEditing(false)
    const payload = {
      sector:     values.sector     || null,
      subsector1: values.subsector1 || null,
      subsector2: values.subsector2 || null,
      subsector3: values.subsector3 || null,
    }
    const res = await fetch(`/api/stock/${symbol}/meta`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) setValues(snapshot.current)
    setSaving(false)
  }

  const fields: Field[] = ['sector', 'subsector1', 'subsector2', 'subsector3']

  return (
    <div className="group/meta">
      {fields.map((f) => (
        <div key={f} className="flex justify-between items-center py-2.5 border-b border-slate-100 last:border-0">
          <span className="text-sm text-slate-500 shrink-0 w-24">{LABELS[f]}</span>
          {editing ? (
            <EnumInput
              field={f}
              value={values[f]}
              onChange={v => setValues(prev => ({ ...prev, [f]: v }))}
            />
          ) : (
            <span className={`text-sm font-semibold ${values[f] ? 'text-slate-800' : 'text-slate-300'}`}>
              {values[f] || '—'}
            </span>
          )}
        </div>
      ))}

      {/* Action row */}
      <div className="flex justify-end pt-1.5 gap-1.5">
        {editing ? (
          <>
            <button onClick={cancel} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors">
              <X className="w-3 h-3" /> Cancel
            </button>
            <button onClick={save} className="flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700 font-semibold px-2 py-1 rounded-lg hover:bg-sky-50 transition-colors">
              <Check className="w-3 h-3" /> Save
            </button>
          </>
        ) : (
          <button
            onClick={startEdit}
            className="flex items-center gap-1 text-xs text-slate-300 hover:text-slate-500 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors opacity-0 group-hover/meta:opacity-100"
          >
            <Pencil className="w-3 h-3" />
            {saving ? 'Saving…' : 'Edit'}
          </button>
        )}
      </div>
    </div>
  )
}
