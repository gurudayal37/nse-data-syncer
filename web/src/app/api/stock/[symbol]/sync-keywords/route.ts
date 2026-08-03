import { NextRequest, NextResponse } from 'next/server'

const GH_OWNER    = 'gurudayal37'
const GH_REPO     = 'nse-data-syncer'
const GH_WORKFLOW = 'keyword_analysis_single.yml'

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ symbol: string }> }
) {
    const { symbol } = await params
    const { pdf_url } = await req.json().catch(() => ({}))

    const ghPat = process.env.GH_PAT
    if (!ghPat) return NextResponse.json({ error: 'GH_PAT not configured' }, { status: 500 })

    const inputs: Record<string, string> = { symbol: symbol.toUpperCase() }
    if (pdf_url) inputs.pdf_url = pdf_url

    const res = await fetch(
        `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/workflows/${GH_WORKFLOW}/dispatches`,
        {
            method: 'POST',
            headers: {
                Authorization: `token ${ghPat}`,
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ref: 'main', inputs }),
        }
    )

    if (res.status !== 204) {
        const text = await res.text()
        return NextResponse.json({ error: text }, { status: res.status })
    }

    return NextResponse.json({ ok: true })
}
