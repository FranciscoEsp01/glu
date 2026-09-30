import { Meeting } from '../types/meeting';
import { desktop, invoke } from '../lib/platform';
import { exportMarkdown } from './export';
export type Integration = 'slack' | 'notion';
export function shareContent(meeting: Meeting) {
  return exportMarkdown({ ...meeting, rawTranscript: [] })
    .replace(/\n## Transcripción\s*$/, '')
    .trim();
}
export function notionBlocks(text: string) {
  const chars = [...text];
  const blocks = [];
  for (let i = 0; i < chars.length; i += 900)
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: chars.slice(i, i + 900).join('') } }],
      },
    });
  if (blocks.length > 100)
    throw new Error(
      'El contenido supera el límite de esta exportación. Descarga Markdown o reduce las notas.',
    );
  return blocks;
}
export function notionPageId(value: string) {
  const match = value.match(
    /([a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})(?:\?|$|#)/i,
  );
  if (!match)
    throw new Error(
      'Introduce el ID o enlace de una página de Notion compartida con tu integración.',
    );
  return match[1];
}
export async function sendMeeting(
  provider: Integration,
  title: string,
  text: string,
  destination: string,
): Promise<string> {
  if (!desktop())
    throw new Error(
      'El envío directo requiere la app de escritorio. En navegador puedes copiar o descargar Markdown.',
    );
  if (!text.trim()) throw new Error('El resumen está vacío.');
  if (provider === 'slack' && [...text].length > 35000)
    throw new Error(
      'El resumen es demasiado largo para un mensaje de Slack. Reduce las notas o descarga Markdown.',
    );
  if (provider === 'slack' && !/^[CGD][A-Z0-9]{5,}$/.test(destination))
    throw new Error('Introduce el ID de canal de Slack (empieza por C, G o D).');
  const body =
    provider === 'slack'
      ? {
          channel: destination,
          text,
          mrkdwn: false,
          parse: 'none',
          unfurl_links: false,
          unfurl_media: false,
        }
      : {
          parent: { type: 'page_id', page_id: notionPageId(destination) },
          properties: {
            title: {
              type: 'title',
              title: [
                { type: 'text', text: { content: [...title].slice(0, 150).join('') || 'Reunión' } },
              ],
            },
          },
          children: notionBlocks(text),
        };
  const result = await invoke<{ reference: string }>('send_integration', { provider, body });
  return result.reference;
}
