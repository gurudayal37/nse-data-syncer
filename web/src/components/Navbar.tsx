'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { TrendingUp, Database, PieChart, Calendar, BarChart3, Activity, Zap, Building2, Rocket } from 'lucide-react'
import GlobalSearch from './GlobalSearch'

const NAV_LINKS = [
  { label: 'Stocks',   href: '/stocks',                          icon: Database  },
  { label: 'ETF',      href: '/etf',                             icon: PieChart  },
  { label: 'SME',      href: '/sme-stocks',                      icon: Building2 },
  { label: 'IPO',      href: '/ipo',                             icon: Rocket    },
  { label: 'Momentum', href: '/momentum',                        icon: TrendingUp },
  { label: 'Earnings', href: '/earnings-calendar/upcoming-results', icon: Calendar  },
  { label: 'Indices',  href: '/indices',                         icon: BarChart3 },
  { label: 'Breadth',  href: '/market-breadth',                  icon: Activity  },
  { label: 'Vol Shockers', href: '/volume-shockers',             icon: Zap       },
]

export default function Navbar() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
      <div className="w-full px-4 sm:px-6 h-14 flex items-center gap-3">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0 mr-1">
          <span className="text-base font-extrabold text-slate-900 tracking-tight">
            Momentum<span className="text-sky-500">App</span>
          </span>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-0.5 flex-1 min-w-0">
          {NAV_LINKS.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
                  ${active
                    ? 'bg-sky-50 text-sky-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Search — fixed width, dropdown expands rightward from its right edge */}
        <div className="ml-auto w-56 shrink-0">
          <GlobalSearch compact />
        </div>

      </div>
    </header>
  )
}
