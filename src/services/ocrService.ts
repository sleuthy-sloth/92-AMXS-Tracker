import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ScannedLog {
  tail_number: string;
  discrepancy: string;
  repair: string;
}

export const scanMaintenanceForm = async (base64Image: string): Promise<ScannedLog | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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
            text: "You are an expert Air Force Maintenance forms clerk. Analyze this image of an AF Form 781 or similar aircraft maintenance form. Extract the aircraft tail number, the main discrepancy reported, and the repair action taken (if any). Ensure the tail number is formatted like 'AF-92-001'."
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
            repair: { type: Type.STRING }
          },
          required: ["tail_number", "discrepancy", "repair"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("OCR Error:", error);
    return null;
  }
};

export const scanLogBook = async (base64Image: string): Promise<ScannedLog[] | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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
            text: "Analyze this image of a handwritten Air Force Green Log Book. Extract a list of maintenance entries. For each entry, find the tail number, the discrepancy, and the repair. Return a list of entries."
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
              repair: { type: Type.STRING }
            },
            required: ["tail_number", "discrepancy", "repair"]
          }
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Log Book OCR Error:", error);
    return null;
  }
};
