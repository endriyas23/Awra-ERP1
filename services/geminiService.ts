
import { GoogleGenAI, Type } from "@google/genai";

const API_KEY = process.env.API_KEY || "";

export const getDiagnosticDiagnosis = async (symptoms: string, imageBase64?: string) => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const contents = imageBase64 
    ? {
        parts: [
          { text: `You are a professional poultry veterinarian. Analyze these symptoms: ${symptoms}. Based on common poultry pathology, provide a JSON response with: diagnosis, recommended_medication, urgency (LOW/MEDIUM/HIGH), and biosecurity_measures.` },
          { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }
        ]
      }
    : `You are a professional poultry veterinarian. Analyze these symptoms: ${symptoms}. Provide a JSON response with: diagnosis, recommended_medication, urgency (LOW/MEDIUM/HIGH), and biosecurity_measures.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            diagnosis: { type: Type.STRING },
            recommended_medication: { type: Type.STRING },
            urgency: { type: Type.STRING },
            biosecurity_measures: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["diagnosis", "recommended_medication", "urgency", "biosecurity_measures"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("AI Diagnostic Error:", error);
    throw error;
  }
};
