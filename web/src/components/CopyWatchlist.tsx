"use client"

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface CopyWatchlistProps {
    symbols: string[]
    label?: string
}

export default function CopyWatchlist({ symbols, label = 'Copy TradingView Watchlist' }: CopyWatchlistProps) {
    const [copied, setCopied] = useState(false)

    // Format for TradingView: NSE:SYMBOL1,NSE:SYMBOL2,...
    const tvString = symbols.map(s => `NSE:${s}`).join(',')

    const copyToClipboard = () => {
        if (!tvString) return
        
        // Use the generic navigator clipboard API
        navigator.clipboard.writeText(tvString).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }).catch(err => {
            console.error('Failed to copy watchlist: ', err)
        })
    }

    if (symbols.length === 0) return null

    return (
        <button
            onClick={copyToClipboard}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg text-sm font-bold text-blue-700 hover:from-blue-100 hover:to-indigo-100 transition-colors shadow-sm whitespace-nowrap"
            title="Copy matching stocks formatted for TradingView Watchlist"
        >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-blue-600" />}
            {copied ? 'Copied to Clipboard!' : label}
        </button>
    )
}
