import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

export async function parseTrainingReport(base64Data: string, mimeType: string) {
  try {
    // Alias .xlsm to .xlsx for compatibility
    const supportedMimeType = mimeType === 'application/vnd.ms-excel.sheet.macroEnabled.12' 
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : mimeType;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          parts: [
            {
              text: `Extract training records from this Excel file. 
              I need the following fields for each record:
              - Name (Surname, Initial)
              - Man #
              - Due Date (YYYY-MM-DD)
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
              course_name: { type: Type.STRING }
            },
            required: ["name", "man_number", "due_date", "course_name"]
          }
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error('Parsing error:', error);
    throw new Error('Failed to parse training report. Please ensure the file is a valid Excel or CSV document.');
  }
}
