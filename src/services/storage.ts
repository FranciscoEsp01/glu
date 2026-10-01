import { accountKey } from './account';
import { Meeting, AISettings } from '../types/meeting';
import { desktop, invoke, fileUrl } from '../lib/platform';
const KEY = 'glu_meetings_data_v1';
let database: Promise<IDBDatabase> | undefined;
function db() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(accountKey('glu-media'), 1);
    request.onupgradeneeded = () => request.result.createObjectStore('audio');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}
async function media<T>(
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('audio', mode);
    const request = fn(tx.objectStore('audio'));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('No se pudo guardar el audio.'));
  });
}
export const storage = {
  async load(): Promise<Meeting[]> {
    const saved = desktop()
      ? await invoke<string | null>('load_meetings')
      : localStorage.getItem(accountKey(KEY));
    const parsed = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(parsed))
      throw new Error('El historial guardado no tiene un formato válido.');
    return parsed.map((m: Meeting) => ({
      ...m,
      audioUrl: undefined,
      status: m.status === 'recording' || m.status === 'processing' ? 'pending' : m.status,
    }));
  },
  async save(meetings: Meeting[]) {
    const data = JSON.stringify(meetings.map(({ audioUrl: _url, ...m }) => m));
    if (desktop()) await invoke('save_meetings', { data });
    else localStorage.setItem(accountKey(KEY), data);
  },
  async putAudio(id: string, blob: Blob) {
    if (desktop())
      await invoke('write_audio', {
        id,
        bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
        mime: blob.type,
      });
    else await media('readwrite', (s) => s.put(blob, id));
  },
  async getAudio(id: string): Promise<Blob | undefined> {
    if (desktop()) {
      const result = await invoke<{ bytes: number[]; mime: string } | null>('read_audio', { id });
      return result ? new Blob([new Uint8Array(result.bytes)], { type: result.mime }) : undefined;
    }
    return media('readonly', (s) => s.get(id));
  },
  async playbackUrl(id: string): Promise<string | undefined> {
    if (desktop()) {
      const path = await invoke<string | null>('playback_path', { id });
      return path ? fileUrl(path) : undefined;
    }
    const blob = await this.getAudio(id);
    return blob ? URL.createObjectURL(blob) : undefined;
  },
  async deleteAudio(id: string) {
    if (desktop()) await invoke('delete_audio', { id });
    else await media('readwrite', (s) => s.delete(id));
  },
  async loadSettings(): Promise<AISettings> {
    const defaults: AISettings = {
      geminiApiKey: '',
      deepgramApiKey: '',
      selectedModel: 'gemini-2.5-flash',
      saveLocalAudio: false,
      theme: 'light',
      preferredLanguage: 'es',
      captureSource: 'microphone',
    };
    let saved: Partial<AISettings> = {};
    try {
      saved = JSON.parse(localStorage.getItem(accountKey('glu_settings_v2')) || '{}');
    } catch {
      /* Preserve defaults. */
    }
    const settings: AISettings = {
      ...defaults,
      ...saved,
      geminiApiKey: '',
      deepgramApiKey: '',
      slackToken: '',
      notionToken: '',
    };
    if (desktop()) {
      settings.geminiApiKey = await invoke('secret_get', { name: 'gemini' });
      settings.deepgramApiKey = await invoke('secret_get', { name: 'deepgram' });
      settings.slackToken = await invoke('secret_get', { name: 'slack' });
      settings.notionToken = await invoke('secret_get', { name: 'notion' });
    }
    return settings;
  },
  async saveSettings(settings: AISettings) {
    const { geminiApiKey, deepgramApiKey, slackToken, notionToken, ...publicSettings } = settings;
    if (desktop()) {
      await invoke('secret_set', { name: 'gemini', value: geminiApiKey });
      await invoke('secret_set', { name: 'deepgram', value: deepgramApiKey });
      await invoke('secret_set', { name: 'slack', value: slackToken || '' });
      await invoke('secret_set', { name: 'notion', value: notionToken || '' });
    }
    localStorage.setItem(accountKey('glu_settings_v2'), JSON.stringify(publicSettings));
  },
};
