import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { MessageParam } from '@anthropic-ai/sdk/resources'
import prisma from '@/lib/prisma'

export const maxDuration = 120

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PROMPT = `You are analyzing an Indian company's quarterly financial result PDF filing from NSE/BSE.

Extract the following from the financial statements and provide a PEAD (Post-Earnings Announcement Drift) analysis.

Respond with ONLY valid JSON, no markdown, no explanation:
{
  "revenue": <number in Crores, null if not found>,
  "ebit": <operating profit / EBIT in Crores, null if not found>,
  "net_profit": <net profit / PAT in Crores, null if not found>,
  "eps": <basic EPS in rupees, null if not found>,
  "signal": "LONG" or "SHORT",
  "confidence": "HIGH" or "MEDIUM" or "LOW",
  "key_positives": ["point 1", "point 2", "point 3"],
  "key_negatives": ["point 1", "point 2"],
  "reasoning": "2-3 sentence explanation of the LONG/SHORT signal"
}

Rules:
- Use standalone figures if available, else consolidated
- All monetary values in Indian Rupees Crores (₹ Cr)
- LONG if results beat expectations / strong growth / positive surprise
- SHORT if results miss / weak / deteriorating margins`

export async function POST(req: NextRequest) {
  try {
    const { symbol, pdf_url, seq_id, result_date } = await req.json()

    if (!symbol || !pdf_url || !result_date) {
      return NextResponse.json({ error: 'symbol, pdf_url, result_date required' }, { status: 400 })
    }

    // Check if already analysed
    const existing = await prisma.result_analyses.findFirst({
      where: { symbol: symbol.toUpperCase(), result_date: new Date(result_date) },
    })
    if (existing) {
      return NextResponse.json({ ok: true, cached: true, data: existing })
    }

    // Fetch PDF
    const pdfRes = await fetch(pdf_url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    })
    if (!pdfRes.ok) {
      return NextResponse.json({ error: `Failed to fetch PDF: ${pdfRes.status}` }, { status: 502 })
    }

    const pdfBytes = await pdfRes.arrayBuffer()
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64')

    // Call Claude with the PDF
    const userMessage: MessageParam = {
      role: 'user',
      content: [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } } as any,
        { type: 'text', text: PROMPT },
      ],
    }
    const msg = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      messages: [userMessage],
    })

    const raw = (msg.content[0] as { type: string; text: string }).text.trim()

    // Strip markdown fences if present
    const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(json)

    // Store in DB
    const saved = await prisma.result_analyses.create({
      data: {
        symbol:        symbol.toUpperCase(),
        result_date:   new Date(result_date),
        seq_id:        seq_id ?? null,
        pdf_url,
        revenue:       parsed.revenue    ?? null,
        ebit:          parsed.ebit       ?? null,
        net_profit:    parsed.net_profit ?? null,
        eps:           parsed.eps        ?? null,
        signal:        parsed.signal     ?? null,
        confidence:    parsed.confidence ?? null,
        key_positives: parsed.key_positives ? JSON.stringify(parsed.key_positives) : null,
        key_negatives: parsed.key_negatives ? JSON.stringify(parsed.key_negatives) : null,
        reasoning:     parsed.reasoning  ?? null,
      },
    })

    return NextResponse.json({ ok: true, cached: false, data: saved })
  } catch (err: unknown) {
    console.error('analyse error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
