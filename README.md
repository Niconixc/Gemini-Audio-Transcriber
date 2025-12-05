# AudioAI Studio 🎙️

[![Live Demo](https://img.shields.io/badge/🚀_Demo_en_Vivo-AudioAI_Studio-blue?style=for-the-badge)](https://audioai-studio.vercel.app)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Powered by Gemini](https://img.shields.io/badge/Powered_by-Gemini_2.5-4285F4?style=flat-square&logo=google)](https://ai.google.dev/)

**AudioAI Studio** es una aplicación web moderna para la transcripción de audio y conversión de texto a voz (TTS) de alta calidad, potenciada por la inteligencia artificial de **Google Gemini 2.5 Flash**.

<p align="center">
  <a href="https://audioai-studio.vercel.app" target="_blank">
    <img src="https://via.placeholder.com/1200x600/0f172a/3b82f6?text=AudioAI+Studio" alt="AudioAI Studio Banner" width="100%"/>
  </a>
</p>

<p align="center">
  <strong>👉 <a href="https://audioai-studio.vercel.app">Probar la Demo en Vivo</a> 👈</strong>
</p>

---

## 🚀 Características

### 🎤 Transcripción de Voz a Texto

- Graba audio directamente desde el navegador.
- Sube archivos de audio (MP3, WAV, M4A).
- Transcripción rápida y precisa con Gemini 2.5.

### 🔊 Texto a Voz (TTS) Avanzado

- Voces neuronales naturales (Kore/Elena, Zephyr/Sofia).
- **Mejora con IA**: Reescribe tu texto automáticamente para que suene más natural al ser hablado.
- Soporte para textos largos (hasta 8,000 caracteres).
- Control de velocidad de reproducción (0.75x - 2.0x).

### 🛠️ Herramientas Profesionales

- Historial persistente (Local Storage).
- Descarga de audios en formato `.wav`.
- Interfaz oscura moderna y responsiva.

---

## 🧰 Tech Stack

| Categoría    | Tecnología                                                             |
| ------------ | ---------------------------------------------------------------------- |
| **Frontend** | React 19, TypeScript, Tailwind CSS                                     |
| **IA Core**  | Google Gemini API (`gemini-2.5-flash`, `gemini-2.5-flash-preview-tts`) |
| **Audio**    | Web Audio API nativa para procesamiento y conversión WAV               |
| **Hosting**  | Vercel                                                                 |

---

## 📦 Instalación Local

```bash
# 1. Clonar el repositorio
git clone [https://github.com/tu-usuario/audioai-studio.git](https://github.com/tu-usuario/audioai-studio.git)
cd audioai-studio

# 2. Instalar dependencias
npm install

# 3. Configurar API Key (crear archivo .env)
echo "API_KEY=tu_clave_de_google_ai_studio" > .env

# 4. Iniciar el servidor de desarrollo
npm run dev

💡 Tip: Obtén tu API Key gratuita en Google AI Studio

🌐 Demo en Vivo
La aplicación está desplegada y disponible en:

🔗 https://audioai-studio.vercel.app

🔒 Privacidad
Esta aplicación procesa el audio utilizando la API de Google Gemini. Asegúrese de revisar los términos de servicio de Google AI Studio respecto al manejo de datos.

📄 Licencia
Este proyecto está bajo la Licencia MIT - ver el archivo
LICENSE
 para más detalles.
```
