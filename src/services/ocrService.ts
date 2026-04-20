import { Type } from "@google/genai";
import { getAI } from "../lib/gemini";
import {
  safeParse,
  ScannedLogSchema,
  ScannedLogBookSchema,
  TrainingReportSchema,
  type ScannedLogParsed,
  type ScannedLogBookParsed,
  type TrainingReportParsed,
} from "../lib/aiSchemas";

export type ScannedLog = ScannedLogParsed;

export const scanMaintenanceForm = async (base64Image: string): Promise<ScannedLog | null> => {
  try {
    const response = await getAI().models.generateContent({
      model: "gemini-1.5-flash-latest",
      contents: [{
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image
            }
          },
          {
            text: "You are an expert Air Force Maintenance forms clerk. Analyze this image of an AF Form 781A, 781K, or similar aircraft maintenance form. Extract the aircraft tail number, the main discrepancy reported, the repair action taken (if any), the Job Control Number (JCN), and any visible document number. Ensure the tail number is formatted professionally like 'AF-92-001'. If fields are missing, provide an empty string."
          }
        ]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tail_number: { type: Type.STRING },
            discrepancy: { type: Type.STRING },
            repair: { type: Type.STRING },
            jcn: { type: Type.STRING },
            doc_number: { type: Type.STRING }
          },
          required: ["tail_number", "discrepancy", "repair"]
        }
      }
    });

    return safeParse(ScannedLogSchema, response.text, "scanMaintenanceForm");
  } catch (error) {
    console.error("OCR Error:", error);
    return null;
  }
};

export const scanLogBook = async (base64Image: string): Promise<ScannedLogBookParsed | null> => {
  try {
    const response = await getAI().models.generateContent({
      model: "gemini-1.5-flash-latest",
      contents: [{
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image
            }
          },
          {
            text: "Analyze this image of a handwritten Air Force Green Log Book or maintenance logbook sheet. Extract a list of maintenance entries. For each entry, find the tail number, the discrepancy, the Job Control Number (JCN) if available, and any repair action noted. Return a JSON array of objects. Ensure tail numbers are professionally formatted like 'AF-92-001'."
          }
        ]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              tail_number: { type: Type.STRING },
              discrepancy: { type: Type.STRING },
              repair: { type: Type.STRING },
              jcn: { type: Type.STRING }
            },
            required: ["tail_number", "discrepancy", "repair"]
          }
        }
      }
    });

    return safeParse(ScannedLogBookSchema, response.text, "scanLogBook");
  } catch (error) {
    console.error("Log Book OCR Error:", error);
    return null;
  }
};

export const parseTrainingReport = async (base64Data: string, mimeType: string = "application/pdf"): Promise<TrainingReportParsed> => {
  try {
    const response = await getAI().models.generateContent({
      model: "gemini-1.5-flash-latest",
      contents: [{
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data
            }
          },
          {
            text: "Analyze this training report (PDF or Image). Extract a list of training records. For each record, find the personnel's man number, the course code, the course name, and the due date. Return a JSON array of objects with keys: man_number, course_code, course_name, due_date. Due date should be in YYYY-MM-DD format."
          }
        ]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              man_number: { type: Type.STRING },
              course_code: { type: Type.STRING },
              course_name: { type: Type.STRING },
              due_date: { type: Type.STRING }
            },
            required: ["man_number", "course_name", "due_date"]
          }
        }
      }
    });

    return safeParse(TrainingReportSchema, response.text, "parseTrainingReport") ?? [];
  } catch (error) {
    console.error("Training Report Extraction Error:", error);
    return [];
  }
};
