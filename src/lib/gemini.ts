import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY || '';
export const ai = new GoogleGenAI({ apiKey });

export const MODELS = {
  FLASH: 'gemini-3-flash-preview',
  EMBEDDING: 'gemini-embedding-2-preview'
};

export async function summarizeDocument(text: string) {
  const prompt = `
    Analyze the following text and provide:
    1. A concise 3-line summary of the core thesis/arguments.
    2. Exactly 5 highly relevant keywords (hashtags).
    
    Text: ${text.substring(0, 30000)}
    
    Format the response MUST be a valid JSON object like this:
    {
      "summary": ["line 1", "line 2", "line 3"],
      "keywords": ["tag1", "tag2", "tag3", "tag4", "tag5"]
    }
  `;

  const response = await ai.models.generateContent({
    model: MODELS.FLASH,
    contents: prompt
  });

  const rawText = response.text || '';
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  const jsonText = jsonMatch ? jsonMatch[0] : rawText;
  try {
    return JSON.parse(jsonText);
  } catch (e) {
    return {
      summary: [rawText.substring(0, 200)],
      keywords: ["general"]
    };
  }
}

export async function getSmartInsight(noteContent: string, context: string) {
  const prompt = `
    You are an AI research assistant. A user is writing a note. 
    Compare this note with the current research context and provide a brief, high-density "Synapse Insight".
    
    Current Note: "${noteContent}"
    Research Context: "${context}"
    
    Identify connections, contradictions, or missing links. Keep it under 2 sentences.
    Start with something like "This point connects to..." or "Interestingly, this contrast with...".
  `;

  const response = await ai.models.generateContent({
    model: MODELS.FLASH,
    contents: prompt
  });
  return response.text || '';
}

export async function generateEmbedding(text: string) {
  const result = await ai.models.embedContent({
    model: MODELS.EMBEDDING,
    contents: [{ parts: [{ text }] }]
  });
  return result.embeddings[0].values;
}
