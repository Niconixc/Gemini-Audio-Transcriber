export interface TranscriptionResult {
  text: string;
  detectedLanguage?: string;
  timestamp: number;
}

export enum RecordingState {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export enum AppMode {
  TRANSCRIPTION = 'TRANSCRIPTION',
  TEXT_TO_SPEECH = 'TEXT_TO_SPEECH'
}

export interface AudioVisualizerProps {
  isRecording: boolean;
  audioData?: Uint8Array;
}

export interface Voice {
  id: string; // Gemini API voice name (e.g., 'Kore')
  name: string; // Display name (e.g., 'Elena')
  gender: 'Female' | 'Male';
}

export interface HistoryItem {
  id: string;
  text: string;
  audioUrl: string;
  voiceName: string;
  timestamp: number;
  duration?: number;
}