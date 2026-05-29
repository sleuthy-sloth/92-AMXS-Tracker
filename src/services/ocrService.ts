import { generateJSONWithFallback } from '../lib/aiProvider';
import { getGenAIMilApiKey } from '../lib/gemini';
import {
  safeParse,
  ScannedLogSchema,
  ScannedLogBookSchema,
  TrainingReportSchema,
  type ScannedLogParsed,
  type ScannedLogBookParsed,
  type TrainingReportParsed,
} from '../lib/aiSchemas';

export type ScannedLog = ScannedLogParsed;

export const scanMaintenanceForm = async (base64Image: string): Promise<ScannedLog | null> => {
  try {
    const { data } = await generateJSONWithFallback({
      prompt:
        "You are an expert Air Force Maintenance forms clerk. Analyze this image of an AF Form 781A, 781K, or similar aircraft maintenance form. Extract the aircraft tail number, the main discrepancy reported, the repair action taken (if any), the Job Control Number (JCN), and any visible document number. Extract the tail number exactly as written (e.g. '12-1234' or '0192'). Do not force 'AF-' prefixes. If fields are missing, provide an empty string.",
      schema: ScannedLogSchema,
      context: 'scanMaintenanceForm',
      imageBase64: base64Image,
    });
    return data;
  } catch (err) {
    console.error('OCR Error:', err);
    if (err instanceof Error) {
      if (
        err.message.includes('429') ||
        err.message.toLowerCase().includes('quota') ||
        err.message.toLowerCase().includes('rate limit')
      ) {
        throw new Error(
          'AI image scanning is temporarily unavailable due to upstream rate limits. Please try again later.'
        );
      }
    }
    return null;
  }
};

export const scanLogBook = async (base64Image: string): Promise<ScannedLogBookParsed | null> => {
  try {
    const { data } = await generateJSONWithFallback({
      prompt:
        "Analyze this image of a handwritten Air Force Green Log Book or maintenance logbook sheet. Extract a list of maintenance entries. For each entry, find the tail number, the discrepancy, the Job Control Number (JCN) if available, and any repair action noted. Return a JSON array of objects. Extract the tail number exactly as written (e.g. '12-1234'). Do not force 'AF-' prefixes.",
      schema: ScannedLogBookSchema,
      context: 'scanLogBook',
      imageBase64: base64Image,
    });
    return data;
  } catch (err) {
    console.error('Log Book OCR Error:', err);
    if (err instanceof Error) {
      if (
        err.message.includes('429') ||
        err.message.toLowerCase().includes('quota') ||
        err.message.toLowerCase().includes('rate limit')
      ) {
        throw new Error(
          'AI image scanning is temporarily unavailable due to upstream rate limits. Please try again later.'
        );
      }
    }
    return null;
  }
};

export const parseTrainingReport = async (
  base64Data: string,
  mimeType: string = 'application/pdf'
): Promise<TrainingReportParsed> => {
  // For non-image files (PDF, Excel), call GenAI.mil directly with keys from build-time injection
  if (mimeType !== 'image/jpeg' && mimeType !== 'image/png' && mimeType !== 'image/webp') {
    try {
      const apiKey = getGenAIMilApiKey();
      const res = await fetch('https://api.genai.mil/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gemini-3.5-flash',
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: 'Extract training records and return valid JSON only.',
            },
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: { url: `data:${mimeType};base64,${base64Data}` },
                },
                {
                  type: 'text',
                  text: 'Analyze this training report. Extract a list of training records. For each record, find the personnel man number, course code, course name, and due date. Return a JSON object: { "records": [ { "man_number", "course_code", "course_name", "due_date" } ] }. Due date should be YYYY-MM-DD format.',
                },
              ],
            },
          ],
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}) as Record<string, unknown>);
        throw new Error(
          `GenAI.mil ${res.status}: ${(errBody as { error?: { message?: string } })?.error?.message ?? res.statusText}`
        );
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const raw = json.choices?.[0]?.message?.content;

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

      return parsed ?? [];
    } catch (error) {
      console.error('Training Report Extraction Error:', error);
      return [];
    }
  }

  // Use generateJSONWithFallback for images (supports OpenRouter fallback)
  try {
    const { data } = await generateJSONWithFallback({
      prompt:
        "Analyze this training report (PDF or Image). Extract a list of training records. For each record, find the personnel's man number, the course code, the course name, and the due date. Return a JSON array of objects with keys: man_number, course_code, course_name, due_date. Due date should be in YYYY-MM-DD format.",
      schema: TrainingReportSchema,
      context: 'parseTrainingReport',
      imageBase64: base64Data,
    });
    return data ?? [];
  } catch (error) {
    console.error('Training Report Extraction Error:', error);
    return [];
  }
};
