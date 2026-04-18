import { z } from 'zod';

// Schemas for Gemini structured outputs. The Gemini SDK's responseSchema
// enforces the shape on the model side, but Gemini can still return
// partial JSON under rate pressure, so we validate defensively on the
// client and surface the actual error instead of crashing downstream.

export const ScannedLogSchema = z.object({
  tail_number: z.string().default(''),
  discrepancy: z.string().default(''),
  repair: z.string().default(''),
  jcn: z.string().optional(),
  doc_number: z.string().optional(),
});
export type ScannedLogParsed = z.infer<typeof ScannedLogSchema>;

export const ScannedLogBookSchema = z.array(
  z.object({
    tail_number: z.string().default(''),
    discrepancy: z.string().default(''),
    repair: z.string().default(''),
    jcn: z.string().optional(),
  })
);
export type ScannedLogBookParsed = z.infer<typeof ScannedLogBookSchema>;

export const TrainingReportRowSchema = z.object({
  name: z.string().optional(),
  man_number: z.string(),
  course_code: z.string().optional(),
  course_name: z.string(),
  due_date: z.string(),
});
export const TrainingReportSchema = z.array(TrainingReportRowSchema);
export type TrainingReportParsed = z.infer<typeof TrainingReportSchema>;

export const TrendAlertSchema = z.object({
  type: z.enum(['critical', 'warning', 'info']),
  title: z.string(),
  description: z.string(),
});
export const TrendAlertsSchema = z.array(TrendAlertSchema);
export type TrendAlertParsed = z.infer<typeof TrendAlertSchema>;

export const DiagnosticFindingSchema = z.object({
  tail_number: z.string(),
  component: z.string(),
  risk: z.enum(['high', 'medium', 'low']),
  pattern: z.string(),
  recommendation: z.string(),
});
export const DiagnosticsSchema = z.array(DiagnosticFindingSchema);
export type DiagnosticFindingParsed = z.infer<typeof DiagnosticFindingSchema>;

export const SupplyRiskSchema = z.object({
  logId: z.string(),
  tail_number: z.string(),
  risk: z.enum(['high', 'medium', 'low']),
  likely_parts: z.array(z.string()).default([]),
  rationale: z.string(),
});
export const SupplyRiskListSchema = z.array(SupplyRiskSchema);
export type SupplyRiskParsed = z.infer<typeof SupplyRiskSchema>;

/** Parse a raw Gemini text payload; returns `null` on invalid JSON/shape. */
export function safeParse<T>(
  schema: z.ZodSchema<T>,
  raw: string | undefined,
  context: string
): T | null {
  if (!raw) return null;
  try {
    const json = JSON.parse(raw);
    const result = schema.safeParse(json);
    if (!result.success) {
      console.warn(`[AI] ${context} returned invalid shape:`, result.error.format());
      return null;
    }
    return result.data;
  } catch (e) {
    console.warn(`[AI] ${context} returned non-JSON:`, e);
    return null;
  }
}
