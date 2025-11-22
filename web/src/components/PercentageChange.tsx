// Shared component for rendering percentage changes

interface PercentageChangeProps {
  value: number | null | undefined
  className?: string
}

export default function PercentageChange({ value, className = '' }: PercentageChangeProps) {
  if (value === null || value === undefined) {
    return <span className={`text-gray-400 ${className}`}>-</span>
  }

  const colorClass = value >= 0 ? 'text-green-600' : 'text-red-600'
  const sign = value > 0 ? '+' : ''
  
  return (
    <span className={`${colorClass} ${className}`}>
      {sign}{value.toFixed(2)}%
    </span>
  )
}

