'use client'

import { useEffect } from 'react'

export default function MundoPage() {
  useEffect(() => {
    import('@/src/main')
  }, [])

  return <div id="app" />
}
