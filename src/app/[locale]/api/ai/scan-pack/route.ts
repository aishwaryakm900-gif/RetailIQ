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
    const { imageBase64, mimeType = 'image/jpeg', availableProducts = [] } = body;

    if (!imageBase64) {
      return NextResponse.json(
        {
          ok: false,
          errorType: 'MISSING_IMAGE',
          error: 'No image was provided. Please upload or take a photo of the product packaging.',
        },
        { status: 400 }
      );
    }

    // Clean base64 string if it contains data URL prefix
    let cleanBase64 = imageBase64;
    let resolvedMime = mimeType;
    if (imageBase64.includes('base64,')) {
      const parts = imageBase64.split('base64,');
      cleanBase64 = parts[1];
      const mimeMatch = parts[0].match(/:(.*?);/);
      if (mimeMatch && mimeMatch[1]) {
        resolvedMime = mimeMatch[1];
      }
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
      .map((p) => `ID: ${p.id} | Name: ${p.name} | Cat: ${p.category} | Cost: ₹${p.purchasePrice} | MRP: ₹${p.mrp}`)
      .join('\n');

    const promptText = `You are RetailIQ AI, a computer vision and packaging OCR intelligence system for Indian retail provision stores.
Carefully examine this photo of a product packaging.
You must accurately extract:
1. Product Name and Brand (e.g. Nandini GoodLife Milk, Real Mixed Fruit Juice 200ml, Tata Tea Gold 250g, Parle-G, Amul Butter, etc.)
2. Category (Dairy, Beverages, Snacks, Bakery, Staples, Personal Care, Household, etc.)
3. Manufacturing Date (MFD / PKD / Pack Date). Format as ISO YYYY-MM-DD.
4. Expiry Date (EXP / Use By / Best Before). Format as ISO YYYY-MM-DD. If packaging says "Best before X months from MFD", calculate the exact expiry date.
5. Pricing in INR: MRP and Purchase / Cost price (if wholesale or MRP visible).
6. Batch Number / Lot Code (e.g. BN-..., LOT-...).
7. Confidence score (0-100).
8. Best matching product from the store catalog list below if applicable.

Store Catalog:
${catalogSummary}

CRITICAL ERROR CHECKING:
- If the image is NOT a retail product packaging (e.g. random selfie, blurry wall, blank image, non-grocery item), set "isValid": false and explain in "errorMessage".
- If the text is too blurry or damaged to read the dates (MFD or Expiry), set "isValid": false and specify that the dates are unreadable in "errorMessage".
- If the expiry date is earlier than the manufacturing date, flag it as "isValid": false with an inconsistency explanation.

Return ONLY a valid JSON object matching this schema:
{
  "isValid": boolean,
  "errorMessage": string | null,
  "productName": string,
  "category": string,
  "matchedProductId": string | null,
  "mfgDate": string,
  "expiryDate": string,
  "costPrice": number,
  "mrp": number,
  "batchNo": string,
  "confidence": number,
  "rawOcrSnippet": string
}`;

    // Call Gemini 2.5 Flash with fallback to gemini-1.5-flash
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: promptText },
              {
                inline_data: {
                  mime_type: resolvedMime,
                  data: cleanBase64,
                },
              },
            ],
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
      console.error('Gemini API call failed:', geminiRes.status, errText);
      return NextResponse.json(
        {
          ok: false,
          errorType: 'API_ERROR',
          error: `Gemini Vision API returned status ${geminiRes.status}. Details: ${errText.slice(0, 200)}`,
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
          error: 'Gemini did not return any OCR result for this image. Please try another angle.',
        },
        { status: 500 }
      );
    }

    let parsedResult;
    try {
      parsedResult = JSON.parse(rawReply);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          errorType: 'PARSE_ERROR',
          error: 'Failed to parse Gemini OCR response as structured JSON.',
        },
        { status: 500 }
      );
    }

    if (!parsedResult.isValid) {
      return NextResponse.json({
        ok: false,
        errorType: 'UNREADABLE_PACK',
        error:
          parsedResult.errorMessage ||
          'The uploaded image does not appear to be a clear product packaging or the dates could not be verified.',
        rawResult: parsedResult,
      });
    }

    // Date sanity validation
    if (parsedResult.mfgDate && parsedResult.expiryDate) {
      const mfg = new Date(parsedResult.mfgDate);
      const exp = new Date(parsedResult.expiryDate);
      if (exp <= mfg) {
        return NextResponse.json({
          ok: false,
          errorType: 'INVALID_DATES',
          error: `Inconsistent dates detected: Expiry date (${parsedResult.expiryDate}) cannot be earlier than or equal to Manufacturing date (${parsedResult.mfgDate}).`,
          rawResult: parsedResult,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      data: parsedResult,
    });
  } catch (error: any) {
    console.error('Scan pack error:', error);
    return NextResponse.json(
      {
        ok: false,
        errorType: 'SERVER_ERROR',
        error: error.message || 'Internal server error occurred while scanning packaging.',
      },
      { status: 500 }
    );
  }
}

