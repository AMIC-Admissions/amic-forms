import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { pdfBase64, pageCount } = await req.json();
    if (!pdfBase64) {
      return new Response(JSON.stringify({ error: "pdfBase64 is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `You are an expert form field extractor. You will receive a PDF document (as base64) that is a form template.
Your task is to identify all fillable fields in the document and return them as a JSON array.

The document has ${pageCount || 1} page(s).

For each field, provide:
- id: a unique camelCase identifier (e.g., "parentName", "studentId", "dateOfBirth")
- type: one of: parentName, studentName, idNumber, email, phone, date, text, textarea, checkbox, signature, yesno, dropdown, number, fullName, title, company
- label: English label for the field
- labelAr: Arabic label for the field (translate if needed)
- x: estimated X position from left edge, in PDF points (1 inch = 72 points, A4 width = 595 pts)
- y: estimated Y position from top edge, in PDF points (A4 height = 842 pts)
- width: estimated field width in PDF points
- height: estimated field height in PDF points
- page: page number (1-based)
- required: true if the field appears required

Return ONLY a valid JSON array, no explanation, no markdown. Example:
[{"id":"parentName","type":"parentName","label":"Parent Name","labelAr":"اسم ولي الأمر","x":100,"y":150,"width":200,"height":20,"page":1,"required":true}]`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: pdfBase64.includes(",") ? pdfBase64.split(",")[1] : pdfBase64,
                },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: "Anthropic API error", details: errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || "";

    let fields: unknown[] = [];
    try {
      const match = content.match(/\[[\s\S]*\]/);
      if (match) fields = JSON.parse(match[0]);
    } catch {
      return new Response(JSON.stringify({ error: "Failed to parse AI response", raw: content }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ fields }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
