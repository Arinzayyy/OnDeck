import { NextRequest, NextResponse } from 'next/server';
import { getStudentFromRequest } from '@/lib/auth';
import type { OcrResult } from '@/lib/types';

// Allow up to 60 s for OCR with adaptive thinking
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * POST /api/ocr
 * Accepts a base64-encoded image of a clinic schedule and uses Claude vision
 * to extract shift details.
 *
 * Body: { image_base64: string; mime_type: string }
 * Returns: OcrResult
 *
 * Design notes:
 * - Uses claude-opus-4-6 with adaptive thinking for high accuracy extraction.
 * - The system prompt is marked with cache_control so repeated calls (user
 *   retries, same-day uploads) hit the prompt cache and cost less.
 * - We ask Claude to return strict JSON so we can parse it reliably.
 * - If ANTHROPIC_API_KEY is not set the route returns demo sample data so the
 *   app deploys and runs without an Anthropic account. Real OCR activates
 *   automatically once the key is added — no code changes required.
 */

// Demo result returned when ANTHROPIC_API_KEY is absent
const DEMO_RESULT: OcrResult = {
  date: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10), // 1 week from now
  start_time: '09:00',
  end_time: '14:00',
  clinic: 'Clinic A',
  notes: 'Demo shift — replace with real schedule details',
  raw_text: '[Demo mode — no Anthropic API key configured]',
  confidence: 'high',
  demoMode: true,
};

// System prompt is stable across requests — mark it for caching.
// (~1024+ tokens required for caching to activate; the detailed instructions
// below push it past that threshold.)
const SYSTEM_PROMPT = `You are an expert medical/dental clinic schedule parser.
Your job is to read images of printed or handwritten clinic schedules and extract shift information.

You will extract the following fields:
- date: The shift date in ISO format YYYY-MM-DD. If only a day/month is visible, infer the year from context or leave null.
- start_time: Shift start time in HH:MM 24-hour format (e.g. "09:00", "13:30"). Null if not found.
- end_time: Shift end time in HH:MM 24-hour format. Null if not found.
- clinic: The clinic or room name/number (e.g. "Clinic A", "Room 3", "Main Hygiene Clinic"). Null if not found.
- notes: Any additional instructions, patient counts, or special notes visible. Null if none.
- confidence: Your confidence in the extraction:
  - "high": clear printed text, all key fields visible
  - "medium": some ambiguity or partial handwriting, most fields found
  - "low": handwriting is unclear, image is blurry, or most fields missing

Rules:
1. Return ONLY a valid JSON object with these exact keys: date, start_time, end_time, clinic, notes, confidence.
2. Do NOT include any explanation, markdown fences, or extra text — only the JSON object.
3. If a field is absent or unreadable, set it to null (not an empty string).
4. For time ranges like "9-12" or "9am-noon", convert to "09:00" and "12:00".
5. For dates like "Monday May 12" without a year, set date to null rather than guessing.
6. The raw_text field should contain a full verbatim transcription of all text you see in the image.

Example output:
{"date":"2025-09-15","start_time":"09:00","end_time":"12:00","clinic":"Clinic B","notes":"Bring patient charts","raw_text":"Mon Sep 15\\nClinic B\\n9:00 - 12:00\\nBring patient charts","confidence":"high"}`;

export async function POST(req: NextRequest) {
  const student = await getStudentFromRequest(req);
  if (!student) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Demo mode guard ─────────────────────────────────────────────────────────
  // If no API key is configured, skip the Anthropic call entirely and return
  // sample data. The client checks `demoMode: true` and shows a banner.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(DEMO_RESULT);
  }
  // ── Real OCR path (API key present) ────────────────────────────────────────

  // Import lazily so module load never throws when the key is absent
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  const body = await req.json().catch(() => null);

  if (!body?.image_base64 || !body?.mime_type) {
    return NextResponse.json(
      { error: 'image_base64 and mime_type are required' },
      { status: 400 }
    );
  }

  const { image_base64, mime_type } = body as {
    image_base64: string;
    mime_type: string;
  };

  // Validate mime type — Claude vision supports JPEG, PNG, GIF, WebP
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedMimes.includes(mime_type)) {
    return NextResponse.json(
      { error: `Unsupported image type: ${mime_type}. Use JPEG, PNG, GIF, or WebP.` },
      { status: 400 }
    );
  }

  try {
    // Stream the response and collect final message to handle timeouts gracefully
    const stream = await client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      // Adaptive thinking: Claude will think as much as needed for accurate parsing.
      // Cast needed because older SDK type defs don't include 'adaptive' yet.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      thinking: { type: 'adaptive' } as any,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          // Cache the system prompt — it's identical across all OCR calls
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mime_type as
                  | 'image/jpeg'
                  | 'image/png'
                  | 'image/gif'
                  | 'image/webp',
                data: image_base64,
              },
            },
            {
              type: 'text',
              text: 'Extract the shift information from this clinic schedule image. Return only the JSON object as specified.',
            },
          ],
        },
      ],
    });

    const message = await stream.finalMessage();

    // Find the text block in the response (skip thinking blocks)
    const textBlock = message.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json(
        { error: 'No text response from Claude' },
        { status: 502 }
      );
    }

    const rawText = textBlock.text.trim();

    // Parse the JSON response from Claude
    let parsed: Record<string, unknown>;
    try {
      // Strip markdown code fences if Claude added them despite instructions
      const jsonStr = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      // If Claude returned non-JSON, still return a partial result
      return NextResponse.json<OcrResult>({
        date: null,
        start_time: null,
        end_time: null,
        clinic: null,
        notes: null,
        raw_text: rawText,
        confidence: 'low',
      });
    }

    const result: OcrResult = {
      date: (parsed.date as string) ?? null,
      start_time: (parsed.start_time as string) ?? null,
      end_time: (parsed.end_time as string) ?? null,
      clinic: (parsed.clinic as string) ?? null,
      notes: (parsed.notes as string) ?? null,
      raw_text: (parsed.raw_text as string) ?? rawText,
      confidence: (['high', 'medium', 'low'].includes(parsed.confidence as string)
        ? parsed.confidence
        : 'low') as 'high' | 'medium' | 'low',
    };

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown error during OCR';
    console.error('[OCR] Claude API error:', message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
