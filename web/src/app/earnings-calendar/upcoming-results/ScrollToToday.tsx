'use client'

import { useEffect } from 'react'

export default function ScrollToToday() {
  useEffect(() => {
    document.getElementById('today')?.scrollIntoView({ block: 'start' })
  }, [])

  return null
}
