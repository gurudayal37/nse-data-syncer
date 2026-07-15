'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const INTERVAL_MS = 60_000 // refresh every 60 seconds

function isMarketHours(): boolean {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const h = now.getHours()
  const day = now.getDay() // 0=Sun, 6=Sat
  return day >= 1 && day <= 5 && h >= 8 && h < 21
}

export default function AutoRefresh({ isToday }: { isToday: boolean }) {
  const router = useRouter()
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  useEffect(() => {
    if (!isToday) return

    const tick = () => {
      if (!isMarketHours()) return
      router.refresh()
      setLastRefresh(new Date())
    }

    const id = setInterval(tick, INTERVAL_MS)
    return () => clearInterval(id)
  }, [isToday, router])

  if (!isToday || !lastRefresh) return null

  return (
    <span className="text-xs text-slate-400">
      auto-refreshed {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
    </span>
  )
}
