'use client'

import { useState, KeyboardEvent } from 'react'
import { X, Plus } from 'lucide-react'

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

    const apiUrl = `/api/stock/${encodeURIComponent(symbol)}/tags`

    const addTag = async () => {
        const trimmed = input.trim()
        if (!trimmed || busy || tags.includes(trimmed)) return
        setBusy(true)
        try {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tag: trimmed }),
            })
            const data = await res.json()
            if (data.tags) { setTags(data.tags); setInput('') }
        } finally {
            setBusy(false)
        }
    }

    const removeTag = async (tag: string) => {
        setBusy(true)
        try {
            const res = await fetch(apiUrl, {
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

    const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') addTag()
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

            {/* Input row */}
            <div className="flex gap-2">
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKey}
                    placeholder="Add a tag…"
                    disabled={busy}
                    className="px-3 py-2 text-sm text-gray-800 placeholder-gray-400 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent w-52 disabled:opacity-50"
                />
                <button
                    onClick={addTag}
                    disabled={busy || !input.trim()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Add
                </button>
            </div>
        </div>
    )
}
