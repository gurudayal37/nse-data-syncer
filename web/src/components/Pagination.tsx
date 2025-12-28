import Link from 'next/link'

interface PaginationProps {
  currentPage: number
  totalPages: number
  sort: string
  order: string
  basePath?: string
}

export default function Pagination({ currentPage, totalPages, sort, order, basePath = '/' }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className="flex gap-2">
      {currentPage > 1 && (
        <Link
          href={`${basePath}?page=${currentPage - 1}&sort=${sort}&order=${order}`}
          className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Previous
        </Link>
      )}
      {currentPage < totalPages && (
        <Link
          href={`${basePath}?page=${currentPage + 1}&sort=${sort}&order=${order}`}
          className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Next
        </Link>
      )}
    </div>
  )
}
