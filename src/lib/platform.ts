type Tauri = {
  core: {
    convertFileSrc(path: string): string;
    invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
  };
};
export const desktop = () => Boolean((window as unknown as { __TAURI__?: Tauri }).__TAURI__);
export function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const api = (window as unknown as { __TAURI__?: Tauri }).__TAURI__;
  if (!api) return Promise.reject(new Error('Esta función requiere la aplicación de escritorio.'));
  return api.core.invoke<T>(command, args);
}
export const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
export const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

export function fileUrl(path: string): string {
  return (window as unknown as { __TAURI__: Tauri }).__TAURI__.core.convertFileSrc(path);
}
