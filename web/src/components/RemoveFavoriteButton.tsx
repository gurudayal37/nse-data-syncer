'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'

export default function RemoveFavoriteButton({ symbol }: { symbol: string }) {
  const [removing, setRemoving] = useState(false)
  const router = useRouter()

  const remove = async () => {
    if (removing) return
    setRemoving(true)
    try {
      await fetch('/api/favorites', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol }),
      })
      router.refresh()
    } finally {
      setRemoving(false)
    }
  }

  return (
    <button
      onClick={remove}
      disabled={removing}
      title="Remove from favorites"
      className="text-slate-300 hover:text-red-500 transition-colors disabled:opacity-40"
    >
      <X className="w-4 h-4" />
    </button>
  )
}
