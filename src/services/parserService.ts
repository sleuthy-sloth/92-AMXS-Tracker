import { Type } from "@google/genai";
import { getAI } from "../lib/gemini";
import { safeParse, TrainingReportSchema, type TrainingReportParsed } from "../lib/aiSchemas";

export async function parseTrainingReport(base64Data: string, mimeType: string): Promise<TrainingReportParsed> {
  try {
    const aiClient = getAI();
    // Alias .xlsm to .xlsx for compatibility
    const supportedMimeType = mimeType === 'application/vnd.ms-excel.sheet.macroEnabled.12' 
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : mimeType;

    const response = await aiClient.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          parts: [
            {
              text: `Extract training records from this Excel file. 
              I need the following fields for each record:
              - Name (Surname, Initial)
              - Man #
              - Due Date (YYYY-MM-DD)
              - Course Code (The alphanumeric ID for the course, e.g. G081, ADLS)
              - Course Name
              
              Return the data as a JSON array of objects.`
            },
            {
              inlineData: {
                data: base64Data,
                mimeType: supportedMimeType
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              man_number: { type: Type.STRING },
              due_date: { type: Type.STRING },
              course_code: { type: Type.STRING },
              course_name: { type: Type.STRING }
            },
            required: ["name", "man_number", "due_date", "course_code", "course_name"]
          }
        }
      }
    });

    const parsed = safeParse(TrainingReportSchema, response.text, "parseTrainingReport");
    if (!parsed) {
      throw new Error('Training report AI response was empty or malformed.');
    }
    return parsed;
  } catch (error) {
    console.error('Parsing error:', error);
    throw new Error('Failed to parse training report. Please ensure the file is a valid Excel or CSV document.');
  }
}
