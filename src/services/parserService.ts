import { getGenAIMilApiKey } from "../lib/gemini";
import { safeParse, TrainingReportSchema, type TrainingReportParsed } from "../lib/aiSchemas";

const GENAI_MIL_ENDPOINT = 'https://api.genai.mil/v1/chat/completions';

export async function parseTrainingReport(base64Data: string, mimeType: string): Promise<TrainingReportParsed> {
  try {
    const apiKey = getGenAIMilApiKey();
    // Alias .xlsm to .xlsx for compatibility
    const supportedMimeType = mimeType === 'application/vnd.ms-excel.sheet.macroEnabled.12'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : mimeType;

    const res = await fetch(GENAI_MIL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'Extract training records from the provided file and return a JSON object with a "records" array. Each record must have: name (string), man_number (string), due_date (YYYY-MM-DD string), course_code (string), course_name (string). Return only valid JSON.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all training records from this file. Return a JSON object: { "records": [ { "name", "man_number", "due_date", "course_code", "course_name" }, ... ] }',
              },
              {
                type: 'image_url',
                image_url: { url: `data:${supportedMimeType};base64,${base64Data}` },
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`GenAI.mil ${res.status}: ${body || res.statusText}`);
    }

    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content;

    // Unwrap { records: [...] } wrapper if present, then validate
    let parsed: TrainingReportParsed | null = null;
    if (typeof raw === 'string') {
      try {
        const outer = JSON.parse(raw);
        const array = Array.isArray(outer) ? outer : (outer?.records ?? outer);
        parsed = safeParse(TrainingReportSchema, JSON.stringify(array), 'parseTrainingReport');
      } catch {
        parsed = safeParse(TrainingReportSchema, raw, 'parseTrainingReport');
      }
    }

    if (!parsed) {
      throw new Error('Training report AI response was empty or malformed.');
    }
    return parsed;
  } catch (error) {
    console.error('Parsing error:', error);
    throw new Error('Failed to parse training report. Please ensure the file is a valid Excel or CSV document.');
  }
}
