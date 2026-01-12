'use client'

import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { useCallback, useState, useEffect } from 'react'

export default function Search({ placeholder }: { placeholder: string }) {
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const { replace } = useRouter()
    const [term, setTerm] = useState(searchParams.get('query') || '')

    useEffect(() => {
        setTerm(searchParams.get('query') || '')
    }, [searchParams])

    // Custom debounce implementation since use-debounce is not installed
    const handleSearch = useCallback((term: string) => {
        const params = new URLSearchParams(searchParams)
        if (term) {
            params.set('query', term)
        } else {
            params.delete('query')
        }
        // Always reset to page 1 when searching
        params.set('page', '1')

        replace(`${pathname}?${params.toString()}`)
    }, [searchParams, pathname, replace])

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            // Only trigger search if value changed from what's in URL (avoids initial double fetch)
            if (term !== (searchParams.get('query') || '')) {
                handleSearch(term)
            }
        }, 300)

        return () => clearTimeout(timeoutId)
    }, [term, handleSearch, searchParams])


    return (
        <div className="relative flex flex-1 flex-shrink-0">
            <label htmlFor="search" className="sr-only">
                Search
            </label>
            <input
                className="peer block w-full rounded-md border border-gray-200 py-[9px] pl-10 text-sm outline-2 placeholder:text-gray-500 text-black"
                placeholder={placeholder}
                value={term}
                onChange={(e) => {
                    setTerm(e.target.value)
                }}
            />
            <div className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
            </div>
        </div>
    )
}
