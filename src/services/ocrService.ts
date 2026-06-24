import { generateJSONWithFallback } from '../lib/aiProvider';
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

export const scanMaintenanceForm = async (
  base64Image: string,
  mimeType: string = 'image/jpeg'
): Promise<ScannedLog | null> => {
  try {
    const { data } = await generateJSONWithFallback({
      prompt:
        "You are an expert Air Force Maintenance forms clerk. Analyze this image of an AF Form 781A, 781K, or similar aircraft maintenance form. Extract the aircraft tail number, the main discrepancy reported, the repair action taken (if any), the Job Control Number (JCN), and any visible document number. Extract the tail number exactly as written (e.g. '12-1234' or '0192'). Do not force 'AF-' prefixes. If fields are missing, provide an empty string.",
      schema: ScannedLogSchema,
      context: 'scanMaintenanceForm',
      imageBase64: base64Image,
      imageMimeType: mimeType,
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

export const scanLogBook = async (
  base64Image: string,
  mimeType: string = 'image/jpeg'
): Promise<ScannedLogBookParsed | null> => {
  try {
    const { data } = await generateJSONWithFallback({
      prompt:
        "Analyze this image of a handwritten Air Force Green Log Book or maintenance logbook sheet. Extract a list of maintenance entries. For each entry, find the tail number, the discrepancy, the Job Control Number (JCN) if available, and any repair action noted. Return a JSON array of objects. Extract the tail number exactly as written (e.g. '12-1234'). Do not force 'AF-' prefixes.",
      schema: ScannedLogBookSchema,
      context: 'scanLogBook',
      imageBase64: base64Image,
      imageMimeType: mimeType,
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
  try {
    const { data } = await generateJSONWithFallback({
      prompt:
        "Analyze this training report. Extract a list of training records. For each record, find the personnel's man number, the course code, the course name, and the due date. Return a JSON array of objects with keys: man_number, course_code, course_name, due_date. Due date should be in YYYY-MM-DD format.",
      schema: TrainingReportSchema,
      context: 'parseTrainingReport',
      imageBase64: base64Data,
      imageMimeType: mimeType,
    });
    return data ?? [];
  } catch (error) {
    console.error('Training Report Extraction Error:', error);
    return [];
  }
};
