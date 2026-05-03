/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { EmergencyCategory, UrgencyLevel } from "../types";

// Safety check for the environment variable
const getAI = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set');
  }
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
};

export interface AIClassification {
  primaryCategory: EmergencyCategory;
  allCategories: EmergencyCategory[];
  urgency: UrgencyLevel;
  reasoning: string;
  detectedIssues: string[];
  suggestedSteps: string[];
}

export async function classifyEmergencyAI(text: string, language: string = 'en'): Promise<AIClassification> {
  const ai = getAI();
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze the following emergency request text and provide a structured classification.
    Target Language: ${language} (Ensure 'reasoning', 'detectedIssues', and 'suggestedSteps' are written in this language).
    Request text: "${text}"
    
    If multiple issues are present (e.g. fire and someone is injured), identify all of them.
    Assign a 'primaryCategory' based on the most immediate threat to life.
    
    Valid categories: medical, fire, police, water, electricity, roads, waste, cybercrime, domestic, animal, lights, toilets, noise, transit, traffic, building, records, crop, general.
    Valid urgency levels: low, medium, high.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          primaryCategory: { 
            type: Type.STRING, 
            description: "The most critical category based on life threat." 
          },
          allCategories: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "All categories that are relevant to the text."
          },
          urgency: {
            type: Type.STRING,
            description: "Overall urgency level: low, medium, or high."
          },
          reasoning: {
            type: Type.STRING,
            description: "Brief explanation of why these categories were chosen. MUST BE IN TARGET LANGUAGE."
          },
          detectedIssues: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Short phrases describing each specific issue detected. MUST BE IN TARGET LANGUAGE."
          },
          suggestedSteps: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Critical next steps for the user to take immediately. MUST BE IN TARGET LANGUAGE."
          }
        },
        required: ["primaryCategory", "allCategories", "urgency", "reasoning", "detectedIssues", "suggestedSteps"]
      }
    }
  });

  const result = JSON.parse(response.text.trim()) as AIClassification;
  
  // Basic validation to ensure returned strings are valid types
  // In a real app we'd be stricter
  return result;
}

export async function classifyEmergencyFromImage(base64Image: string, language: string = 'en'): Promise<AIClassification> {
  const ai = getAI();
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        role: "user",
        parts: [
          { text: `Analyze this image of an emergency situation and provide a structured classification. 
                   Target Language: ${language} (Ensure 'reasoning', 'detectedIssues', and 'suggestedSteps' are written in this language).
                   Assign a 'primaryCategory' and identify all relevant categories and urgency level.` },
          {
            inlineData: {
              data: base64Image,
              mimeType: "image/jpeg"
            }
          }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          primaryCategory: { type: Type.STRING },
          allCategories: { type: Type.ARRAY, items: { type: Type.STRING } },
          urgency: { type: Type.STRING },
          reasoning: { type: Type.STRING },
          detectedIssues: { type: Type.ARRAY, items: { type: Type.STRING } },
          suggestedSteps: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["primaryCategory", "allCategories", "urgency", "reasoning", "detectedIssues", "suggestedSteps"]
      }
    }
  });

  return JSON.parse(response.text.trim()) as AIClassification;
}

export async function classifyEmergencyFromAudio(base64Audio: string, mimeType: string, language: string = 'en'): Promise<AIClassification> {
  const ai = getAI();
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        role: "user",
        parts: [
          { text: `Listen to this audio recording of a person reporting an emergency and provide a structured classification. 
                   Target Language: ${language} (Ensure 'reasoning', 'detectedIssues', and 'suggestedSteps' are written in this language).
                   If they just say hello or something irrelevant, classify as 'general' with 'low' urgency.` },
          {
            inlineData: {
              data: base64Audio,
              mimeType: mimeType
            }
          }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          primaryCategory: { type: Type.STRING },
          allCategories: { type: Type.ARRAY, items: { type: Type.STRING } },
          urgency: { type: Type.STRING },
          reasoning: { type: Type.STRING },
          detectedIssues: { type: Type.ARRAY, items: { type: Type.STRING } },
          suggestedSteps: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["primaryCategory", "allCategories", "urgency", "reasoning", "detectedIssues", "suggestedSteps"]
      }
    }
  });

  return JSON.parse(response.text.trim()) as AIClassification;
}
