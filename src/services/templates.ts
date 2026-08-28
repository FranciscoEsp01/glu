import { TemplateDefinition, TemplateType } from '../types/meeting';

export const MEETING_TEMPLATES: Record<TemplateType, TemplateDefinition> = {
  general: {
    id: 'general',
    name: 'Resumen Ejecutivo Estándar',
    icon: 'FileText',
    description: 'Resumen balanceado, decisiones clave y lista de tareas claras.',
    badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    defaultSections: ['Resumen Ejecutivo', 'Decisiones Clave', 'Tareas y Compromisos', 'Puntos sin Resolver'],
    systemPrompt: `Eres un asistente ejecutivo de reuniones de nivel mundial.
Tu objetivo es sintetizar la transcripción y notas manuales en un documento ultra estructurado, sin relleno ("fluff") y 100% accionable.
Reglas:
1. No uses introducciones genéricas. Ve directo al grano.
2. Cada Action Item debe tener un responsable claro y verbo en infinitivo.
3. Extrae decisiones con su justificación.`,
  },
  sales: {
    id: 'sales',
    name: 'Ventas B2B (MEDDIC / BANT)',
    icon: 'TrendingUp',
    description: 'Extracción de dolor principal, presupuesto, decisores, objeciones y próximos pasos.',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    defaultSections: ['Pain Point Principal', 'Presupuesto y Cronograma', 'Tomador de Decisiones (Champion)', 'Objeciones', 'Próximo Paso Acordado'],
    systemPrompt: `Eres un experto en ventas B2B y calificación de acuerdos (MEDDIC/BANT).
Analiza la conversación con el cliente para estructurar:
- Dolor urgente que buscan resolver.
- Rango de presupuesto y fechas estimadas de compra.
- Identidad del tomador de decisiones y sponsors internos.
- Objeciones planteadas y cómo abordarlas.
- Compromiso del próximo paso con fecha exacta.`,
  },
  one_on_one: {
    id: 'one_on_one',
    name: 'Reunión 1-on-1 (Manager & Reporte)',
    icon: 'Users',
    description: 'Seguimiento de estado de ánimo, bloqueos, feedback mutuo y desarrollo profesional.',
    badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    defaultSections: ['Estado de Ánimo & Motivación', 'Bloqueos Actuales', 'Feedback Mutuo', 'Compromisos para la Próxima Semana'],
    systemPrompt: `Eres un coach ejecutivo y facilitador de reuniones 1-on-1.
Estructura la nota enfocándote en:
- Nivel de energía y satisfacción laboral del colaborador.
- Impedimentos y dependencias externas que le frenan.
- Retroalimentación compartida en ambas direcciones.
- Acciones de desarrollo y compromisos para el siguiente sync.`,
  },
  ux_research: {
    id: 'ux_research',
    name: 'UX Research & Entrevistas de Usuario',
    icon: 'Compass',
    description: 'Captura de citas textuales ("Golden Quotes"), fricciones y solicitudes de producto.',
    badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    defaultSections: ['Golden Quotes (Citas Textuales)', 'Fricciones & Frustraciones', 'Feature Requests', 'Perfil del Usuario'],
    systemPrompt: `Eres un Investigador de Experiencia de Usuario (User Researcher).
Extrae hallazgos cualitativos clave:
- Citas textuales directas e impactantes ("Golden Quotes").
- Puntos de dolor y momentos de confusión durante el uso.
- Nuevas funcionalidades o soluciones solicitadas por el usuario.
- Patrones de comportamiento observados.`,
  },
  standup: {
    id: 'standup',
    name: 'Sync Técnico / Daily Standup',
    icon: 'Cpu',
    description: 'Alineación de ingeniería: tareas terminadas, en progreso, bloqueos y arquitectura.',
    badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800',
    defaultSections: ['Completado (Done)', 'En Progreso (WIP)', 'Bloqueos Técnicos', 'Acuerdos de Arquitectura'],
    systemPrompt: `Eres un Tech Lead y Scrum Master senior.
Sintetiza la sesión técnica en:
- Tareas finalizadas por cada ingeniero.
- Trabajo actualmente en curso.
- Bloqueos técnicos (fallos en CI, dependencias de APIs, PRs).
- Decisiones técnicas o de arquitectura adoptadas.`,
  },
};
