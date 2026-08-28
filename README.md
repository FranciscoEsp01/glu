# 🚀 Glu — Asistente de Reuniones AI (Desktop & Web App)

**Glu** es un asistente de reuniones con inteligencia artificial diseñado para convivir pacíficamente con **Zoom, Google Meet y Slack** sin bots invasivos. Captura el audio en vivo, permite tomar apuntes rápidos mediante una **Cápsula Flotante (Floating Pill)**, transcribe con diarización de hablantes y genera resúmenes estructurados enriquecidos con LLMs (Gemini / Claude / OpenAI).

---

## ✨ Características Principales

1. **Ventana Nativa Split-View (macOS Sequoia / Sonoma)**:
   - **Sidebar translúcida (300px)** con efecto Vibrancy Glass, buscador instantáneo por voz y texto, categorías (*Hoy, Esta Semana, Ventas MEDDIC, 1-on-1s, Syncs de Ingeniería, Destacadas*).
   - **Workspace Principal (780px+)**: Resumen ejecutivo en bullets, lista interactiva de tareas (*Action Items*) con checkboxes tachables, badges de decisiones clave y editor de notas enriquecidas TipTap.
   - **Reproductor de Audio Sincronizado**: Onda de sonido interactiva (*waveform scrubber*) conectada con transcripción por hablantes. Haz clic en cualquier párrafo para saltar al segundo exacto.
2. **Cápsula Flotante en Vivo ("Floating Pill")**:
   - Widget discreto *Always-On-Top*.
   - Temporizador y punto rojo pulsante en tiempo real.
   - Onda de audio dinámica en vivo.
   - Campo para tomar apuntes rápidos (`Cmd + Shift + N`) sin perder el foco en la videollamada.
   - Botón de finalización rápida (`Cmd + Shift + R`) que sintetiza y abre el editor con un clic.
3. **Galería de Plantillas de Especialización**:
   - **Ventas B2B (MEDDIC / BANT)**: Dolor principal, presupuesto, decisor, objeciones y próximos pasos.
   - **1-on-1 (Manager & Reporte)**: Estado de ánimo, bloqueos, retroalimentación y compromisos.
   - **UX Research & Discovery**: Golden quotes, fricciones, feature requests y perfil de usuario.
   - **Sync Técnico / Daily Standup**: Completado, en progreso, bloqueos y acuerdos de arquitectura.
   - **Resumen Ejecutivo Estándar**: Resumen balanceado y tareas clave.
4. **Exportaciones con 1 Clic**:
   - 📄 **Notion**: Formato limpio en bloques de Notion.
   - 💬 **Slack**: Formato con viñetas, negritas y menciones de equipo.
   - 📋 **Markdown**: Exportación completa al portapapeles.
5. **Privacidad & Zero-Audio Retention**:
   - Procesamiento local en memoria y base de datos SQLite / almacenamiento local seguro.
6. **Command Palette Global (`Cmd + K`)**:
   - Búsqueda difusa ultrarrápida y ejecución de comandos globales.

---

## ⌨️ Atajos de Teclado Globales

| Atajo (macOS) | Atajo (Windows) | Acción |
| :--- | :--- | :--- |
| `Cmd + Shift + R` | `Ctrl + Shift + R` | **Iniciar / Detener Grabación Global** |
| `Cmd + Shift + N` | `Ctrl + Shift + N` | **Tomar apunte rápido en la Cápsula Flotante** |
| `Cmd + K` | `Ctrl + K` | **Abrir Command Palette** |
| `Cmd + B` / `Cmd + I` | `Ctrl + B` / `Ctrl + I` | **Formato negrita / cursiva en el editor** |

---

## 🛠️ Stack Tecnológico

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + Lucide Icons + TipTap Editor + Zustand.
- **Audio Engine**: Web Audio API (MediaRecorder + AnalyserNode) + Arquitectura nativa Rust con `cpal` y `hound` para macOS (ScreenCaptureKit) y Windows (WASAPI Loopback).
- **Inteligencia Artificial**: Google Gemini 2.0 Flash / Deepgram Nova-2 / Claude 3.5 Sonnet / OpenAI + Motor de simulación sintética de alta fidelidad para modo offline.
- **Desktop Runtime**: Tauri v2 (`src-tauri`).

---

## 🚀 Cómo Ejecutar el Proyecto

### 1. Iniciar en modo Web / Desarrollo:
```bash
npm run dev
```
Abre tu navegador en `http://localhost:1420`.

### 2. Compilar para Producción:
```bash
npm run build
```

### 3. Ejecutar como App Nativa de Escritorio (con Rust instalado):
```bash
npm run tauri dev
```
