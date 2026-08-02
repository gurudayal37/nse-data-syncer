'use client'

import { useState } from 'react'
import { X, StickyNote } from 'lucide-react'

export interface SerializedEvent {
    type: 'result' | 'presentation' | 'concall' | 'transcript' | 'upcoming'
    dateISO: string
    season: string
    title: string
    chips?: { label: string; count: number }[]
    url?: string
}

interface Note {
    id: number
    note: string
    created_at: string
}

type Row =
    | { kind: 'event'; event: SerializedEvent }
    | { kind: 'note'; note: Note }

function fmtDate(iso: string): string {
    return new Date(iso).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: false,
    })
}

function fmtNoteDate(iso: string): string {
    return new Date(iso).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: false,
    })
}

function mergeRows(events: SerializedEvent[], notes: Note[]): Row[] {
    const eventRows: Row[] = events.map(e => ({ kind: 'event', event: e }))
    const noteRows: Row[] = notes.map(n => ({ kind: 'note', note: n }))
    const all = [...eventRows, ...noteRows]

    all.sort((a, b) => {
        const dateA = a.kind === 'event' ? new Date(a.event.dateISO).getTime() : new Date(a.note.created_at).getTime()
        const dateB = b.kind === 'event' ? new Date(b.event.dateISO).getTime() : new Date(b.note.created_at).getTime()
        if (a.kind === 'event' && b.kind === 'event') {
            if (a.event.season !== b.event.season) return dateB - dateA
            if (a.event.type === 'presentation' && b.event.type === 'result') return -1
            if (a.event.type === 'result' && b.event.type === 'presentation') return 1
        }
        return dateB - dateA
    })
    return all
}

export default function TimelineTable({
    symbol,
    events,
    initialNotes,
}: {
    symbol: string
    events: SerializedEvent[]
    initialNotes: Note[]
}) {
    const [notes, setNotes] = useState<Note[]>(initialNotes)
    const [input, setInput] = useState('')
    const [saving, setSaving] = useState(false)
    const apiUrl = `/api/stock/${encodeURIComponent(symbol)}/notes`

    const addNote = async () => {
        const trimmed = input.trim()
        if (!trimmed || saving) return
        const tempId = -Date.now()
        const tempNote: Note = { id: tempId, note: trimmed, created_at: new Date().toISOString() }
        setNotes(prev => [tempNote, ...prev])
        setInput('')
        setSaving(true)
        try {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ note: trimmed }),
            })
            const data = await res.json()
            if (data.note) setNotes(prev => prev.map(n => n.id === tempId ? data.note : n))
        } catch {
            setNotes(prev => prev.filter(n => n.id !== tempId))
            setInput(trimmed)
        } finally {
            setSaving(false)
        }
    }

    const deleteNote = async (id: number) => {
        setNotes(prev => prev.filter(n => n.id !== id))
        try {
            await fetch(apiUrl, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            })
        } catch {}
    }

    const rows = mergeRows(events, notes)

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Timeline</p>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                    <colgroup>
                        <col style={{ width: '160px' }} />
                        <col style={{ width: '120px' }} />
                        <col />
                    </colgroup>
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/60">
                            <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Date</th>
                            <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Event</th>
                            <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Add note row */}
                        <tr className="border-b border-amber-100 bg-amber-50/40">
                            <td className="px-4 py-2.5 text-xs text-slate-400 align-middle whitespace-nowrap">
                                Now
                            </td>
                            <td className="px-4 py-2.5 align-middle">
                                <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 uppercase tracking-wide">
                                    Note
                                </span>
                            </td>
                            <td className="px-4 py-2.5 align-middle">
                                <div className="flex gap-2">
                                    <input
                                        value={input}
                                        onChange={e => setInput(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                                e.preventDefault()
                                                addNote()
                                            }
                                        }}
                                        placeholder="Add a note… (⌘↵ to save)"
                                        className="flex-1 px-2.5 py-1.5 text-xs text-gray-800 placeholder-gray-400 bg-white border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent"
                                    />
                                    <button
                                        onClick={addNote}
                                        disabled={!input.trim() || saving}
                                        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed rounded transition-colors"
                                    >
                                        <StickyNote className="w-3 h-3" />
                                        Save
                                    </button>
                                </div>
                            </td>
                        </tr>

                        {/* Event + note rows */}
                        {rows.map((row, i) => {
                            if (row.kind === 'note') {
                                const n = row.note
                                return (
                                    <tr key={`note-${n.id}`} className="border-b border-slate-100 hover:bg-amber-50/30 group">
                                        <td className="px-4 py-3 text-xs text-slate-400 align-top whitespace-nowrap">
                                            {fmtNoteDate(n.created_at)}
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 uppercase tracking-wide">
                                                Note
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            <div className="flex items-start justify-between gap-3">
                                                <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{n.note}</p>
                                                <button
                                                    onClick={() => deleteNote(n.id)}
                                                    className="shrink-0 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
                                                    aria-label="Delete note"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            }

                            const ev = row.event
                            return (
                                <tr key={`ev-${i}`} className={`border-b border-slate-100 ${ev.type === 'upcoming' ? 'bg-red-50/40 hover:bg-red-50/70' : 'hover:bg-slate-50/60'}`}>
                                    <td className="px-4 py-3 text-xs text-slate-400 align-top whitespace-nowrap">
                                        {fmtDate(ev.dateISO)}
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        {ev.type === 'upcoming' && (
                                            <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700 uppercase tracking-wide">Upcoming</span>
                                        )}
                                        {ev.type === 'result' && (
                                            <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 uppercase tracking-wide">Result</span>
                                        )}
                                        {ev.type === 'presentation' && (
                                            <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 uppercase tracking-wide">Presentation</span>
                                        )}
                                        {ev.type === 'concall' && (
                                            <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 uppercase tracking-wide">Concall</span>
                                        )}
                                        {ev.type === 'transcript' && (
                                            <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 uppercase tracking-wide">Transcript</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        {ev.type === 'upcoming' ? (
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-xs font-medium text-red-700">{ev.title}</p>
                                                <span className="text-xs text-red-500">— Exit positional/swing trade for this stock</span>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="text-xs font-medium text-slate-700">{ev.title}</p>
                                                    {ev.url && (
                                                        <a href={ev.url} target="_blank" rel="noopener noreferrer"
                                                           className="text-xs text-blue-500 hover:text-blue-700 shrink-0">
                                                            View PDF →
                                                        </a>
                                                    )}
                                                </div>
                                                {ev.type === 'presentation' && ev.chips && ev.chips.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                                        {ev.chips.map(c => (
                                                            <span key={c.label} className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                                {c.label} <span className="font-bold text-indigo-400">{c.count}</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}

                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={3} className="px-4 py-8 text-center text-xs text-slate-400 italic">
                                    No events yet — sync to load results
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
