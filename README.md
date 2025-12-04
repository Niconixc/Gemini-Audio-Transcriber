# AudioAI Studio 🎙️

**AudioAI Studio** es una aplicación web moderna para la transcripción de audio y conversión de texto a voz (TTS) de alta calidad, potenciada por la inteligencia artificial de **Google Gemini 2.5 Flash**.

![AudioAI Studio Banner](https://via.placeholder.com/1200x600/0f172a/3b82f6?text=AudioAI+Studio)

## 🚀 Características

- **Transcripción de Voz a Texto**:
  - Graba audio directamente desde el navegador.
  - Sube archivos de audio (MP3, WAV, M4A).
  - Transcripción rápida y precisa con Gemini 2.5.
  
- **Texto a Voz (TTS) Avanzado**:
  - Voces neuronales naturales (Kore/Elena, Zephyr/Sofia).
  - **Mejora con IA**: Reescribe tu texto automáticamente para que suene más natural al ser hablado.
  - Soporte para textos largos (hasta 8,000 caracteres).
  - Control de velocidad de reproducción (0.75x - 2.0x).
  
- **Herramientas Profesionales**:
  - Historial persistente (Local Storage).
  - Descarga de audios en formato `.wav`.
  - Interfaz oscura moderna y responsiva.

## 🛠️ Tecnologías

- **Frontend**: React 19, TypeScript, Tailwind CSS.
- **IA Core**: Google Gemini API (`gemini-2.5-flash` y `gemini-2.5-flash-preview-tts`).
- **Audio**: Web Audio API nativa para procesamiento y conversión WAV.

## 📦 Instalación y Uso

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/tu-usuario/audioai-studio.git
   cd audioai-studio
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Configurar API Key**:
   Crea un archivo `.env` en la raíz del proyecto y añade tu clave:
   ```env
   API_KEY=tu_clave_de_google_ai_studio
   ```

4. **Correr el proyecto**:
   ```bash
   npm run dev
   ```

## 🔒 Privacidad

Esta aplicación procesa el audio utilizando la API de Google Gemini. Asegúrese de revisar los términos de servicio de Google AI Studio respecto al manejo de datos.

---
Creado con ❤️ usando Gemini API.
