import { Meeting } from '../types/meeting';

export const INITIAL_MEETINGS: Meeting[] = [
  {
    id: 'meet-01',
    title: 'Reunión de Producto: Lanzamiento MVP Q3',
    date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    durationMinutes: 45,
    templateType: 'general',
    category: 'today',
    isStarred: true,
    tags: ['Producto', 'MVP', 'Q3', 'Lanzamiento'],
    participants: [
      { id: 'p1', name: 'Francisco Espinoza', role: 'Co-Founder & Tech Lead', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80' },
      { id: 'p2', name: 'Clara Domínguez', role: 'Product Manager', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80' },
      { id: 'p3', name: 'Diego Morales', role: 'Lead Frontend Eng', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80' },
    ],
    executiveSummary: [
      'Se definió el alcance final del MVP de Glu enfocado en experiencia desktop no invasiva con floating pill.',
      'Se acordó priorizar Tauri v2 sobre Electron para mantener el consumo de RAM por debajo de 50MB y asegurar 10 horas de batería durante llamadas.',
      'El cliente piloto (Beta cohort de 50 founders) comenzará pruebas cerradas el próximo lunes con exportación a Notion y Slack.',
    ],
    actionItems: [
      { id: 'act-1', text: 'Implementar atajo global Cmd+Shift+R en Tauri para captura rápida', completed: true, assignee: 'Diego', dueDate: '2026-08-29', priority: 'high' },
      { id: 'act-2', text: 'Validar webhook de integración con Slack para enviar resúmenes en canales de sync', completed: false, assignee: 'Francisco', dueDate: '2026-08-30', priority: 'medium' },
      { id: 'act-3', text: 'Preparar video de demostración de 60 segundos para Product Hunt y Twitter', completed: false, assignee: 'Clara', dueDate: '2026-09-02', priority: 'high' },
    ],
    keyDecisions: [
      { id: 'dec-1', decision: 'Usar Deepgram Nova-2 como motor de STT principal con fallback a Whisper local', rationale: 'Latencia < 300ms y coste $0.0043/minuto insuperable.', category: 'Infraestructura' },
      { id: 'dec-2', decision: 'Arquitectura Zero-Audio Retention por defecto', rationale: 'Cumplimiento estricto de privacidad GDPR y confianza enterprise.', category: 'Privacidad' },
      { id: 'dec-3', decision: 'Presupuesto inicial de \$10k para cloud inference asignado', rationale: 'Cubre primeros 2,000 usuarios activos mensuales.', category: 'Finanzas' },
    ],
    unresolvedQuestions: [
      '¿Qué certificado EV de firma digital usaremos para la distribución de Windows Installer (MSIX)?',
    ],
    rawTranscript: [
      { id: 't1', speaker: 'Francisco Espinoza', text: 'Buenos días a todos. El objetivo de hoy es cerrar la arquitectura del MVP y acordar las fechas del primer release público.', timestamp: 0, duration: 8 },
      { id: 't2', speaker: 'Clara Domínguez', text: 'Perfecto. Desde producto tenemos los wireframes de la barra flotante terminados. Los usuarios beta quieren poder pausar y reanudar con un solo atajo.', timestamp: 9, duration: 11 },
      { id: 't3', speaker: 'Diego Morales', text: 'Con Tauri v2 y Rust tenemos listeners globales que no consumen nada de CPU en background. Podemos usar Cmd+Shift+R para grabar y Cmd+Shift+N para notas rápidas.', timestamp: 21, duration: 13 },
      { id: 't4', speaker: 'Francisco Espinoza', text: 'Excelente. Además el pipeline con Gemini 2.0 Flash nos permite resumir una reunión de 45 minutos en menos de 2 segundos.', timestamp: 35, duration: 9 },
      { id: 't5', speaker: 'Clara Domínguez', text: 'Eso es un diferenciador brutal frente a Otter o Fathom que tardan minutos en enviar el correo.', timestamp: 45, duration: 7 },
    ],
    manualNotes: `<h2>Notas en vivo tomadas durante la llamada</h2>
<p>• Prioridad #1: Experiencia de usuario en macOS Sequoia con ventana Liquid Glass.</p>
<p>• El cliente no quiere bots intrusivos en Google Meet. Captura 100% nativa de loopback de audio del sistema.</p>
<p>• Sincronización con Notion lista para conectar con OAuth.</p>`,
    audioDurationSec: 52,
  },
  {
    id: 'meet-02',
    title: 'Demo & Calificación de Venta: VentureCorp B2B',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // Yesterday
    durationMinutes: 30,
    templateType: 'sales',
    category: 'sales',
    isStarred: true,
    tags: ['Ventas', 'B2B', 'MEDDIC', 'Enterprise'],
    participants: [
      { id: 'p1', name: 'Francisco Espinoza', role: 'Founder', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80' },
      { id: 'p4', name: 'Roberto Sterling', role: 'VP of Sales @ VentureCorp', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80' },
    ],
    executiveSummary: [
      'VentureCorp tiene un equipo de 40 ejecutivos de cuenta perdiendo 8 horas semanales redactando minutas en Salesforce.',
      'Buscan una solución sin bots visibles que no asuste a sus clientes de banca privada.',
      'Disponen de un presupuesto anual de $24,000 USD listo para desembolsar en Q4.',
    ],
    actionItems: [
      { id: 'act-4', text: 'Enviar propuesta comercial con plan Enterprise (40 seats)', completed: true, assignee: 'Francisco', dueDate: '2026-08-30', priority: 'high' },
      { id: 'act-5', text: 'Agendar llamada técnica de seguridad con el CISO de VentureCorp', completed: false, assignee: 'Francisco', dueDate: '2026-09-04', priority: 'medium' },
    ],
    keyDecisions: [
      { id: 'dec-4', decision: 'Piloto de 14 días para 5 ejecutivos senior aprobado', rationale: 'Validación antes de la compra corporativa.', category: 'Comercial' },
      { id: 'dec-5', decision: 'Precio acordado: \$25/seat/mes con facturación anual', rationale: 'Descuento por volumen sobre precio público de \$30.', category: 'Pricing' },
    ],
    rawTranscript: [
      { id: 't20', speaker: 'Roberto Sterling', text: 'Hola Francisco. Nuestro mayor dolor es que nuestros ejecutivos pasan media tarde metiendo datos en el CRM en vez de prospectar.', timestamp: 0, duration: 10 },
      { id: 't21', speaker: 'Francisco Espinoza', text: 'Totalmente Roberto. Glu captura la llamada de fondo, mapea los campos MEDDIC y te deja la ficha lista para enviar a HubSpot o Salesforce con un clic.', timestamp: 11, duration: 12 },
      { id: 't22', speaker: 'Roberto Sterling', text: 'Eso es justo lo que necesitamos. ¿Podemos arrancar un piloto la próxima semana con mi equipo top?', timestamp: 24, duration: 8 },
    ],
    manualNotes: `<p><strong>BANT Summary:</strong></p><ul><li>Budget: $24k año.</li><li>Authority: Roberto firma directo.</li><li>Need: Ahorro de 8h/semana por rep.</li><li>Timeline: Cierre en Septiembre.</li></ul>`,
    audioDurationSec: 32,
  },
  {
    id: 'meet-03',
    title: '1-on-1 Semanal: Clara & Francisco',
    date: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
    durationMinutes: 35,
    templateType: 'one_on_one',
    category: 'one_on_one',
    tags: ['1-on-1', 'Equipo', 'Feedback'],
    participants: [
      { id: 'p1', name: 'Francisco Espinoza', role: 'Co-Founder', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80' },
      { id: 'p2', name: 'Clara Domínguez', role: 'Product Lead', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80' },
    ],
    executiveSummary: [
      'Clara reporta alta motivación con el feedback del último test de usabilidad.',
      'Identificó una sobrecarga de contexto al coordinar con diseño y desarrollo en paralelo.',
      'Acordamos delegar los wireframes finales de marketing a un freelancer de apoyo.',
    ],
    actionItems: [
      { id: 'act-6', text: 'Publicar anuncio para contratar diseñador freelance de motion', completed: true, assignee: 'Clara', dueDate: '2026-08-31', priority: 'medium' },
      { id: 'act-7', text: 'Bloquear 2 horas de Focus Time diario sin reuniones en Google Calendar', completed: true, assignee: 'Clara', dueDate: '2026-08-29', priority: 'low' },
    ],
    keyDecisions: [
      { id: 'dec-6', decision: 'Implementar política No-Meeting Thursdays en todo el equipo', rationale: 'Garantizar tiempo profundo de desarrollo.', category: 'Cultura' },
    ],
    rawTranscript: [
      { id: 't30', speaker: 'Francisco Espinoza', text: 'Hola Clara, ¿cómo te has sentido esta semana con el ritmo del sprint?', timestamp: 0, duration: 6 },
      { id: 't31', speaker: 'Clara Domínguez', text: 'Súper entusiasmada por el progreso, pero sentí que tuve demasiadas interrupciones el martes y miércoles.', timestamp: 7, duration: 9 },
      { id: 't32', speaker: 'Francisco Espinoza', text: 'Tiene todo el sentido. Probemos bloquear los jueves completos libres de reuniones para que puedas avanzar en producto.', timestamp: 17, duration: 10 },
    ],
    manualNotes: `<p>Excelente alineación. Clara está liderando la estrategia de lanzamiento con mucha autonomía.</p>`,
    audioDurationSec: 28,
  },
  {
    id: 'meet-04',
    title: 'Daily Sync: Audio Engine & ScreenCaptureKit',
    date: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    durationMinutes: 15,
    templateType: 'standup',
    category: 'this_week',
    tags: ['Ingeniería', 'Rust', 'macOS', 'Audio'],
    participants: [
      { id: 'p1', name: 'Francisco Espinoza', role: 'Tech Lead', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80' },
      { id: 'p3', name: 'Diego Morales', role: 'Lead Frontend Eng', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80' },
    ],
    executiveSummary: [
      'Se completó la prueba de concepto del módulo de captura de audio dual en Rust con cpal.',
      'En macOS Sequoia el framework ScreenCaptureKit no requiere permisos de accesibilidad especiales cuando se captura solo stream de audio.',
      'Siguiente paso: compilar bindings de C++ para WASAPI loopback en Windows 11.',
    ],
    actionItems: [
      { id: 'act-8', text: 'Crear suite de pruebas unitarias para el buffer de audio circular en Rust', completed: false, assignee: 'Diego', dueDate: '2026-09-01', priority: 'high' },
    ],
    keyDecisions: [
      { id: 'dec-7', decision: 'Muestrear audio a 16kHz mono para optimizar ancho de banda hacia Deepgram', rationale: 'Reduce consumo de datos en 75% sin degradar precisión de STT.', category: 'Rendimiento' },
    ],
    rawTranscript: [
      { id: 't40', speaker: 'Diego Morales', text: 'Ayer probé cpal con ScreenCaptureKit y el audio de Zoom se captura nítido sin eco.', timestamp: 0, duration: 8 },
      { id: 't41', speaker: 'Francisco Espinoza', text: 'Excelente. ¿Y el micrófono local se mezcla en un canal separado o en estéreo?', timestamp: 9, duration: 6 },
      { id: 't42', speaker: 'Diego Morales', text: 'Lo tenemos en dos canales discretos: Canal L = Micrófono, Canal R = Sistema. Así la diarización es 100% perfecta.', timestamp: 16, duration: 11 },
    ],
    manualNotes: `<p>Dual-channel audio capture validado con éxito.</p>`,
    audioDurationSec: 28,
  }
];
