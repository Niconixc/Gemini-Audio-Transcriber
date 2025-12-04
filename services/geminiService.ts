import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Transcribes the provided audio base64 string using Gemini Flash.
 * @param base64Audio - The base64 encoded audio string.
 * @param mimeType - The MIME type of the audio (e.g., 'audio/webm').
 * @returns The transcribed text.
 */
export const transcribeAudio = async (base64Audio: string, mimeType: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Audio,
            },
          },
          {
            text: `Please transcribe the following audio. 
            - If it is speech, transcribe it verbatim.
            - If there are multiple speakers, try to label them (Speaker 1, Speaker 2).
            - Output ONLY the transcription text, no preamble or markdown formatting like 'Here is the transcription:'.`
          }
        ],
      },
    });

    return response.text || "No transcription generated.";
  } catch (error) {
    console.error("Gemini Transcription Error:", error);
    throw new Error("Failed to transcribe audio. Please try again.");
  }
};

/**
 * Improves text to make it sound more natural for speech synthesis.
 * @param text - The raw input text.
 * @returns The improved text.
 */
export const improveTextForSpeech = async (text: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        parts: [{
          text: `Actúa como un editor experto en guiones de locución. Mejora el siguiente texto para que suene natural, fluido y profesional al ser leído por una IA de texto a voz.
          
          Instrucciones:
          1. Corrige gramática y puntuación (crucial para las pausas de la IA).
          2. Mejora el flujo de las oraciones sin cambiar el significado original.
          3. Elimina repeticiones innecesarias.
          4. Mantén el mismo idioma del texto original.
          5. Devuelve SOLO el texto mejorado, sin introducciones ni explicaciones.

          Texto original:
          "${text}"`
        }]
      }]
    });
    return response.text || text;
  } catch (error) {
    console.error("Text Improvement Error:", error);
    throw new Error("Failed to improve text.");
  }
};

/**
 * Generates speech from text using Gemini Flash TTS.
 * @param text - The text to convert to speech.
 * @param voiceName - The specific voice to use (e.g., 'Kore', 'Fenrir').
 * @returns Base64 encoded raw PCM audio data.
 */
export const generateSpeechFromText = async (text: string, voiceName: string = 'Kore'): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!base64Audio) {
      throw new Error("No audio content generated.");
    }
    
    return base64Audio;
  } catch (error) {
    console.error("Gemini TTS Error:", error);
    throw new Error("Failed to generate speech. Please try again.");
  }
};