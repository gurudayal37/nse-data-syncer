'use client'

import { useState } from 'react'
import { RefreshCw, ExternalLink } from 'lucide-react'

type SyncResult =
    | { ok: true; local: true; text: string }
    | { ok: true; local: false; text: string; actionsUrl: string }
    | { ok: false; text: string }

export default function SyncButton({ symbol }: { symbol: string }) {
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<SyncResult | null>(null)

    const handleSync = async () => {
        setLoading(true)
        setResult(null)
        try {
            const res = await fetch(`/api/stock/${encodeURIComponent(symbol)}/sync`, { method: 'POST' })
            const data = await res.json()

            if (!data.success) {
                setResult({ ok: false, text: data.error ?? 'Sync failed' })
                return
            }

            if (data.actionsUrl) {
                // Production: GitHub Actions triggered
                setResult({ ok: true, local: false, text: 'Triggered on GitHub Actions', actionsUrl: data.actionsUrl })
            } else {
                // Local: script ran synchronously
                setResult({ ok: true, local: true, text: `Synced ${data.quarters_saved} quarters` })
                setTimeout(() => window.location.reload(), 1200)
            }
        } catch {
            setResult({ ok: false, text: 'Network error' })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex items-center gap-3 flex-wrap">
            <button
                onClick={handleSync}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? (process.env.NODE_ENV === 'development' ? 'Syncing…' : 'Triggering…') : 'Sync Now'}
            </button>

            {result && (
                <span className={`text-sm font-medium flex items-center gap-1.5 ${result.ok ? 'text-green-600' : 'text-red-600'}`}>
                    {result.text}
                    {result.ok && !result.local && (
                        <a
                            href={result.actionsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 underline underline-offset-2"
                        >
                            View run <ExternalLink className="w-3 h-3" />
                        </a>
                    )}
                </span>
            )}
        </div>
    )
}
