import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { AudioVisualizer } from './components/AudioVisualizer';
import { AudioPlayer } from './components/AudioPlayer';
import { FileUploader } from './components/FileUploader';
import { transcribeAudio, generateSpeechFromText, improveTextForSpeech } from './services/geminiService';
import { blobToBase64, formatTime, pcmToWavBlob } from './utils/audioUtils';
import { RecordingState, AppMode, Voice, HistoryItem } from './types';

const MAX_TTS_CHARS = 8000;
const HISTORY_STORAGE_KEY = 'audio_history_v1';
const VOICE_STORAGE_KEY = 'selected_voice_v1';

// Gemini 2.5 Flash TTS Voices - FEMALE ONLY as requested
const VOICES: Voice[] = [
  { id: 'Kore', name: 'Elena (Natural)', gender: 'Female' },
  { id: 'Zephyr', name: 'Sofia (Calmada)', gender: 'Female' },
];

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.TRANSCRIPTION);
  
  // Transcription State
  const [recordingState, setRecordingState] = useState<RecordingState>(RecordingState.IDLE);
  const [transcription, setTranscription] = useState<string>('');
  const [duration, setDuration] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // TTS State
  const [ttsText, setTtsText] = useState<string>('');
  const [selectedVoice, setSelectedVoice] = useState<string>(VOICES[0].id);
  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState<boolean>(false);
  const [isImprovingText, setIsImprovingText] = useState<boolean>(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Load persistence
  useEffect(() => {
    const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
    
    const savedVoice = localStorage.getItem(VOICE_STORAGE_KEY);
    if (savedVoice && VOICES.some(v => v.id === savedVoice)) {
      setSelectedVoice(savedVoice);
    }
  }, []);

  // Save persistence
  useEffect(() => {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem(VOICE_STORAGE_KEY, selectedVoice);
  }, [selectedVoice]);

  const startTimer = useCallback(() => {
    setDuration(0);
    timerRef.current = window.setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // --- Transcription Handlers ---

  const handleStartRecording = async () => {
    setErrorMsg(null);
    setTranscription('');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stopTimer();
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop()); // Stop the mic

        await processAudio(audioBlob, mimeType);
      };

      mediaRecorder.start();
      setRecordingState(RecordingState.RECORDING);
      startTimer();

    } catch (err) {
      console.error("Error accessing microphone:", err);
      setErrorMsg("Could not access microphone. Please ensure permissions are granted.");
      setRecordingState(RecordingState.ERROR);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleFileUpload = async (file: File) => {
    setErrorMsg(null);
    setTranscription('');
    
    if (file.size > 25 * 1024 * 1024) { // 25MB limit check (optional, but good practice)
      setErrorMsg("File is too large. Please upload a file smaller than 25MB.");
      return;
    }

    try {
      // Create a blob from the file to reuse existing processAudio
      const blob = new Blob([file], { type: file.type });
      await processAudio(blob, file.type);
    } catch (err) {
       console.error("File upload error", err);
       setErrorMsg("Error reading file.");
    }
  };

  const processAudio = async (blob: Blob, mimeType: string) => {
    setRecordingState(RecordingState.PROCESSING);
    try {
      const base64Audio = await blobToBase64(blob);
      const result = await transcribeAudio(base64Audio, mimeType);
      setTranscription(result);
      setRecordingState(RecordingState.COMPLETED);
    } catch (err) {
      setErrorMsg("Failed to transcribe audio. Please try again.");
      setRecordingState(RecordingState.ERROR);
    }
  };

  const handleCopyTranscription = () => {
    if (transcription) {
      navigator.clipboard.writeText(transcription);
    }
  };

  const handleResetTranscription = () => {
    setRecordingState(RecordingState.IDLE);
    setTranscription('');
    setDuration(0);
    setErrorMsg(null);
  };

  // --- TTS Handlers ---

  const handleGenerateSpeech = async () => {
    if (!ttsText.trim()) return;
    
    setIsGeneratingSpeech(true);
    setErrorMsg(null);
    
    try {
      const base64Audio = await generateSpeechFromText(ttsText, selectedVoice);
      
      // Convert PCM base64 to WAV Blob
      const wavBlob = pcmToWavBlob(base64Audio);
      const audioUrl = URL.createObjectURL(wavBlob);
      
      setGeneratedAudioUrl(audioUrl);
      
      // Add to History
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        text: ttsText,
        audioUrl: audioUrl,
        voiceName: VOICES.find(v => v.id === selectedVoice)?.name || 'Unknown',
        timestamp: Date.now()
      };
      
      setHistory(prev => [newItem, ...prev]);

      setIsGeneratingSpeech(false);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to generate speech.");
      setIsGeneratingSpeech(false);
    }
  };

  const handleImproveText = async () => {
    if (!ttsText.trim()) return;
    setIsImprovingText(true);
    try {
      const improved = await improveTextForSpeech(ttsText);
      setTtsText(improved);
    } catch (err) {
      setErrorMsg("Failed to improve text.");
    } finally {
      setIsImprovingText(false);
    }
  };

  const handleDownload = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const playHistoryItem = async (item: HistoryItem) => {
    // If the audioURL is a blob URL that has been revoked (after refresh), we might need to handle it.
    // However, since we can't persist Blob URLs, we rely on the user "Regenerating" if it's a fresh session,
    // or just loading the text.
    // For this session, it works. For persistence across refreshes, we can only persist text.
    // Let's check if the blob exists (not possible easily), so we basically load the text and prompt to generate.
    
    setTtsText(item.text);
    const voice = VOICES.find(v => v.name === item.voiceName);
    if (voice) setSelectedVoice(voice.id);
    
    // We scroll to top to show it's loaded
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Check if the URL is likely valid (from this session)
    if (item.audioUrl && item.audioUrl.startsWith('blob:')) {
       // Ideally we would check validity, but we can just try setting it.
       setGeneratedAudioUrl(item.audioUrl);
    }
  };
  
  const handleRegenerateFromHistory = (item: HistoryItem) => {
      setTtsText(item.text);
      const voice = VOICES.find(v => v.name === item.voiceName);
      if (voice) setSelectedVoice(voice.id);
      handleGenerateSpeech(); // Auto trigger generation
  };

  const clearText = () => {
    setTtsText('');
    setGeneratedAudioUrl(null);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      stopTimer();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      // Revoke URLs to avoid memory leaks
      history.forEach(item => URL.revokeObjectURL(item.audioUrl));
    };
  }, [stopTimer]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-blue-500/30 pb-12">
      <Header />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col items-center space-y-8">
        
        {/* Mode Switcher */}
        <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-800 backdrop-blur-sm shadow-xl w-full max-w-md">
          <button
            onClick={() => { setMode(AppMode.TRANSCRIPTION); setErrorMsg(null); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              mode === AppMode.TRANSCRIPTION 
                ? 'bg-slate-800 text-white shadow-md ring-1 ring-white/10' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Speech to Text
          </button>
          <button
            onClick={() => { setMode(AppMode.TEXT_TO_SPEECH); setErrorMsg(null); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              mode === AppMode.TEXT_TO_SPEECH 
                ? 'bg-slate-800 text-white shadow-md ring-1 ring-white/10' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Text to Speech
          </button>
        </div>

        {/* Global Error Message */}
        {errorMsg && (
          <div className="w-full max-w-3xl bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl flex items-center space-x-3 animate-fade-in-up">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 flex-shrink-0">
              <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
            </svg>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* --- Content Area --- */}
        
        {mode === AppMode.TRANSCRIPTION ? (
          // TRANSCRIPTION UI
          <div className="w-full max-w-3xl space-y-8 animate-fade-in-up">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Recorder Card */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[250px] shadow-lg relative overflow-hidden group">
                  <div className={`absolute inset-0 bg-blue-500/5 transition-opacity duration-500 ${recordingState === RecordingState.RECORDING ? 'opacity-100' : 'opacity-0'}`}></div>
                  
                  <div className="mb-6 font-mono text-4xl text-slate-200 tabular-nums tracking-wider relative z-10">
                    {formatTime(duration)}
                  </div>

                  <div className="h-10 mb-6 w-full flex items-center justify-center relative z-10">
                     {recordingState === RecordingState.RECORDING ? (
                       <AudioVisualizer isRecording={true} />
                     ) : (
                       <div className="text-slate-500 text-sm font-medium bg-slate-800/50 px-3 py-1 rounded-full">
                         {recordingState === RecordingState.PROCESSING ? 'Procesando...' : 'Micrófono Listo'}
                       </div>
                     )}
                  </div>

                  <div className="relative z-10">
                    {recordingState === RecordingState.IDLE || recordingState === RecordingState.COMPLETED || recordingState === RecordingState.ERROR ? (
                      <button
                        onClick={handleStartRecording}
                        className="group relative w-16 h-16 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25 transition-all transform hover:scale-105 active:scale-95"
                      >
                        <span className="absolute inset-0 rounded-full border border-white/20"></span>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-7 h-7">
                          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                        </svg>
                      </button>
                    ) : recordingState === RecordingState.RECORDING ? (
                      <button
                        onClick={handleStopRecording}
                        className="w-16 h-16 rounded-full bg-slate-800 hover:bg-slate-700 text-red-500 flex items-center justify-center border-2 border-red-500/50 transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-red-500/10"
                      >
                        <div className="w-6 h-6 bg-current rounded-md"></div>
                      </button>
                    ) : (
                       <div className="w-16 h-16 flex items-center justify-center">
                         <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                       </div>
                    )}
                  </div>
                </div>

                {/* File Upload Card */}
                <div className="h-full">
                   <FileUploader 
                      onFileSelected={handleFileUpload} 
                      disabled={recordingState === RecordingState.RECORDING || recordingState === RecordingState.PROCESSING} 
                   />
                </div>
            </div>

            {/* Transcription Result */}
            {(transcription || recordingState === RecordingState.COMPLETED) && (
              <div className="w-full animate-fade-in-up">
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl ring-1 ring-white/5">
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-b border-slate-800">
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V5zm3 1h9v2H6V6zm0 4h9v2H6v-2z" clipRule="evenodd" />
                      </svg>
                      Resultado
                    </h3>
                    <div className="flex space-x-1">
                       <button 
                        onClick={handleCopyTranscription}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                        title="Copiar texto"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                        </svg>
                      </button>
                      <button 
                        onClick={handleResetTranscription}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                        title="Nueva transcripción"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="p-6 bg-slate-900/50 min-h-[150px] text-lg leading-relaxed text-slate-200 whitespace-pre-wrap">
                    {transcription}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          // TTS UI
          <div className="w-full max-w-3xl animate-fade-in-up space-y-6">
            
            <div className="text-center md:text-left">
              <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Convierte Texto a Voz</h1>
              <p className="text-slate-400">Genera audios naturales con nuestras voces de IA premium.</p>
            </div>

            {/* Text Input Area */}
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <label className="text-sm font-medium text-slate-300 ml-1">Editor de Texto</label>
                <button 
                  onClick={handleImproveText}
                  disabled={isImprovingText || !ttsText.trim()}
                  className={`text-xs flex items-center space-x-1 px-3 py-1.5 rounded-lg border transition-all ${!ttsText.trim() ? 'opacity-50 cursor-not-allowed border-slate-800 text-slate-600' : 'border-indigo-500/20 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 hover:border-indigo-500/30'}`}
                >
                  {isImprovingText ? (
                    <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                      <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span>Mejorar con IA</span>
                </button>
              </div>
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl blur opacity-0 group-focus-within:opacity-20 transition duration-500"></div>
                <div className="relative">
                  <textarea
                    value={ttsText}
                    onChange={(e) => setTtsText(e.target.value)}
                    maxLength={MAX_TTS_CHARS}
                    placeholder="Escribe aquí el texto que deseas transformar en audio..."
                    className="w-full h-48 bg-slate-900 border border-slate-700 rounded-xl p-5 text-base text-slate-200 focus:outline-none focus:border-blue-500/50 resize-none transition-shadow placeholder:text-slate-600 leading-relaxed"
                  />
                  <div className="flex justify-between items-center mt-2 px-1">
                    <span className={`text-xs ${ttsText.length >= MAX_TTS_CHARS ? 'text-red-400 font-bold' : 'text-slate-500'}`}>
                      {ttsText.length}/{MAX_TTS_CHARS} caracteres
                    </span>
                    {ttsText.length > 0 && (
                       <button onClick={clearText} className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-slate-800">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                          </svg>
                          Limpiar
                       </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Controls: Language and Voice */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300 ml-1">Idioma</label>
                <div className="relative">
                  <select 
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 block p-3.5 appearance-none cursor-pointer transition-shadow hover:bg-slate-800/80"
                    defaultValue="es"
                  >
                    <option value="es">Español (Latinoamérica)</option>
                    <option value="en">English (US)</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300 ml-1">Voz IA</label>
                <div className="relative">
                  <select 
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 block p-3.5 appearance-none cursor-pointer transition-shadow hover:bg-slate-800/80"
                  >
                    {VOICES.map(voice => (
                      <option key={voice.id} value={voice.id}>{voice.name}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerateSpeech}
              disabled={isGeneratingSpeech || !ttsText.trim()}
              className={`
                w-full py-4 rounded-xl font-bold text-white shadow-xl transition-all duration-200 transform flex items-center justify-center space-x-2 border border-transparent
                ${!ttsText.trim() || isGeneratingSpeech
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border-slate-700' 
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] shadow-blue-500/20'}
              `}
            >
              {isGeneratingSpeech ? (
                 <>
                   <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Generando Audio...</span>
                 </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                  </svg>
                  <span>Generar Audio</span>
                </>
              )}
            </button>

            {/* Result Area */}
            {generatedAudioUrl && (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 mt-6 shadow-lg">
                <h3 className="text-white font-semibold mb-4 flex items-center">
                  <span className="relative flex h-3 w-3 mr-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                  </span>
                  Tu Audio está Listo
                </h3>
                <AudioPlayer 
                  src={generatedAudioUrl} 
                  autoPlay={true}
                  onDownload={() => handleDownload(generatedAudioUrl, `audio-vozai-${Date.now()}.wav`)} 
                />
              </div>
            )}

            {/* History Section */}
            {history.length > 0 && (
              <div className="pt-8 border-t border-slate-800 w-full">
                <div className="flex items-center justify-between mb-4">
                   <h3 className="text-lg font-semibold text-slate-300">Historial Reciente</h3>
                   <span className="text-xs text-slate-500 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                     Guardado localmente
                   </span>
                </div>
                
                <div className="space-y-3">
                  {history.slice(0, 10).map((item) => (
                    <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-600 transition-colors flex justify-between items-center group">
                      <div className="flex-1 min-w-0 mr-4 cursor-pointer" onClick={() => playHistoryItem(item)}>
                        <p className="text-slate-200 text-sm font-medium truncate">{item.text}</p>
                        <div className="flex items-center space-x-2 mt-1.5">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold bg-slate-800 px-1.5 py-0.5 rounded">{item.voiceName}</span>
                          <span className="text-xs text-slate-600">•</span>
                          <span className="text-xs text-slate-600">{new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                      </div>
                      <div className="flex space-x-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                         {/* We always show regenerate button if URL is expired or just to allow quick access */}
                         <button 
                          onClick={() => handleRegenerateFromHistory(item)}
                          className="p-2 bg-slate-800 text-blue-400 hover:text-white hover:bg-blue-600 rounded-lg border border-slate-700 hover:border-blue-500 transition-all"
                          title="Regenerar Audio"
                        >
                           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
};

export default App;