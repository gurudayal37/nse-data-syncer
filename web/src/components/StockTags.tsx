'use client'

import { useState, useEffect, useRef, KeyboardEvent } from 'react'
import { X, Plus, ChevronDown } from 'lucide-react'

interface MasterTag { id: number; name: string }

export default function StockTags({
    symbol,
    initialTags,
}: {
    symbol: string
    initialTags: string[]
}) {
    const [tags, setTags] = useState<string[]>(initialTags)
    const [input, setInput] = useState('')
    const [busy, setBusy] = useState(false)
    const [suggestions, setSuggestions] = useState<MasterTag[]>([])
    const [open, setOpen] = useState(false)
    const [highlighted, setHighlighted] = useState(-1)
    const wrapperRef = useRef<HTMLDivElement>(null)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const stockTagsUrl = `/api/stock/${encodeURIComponent(symbol)}/tags`

    // Fetch matching master tags on input change
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        if (!input.trim()) { setSuggestions([]); setOpen(false); return }
        debounceRef.current = setTimeout(async () => {
            const res = await fetch(`/api/tags?q=${encodeURIComponent(input.trim())}`)
            const data = await res.json()
            setSuggestions(data.tags ?? [])
            setOpen(true)
            setHighlighted(-1)
        }, 150)
    }, [input])

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const applyTag = async (tagName: string, createInMaster = false) => {
        if (!tagName || busy || tags.includes(tagName)) return
        setBusy(true)
        try {
            if (createInMaster) {
                await fetch('/api/tags', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: tagName }),
                })
            }
            const res = await fetch(stockTagsUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tag: tagName }),
            })
            const data = await res.json()
            if (data.tags) { setTags(data.tags); setInput(''); setOpen(false) }
        } finally {
            setBusy(false)
        }
    }

    const removeTag = async (tag: string) => {
        setBusy(true)
        try {
            const res = await fetch(stockTagsUrl, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tag }),
            })
            const data = await res.json()
            if (data.tags) setTags(data.tags)
        } finally {
            setBusy(false)
        }
    }

    const trimmed = input.trim()
    const showAddNew = trimmed.length > 0 && !suggestions.some(s => s.name.toLowerCase() === trimmed.toLowerCase()) && !tags.includes(trimmed)
    const totalOptions = suggestions.length + (showAddNew ? 1 : 0)

    const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
        if (!open) return
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlighted(h => Math.min(h + 1, totalOptions - 1))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlighted(h => Math.max(h - 1, 0))
        } else if (e.key === 'Enter') {
            e.preventDefault()
            if (highlighted >= 0 && highlighted < suggestions.length) {
                applyTag(suggestions[highlighted].name)
            } else if (highlighted === suggestions.length && showAddNew) {
                applyTag(trimmed, true)
            } else if (trimmed) {
                // if exact match in suggestions
                const exact = suggestions.find(s => s.name.toLowerCase() === trimmed.toLowerCase())
                if (exact) applyTag(exact.name)
                else if (showAddNew) applyTag(trimmed, true)
            }
        } else if (e.key === 'Escape') {
            setOpen(false)
        }
    }

    return (
        <div className="space-y-3">
            {/* Tag chips */}
            <div className="flex flex-wrap gap-2 min-h-[2rem]">
                {tags.length === 0 && (
                    <p className="text-sm text-gray-400 italic self-center">No tags yet — add one below</p>
                )}
                {tags.map((tag) => (
                    <span
                        key={tag}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-sm font-medium"
                    >
                        {tag}
                        <button
                            onClick={() => removeTag(tag)}
                            disabled={busy}
                            className="text-indigo-400 hover:text-indigo-700 disabled:opacity-40 transition-colors"
                            aria-label={`Remove tag ${tag}`}
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </span>
                ))}
            </div>

            {/* Autocomplete input */}
            <div className="relative flex gap-2" ref={wrapperRef}>
                <div className="relative flex-1 max-w-xs">
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={onKey}
                        onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
                        placeholder="Search or add a tag…"
                        disabled={busy}
                        className="w-full px-3 py-2 pr-8 text-sm text-gray-800 placeholder-gray-400 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent disabled:opacity-50"
                    />
                    {input && (
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    )}

                    {/* Dropdown */}
                    {open && totalOptions > 0 && (
                        <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-56 overflow-y-auto">
                            {suggestions.map((s, i) => (
                                <li
                                    key={s.id}
                                    onMouseDown={() => applyTag(s.name)}
                                    onMouseEnter={() => setHighlighted(i)}
                                    className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between ${
                                        tags.includes(s.name)
                                            ? 'text-gray-300 cursor-not-allowed'
                                            : highlighted === i
                                            ? 'bg-indigo-50 text-indigo-700'
                                            : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-700'
                                    }`}
                                >
                                    {s.name}
                                    {tags.includes(s.name) && <span className="text-xs text-gray-300">added</span>}
                                </li>
                            ))}
                            {showAddNew && (
                                <li
                                    onMouseDown={() => applyTag(trimmed, true)}
                                    onMouseEnter={() => setHighlighted(suggestions.length)}
                                    className={`px-3 py-2 text-sm cursor-pointer flex items-center gap-1.5 border-t border-gray-100 ${
                                        highlighted === suggestions.length
                                            ? 'bg-emerald-50 text-emerald-700'
                                            : 'text-emerald-600 hover:bg-emerald-50'
                                    }`}
                                >
                                    <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                                    Add &ldquo;{trimmed}&rdquo; as new tag
                                </li>
                            )}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    )
}
