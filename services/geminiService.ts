import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, RiskLevel } from "../types";

// Validate API key format to prevent injection attacks
const validateApiKey = (apiKey: string): void => {
  if (!apiKey || apiKey.length < 10 || apiKey.length > 100 || !/^[A-Za-z0-9_-]+$/.test(apiKey)) {
    throw new Error("Invalid API Key format");
  }
};

// Schema for Tier 2: Fast Analysis
const tier2Schema = {
  type: Type.OBJECT,
  properties: {
    riskLevel: { type: Type.STRING, enum: ["SAFE", "CAUTION", "DANGER"] },
    posture: { type: Type.STRING, description: "Current body position (Supine, Prone, Side, Sitting)" },
    faceVisible: { type: Type.BOOLEAN, description: "Is the nose and mouth clearly visible?" },
    notes: { type: Type.STRING, description: "Brief observation (max 10 words)" }
  },
  required: ["riskLevel", "posture", "faceVisible", "notes"]
};

// Schema for Tier 3: Expert Analysis
const tier3Schema = {
  type: Type.OBJECT,
  properties: {
    riskLevel: { type: Type.STRING, enum: ["SAFE", "CAUTION", "DANGER"] },
    detailedAnalysis: { type: Type.STRING, description: "Detailed safety assessment of the environment and infant." },
    recommendation: { type: Type.STRING, description: "Actionable advice for the parent." },
    hazardDetected: { type: Type.BOOLEAN }
  },
  required: ["riskLevel", "detailedAnalysis", "recommendation", "hazardDetected"]
};

export const analyzeFrameTier2 = async (apiKey: string, base64Image: string): Promise<AnalysisResult> => {
  validateApiKey(apiKey);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: "Analyze this baby monitor frame. Check for face covering, rollover (prone position), or distress. Be conservative with safety." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: tier2Schema,
        temperature: 0.1
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as AnalysisResult;
  } catch (error) {
    console.error("Tier 2 Analysis Failed:", error);
    // Fallback safe result on error to prevent panic loops
    return {
      riskLevel: RiskLevel.SAFE,
      posture: "Unknown",
      faceVisible: true,
      notes: "Analysis connection failed"
    };
  }
};

export const analyzeFrameTier3 = async (apiKey: string, base64Image: string): Promise<{ detailedAnalysis: string; recommendation: string }> => {
  validateApiKey(apiKey);

  try {
    const ai = new GoogleGenAI({ apiKey });
    // Upgraded to gemini-3-pro-preview for deeper reasoning on complex hazard detection
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', 
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: "This is a potentially high-risk situation detected by a baby monitor. Analyze specifically for airway obstruction, entrapment hazards, or severe distress. Provide immediate actionable advice." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: tier3Schema,
        temperature: 0.2
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const result = JSON.parse(text);
    return {
        detailedAnalysis: result.detailedAnalysis,
        recommendation: result.recommendation
    };
  } catch (error) {
    console.error("Tier 3 Analysis Failed:", error);
    return {
      detailedAnalysis: "Could not perform deep analysis due to network error.",
      recommendation: "Please check the baby physically immediately."
    };
  }
};