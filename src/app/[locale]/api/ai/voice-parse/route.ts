import { NextRequest, NextResponse } from 'next/server';

interface AvailableProduct {
  id: string;
  name: string;
  category: string;
  sku: string;
  barcode: string;
  mrp: number;
  purchasePrice: number;
  shelfLifeDays: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transcript, language = 'en-IN', availableProducts = [] } = body;

    if (!transcript || !transcript.trim()) {
      return NextResponse.json(
        {
          ok: false,
          errorType: 'EMPTY_SPEECH',
          error: 'No speech was detected. Please speak clearly into your microphone.',
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          errorType: 'CONFIG_ERROR',
          error: 'GEMINI_API_KEY is not configured in environment variables.',
        },
        { status: 500 }
      );
    }

    const catalogSummary = (availableProducts as AvailableProduct[])
      .slice(0, 30)
      .map((p) => `ID: ${p.id} | Name: ${p.name} | Cat: ${p.category} | Cost: ₹${p.purchasePrice} | ShelfLife: ${p.shelfLifeDays}d`)
      .join('\n');

    const promptText = `You are RetailIQ Multilingual Voice Assistant for Indian retail provision stores.
The shopkeeper spoke an intake update in ${language} (English, ಕನ್ನಡ Kannada, or हिन्दी Hindi):
"${transcript}"

Store Catalog:
${catalogSummary}

Extract the stock intake details from the spoken text.
1. Match the closest product from the store catalog (or extract the product name if new).
2. Extract the quantity (number of units/packs/boxes). If not mentioned, set null.
3. Extract the cost price or unit price (in INR ₹). If not mentioned, use matched product's purchase price.
4. Extract manufacturing date (MFD) if mentioned (ISO YYYY-MM-DD). If relative (e.g., "yesterday"), calculate relative to today: ${new Date().toISOString().slice(0, 10)}.
5. Extract expiry date if mentioned (ISO YYYY-MM-DD). If not mentioned but matched product has shelf life, calculate expiry from MFD + shelf life days.
6. Batch number (generate a realistic one like BN-YYYYMMDD-XXX if not stated).

Return ONLY a valid JSON object matching:
{
  "isValid": boolean,
  "errorMessage": string | null,
  "productName": string,
  "matchedProductId": string | null,
  "quantity": number | null,
  "costPrice": number,
  "mfgDate": string | null,
  "expiryDate": string | null,
  "batchNo": string,
  "languageDetected": "en" | "kn" | "hi",
  "confidence": number,
  "summary": string
}`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: promptText }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return NextResponse.json(
        {
          ok: false,
          errorType: 'API_ERROR',
          error: `Gemini Voice parsing failed with status ${geminiRes.status}: ${errText.slice(0, 150)}`,
        },
        { status: 502 }
      );
    }

    const geminiData = await geminiRes.json();
    const rawReply = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawReply) {
      return NextResponse.json(
        {
          ok: false,
          errorType: 'NO_RESPONSE',
          error: 'No interpretation returned by Gemini Voice Assistant.',
        },
        { status: 500 }
      );
    }

    const parsedResult = JSON.parse(rawReply);

    return NextResponse.json({
      ok: true,
      data: parsedResult,
    });
  } catch (error: any) {
    console.error('Voice parse error:', error);
    return NextResponse.json(
      {
        ok: false,
        errorType: 'SERVER_ERROR',
        error: error.message || 'Internal server error while parsing voice.',
      },
      { status: 500 }
    );
  }
}

