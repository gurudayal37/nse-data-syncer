import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import path from 'path'

const GH_OWNER = 'gurudayal37'
const GH_REPO = 'nse-data-syncer'
const GH_WORKFLOW = 'sync_quarterly_results.yml'
const GH_REF = 'main'

function runLocally(symbol: string): Promise<NextResponse> {
    const scriptPath = path.join(process.cwd(), '..', 'scripts', 'sync_quarterly_results.py')
    const env = { ...process.env }

    return new Promise((resolve) => {
        exec(
            `python3 "${scriptPath}" --symbol "${symbol}"`,
            { env, timeout: 120_000 },
            (error, stdout, stderr) => {
                if (error) {
                    console.error('[sync/local] error:', error.message, stderr)
                    return resolve(NextResponse.json({ success: false, error: error.message }, { status: 500 }))
                }
                const lastLine = stdout.trim().split('\n').pop() ?? ''
                try {
                    const result = JSON.parse(lastLine)
                    return resolve(NextResponse.json(result, { status: result.success ? 200 : 500 }))
                } catch {
                    console.error('[sync/local] unexpected output:', stdout)
                    return resolve(NextResponse.json({ success: false, error: 'Unexpected script output' }, { status: 500 }))
                }
            }
        )
    })
}

async function triggerGitHub(symbol: string): Promise<NextResponse> {
    const pat = process.env.GH_PAT
    if (!pat || pat === 'ghp_your_token_here') {
        return NextResponse.json({ success: false, error: 'GH_PAT not configured' }, { status: 500 })
    }

    const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/workflows/${GH_WORKFLOW}/dispatches`
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `token ${pat}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ref: GH_REF, inputs: { symbol } }),
    })

    if (res.status === 204) {
        const actionsUrl = `https://github.com/${GH_OWNER}/${GH_REPO}/actions/workflows/${GH_WORKFLOW}`
        return NextResponse.json({ success: true, symbol, actionsUrl })
    }

    const body = await res.text()
    console.error('[sync/github] API error:', res.status, body)
    return NextResponse.json({ success: false, error: `GitHub API returned ${res.status}` }, { status: 502 })
}

export async function POST(
    _req: NextRequest,
    { params }: { params: Promise<{ symbol: string }> }
) {
    const { symbol } = await params
    const cleanSymbol = decodeURIComponent(symbol).toUpperCase().replace(/\.(NS|BO)$/, '')

    // Local dev → run Python directly; production (Vercel) → trigger GitHub Actions
    if (process.env.NODE_ENV === 'development') {
        return runLocally(cleanSymbol)
    }
    return triggerGitHub(cleanSymbol)
}
