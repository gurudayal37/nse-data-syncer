'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

const KEYWORDS = [
  // AI / Compute
  { key: 'data_centre',        label: 'Data Centre' },
  { key: 'liquid_cooling',     label: 'Liquid Cooling' },
  { key: 'ai',                 label: 'AI' },
  { key: 'sovereign_ai',       label: 'Sovereign AI' },
  { key: 'agentic_ai',         label: 'Agentic AI' },
  { key: 'gpu_inference',      label: 'GPU / Inference' },
  { key: 'slm',                label: 'SLM / Foundation Model' },
  { key: 'cloud',              label: 'Cloud' },
  { key: 'quantum',            label: 'Quantum' },
  // Power / Energy
  { key: 'bess',               label: 'BESS / Energy Storage' },
  { key: 'transmission',       label: 'Transmission / HVDC' },
  { key: 'transformer',        label: 'Transformer' },
  { key: 'switchgear',         label: 'Switchgear' },
  { key: 'renewable',          label: 'Renewable' },
  { key: 'nuclear',            label: 'Nuclear / SMR' },
  // Semiconductor / Electronics
  { key: 'semiconductor',      label: 'Semiconductor' },
  { key: 'osat',               label: 'OSAT / ATMP' },
  { key: 'sic_gan',            label: 'SiC / GaN' },
  { key: 'pcb',                label: 'PCB / HDI' },
  { key: 'optical_fibre',      label: 'Optical Fibre' },
  { key: 'ems',                label: 'EMS' },
  { key: 'odm',                label: 'ODM' },
  { key: 'cdmo',               label: 'CDMO' },
  // Defence / Aerospace
  { key: 'aerospace',          label: 'Aerospace' },
  { key: 'defence',            label: 'Defence' },
  { key: 'electronic_warfare', label: 'Electronic Warfare / Radar' },
  { key: 'drone',              label: 'Drone / UAV' },
  { key: 'anti_drone',         label: 'Anti-Drone' },
  { key: 'space',              label: 'Space / Satcom' },
  { key: 'kavach',             label: 'Kavach' },
  // Robotics
  { key: 'robotics',           label: 'Robotics / Humanoid' },
  // Geographies
  { key: 'us',                 label: 'US Market' },
  { key: 'europe',             label: 'Europe / UK' },
  { key: 'china',              label: 'China' },
  { key: 'export',             label: 'Export' },
  // Health / Pharma / Materials
  { key: 'glp1',               label: 'GLP-1' },
  { key: 'rare_earth',         label: 'Rare Earth / Critical Minerals' },
  // EV / Mobility
  { key: 'ev',                 label: 'EV' },
  // Business metrics
  { key: 'capex',              label: 'Capex' },
  { key: 'order_book',         label: 'Order Book' },
  { key: 'cctv',               label: 'CCTV / Camera' },
  { key: 'precision_engineering', label: 'Precision Engineering' },
  { key: 'best',               label: 'Best' },
  { key: 'top',                label: 'Top' },
  { key: 'leader',             label: 'Leader' },
  { key: 'highest',            label: 'Highest' },
  { key: 'sentiment',          label: 'Sentiment' },
]

export default function KeywordTabs({ active }: { active: string }) {
  const router      = useRouter()
  const pathname    = usePathname()
  const searchParams = useSearchParams()

  const go = (key: string) => {
    const p = new URLSearchParams(searchParams.toString())
    p.set('keyword', key)
    p.delete('sort')
    p.delete('order')
    router.push(`${pathname}?${p.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-2">
      {KEYWORDS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => go(key)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            active === key
              ? 'bg-sky-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
