import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const GITHUB_OWNER = 'gurudayal37'
const GITHUB_REPO = 'nse-data-syncer'
const WORKFLOW_FILE = 'daily_sync_optimized.yml'

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const header = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const query = req.nextUrl.searchParams.get('secret')

  return header === secret || query === secret
}

export async function GET(req: NextRequest) {
  return handleTrigger(req)
}

export async function POST(req: NextRequest) {
  return handleTrigger(req)
}

async function handleTrigger(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  const githubToken = process.env.GITHUB_DISPATCH_TOKEN
  if (!githubToken) {
    return NextResponse.json({ success: false, message: 'GITHUB_DISPATCH_TOKEN is not configured' }, { status: 500 })
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({ ref: 'main' }),
      }
    )

    if (!res.ok) {
      const body = await res.text()
      return NextResponse.json(
        { success: false, message: `GitHub API error: ${res.status}`, body },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true, message: `Dispatched ${WORKFLOW_FILE}`, triggeredAt: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : 'Failed to trigger workflow' },
      { status: 500 }
    )
  }
}
