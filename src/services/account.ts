// Local namespaces prevent accidental sharing between accounts on this device.
// They are not a substitute for server-side authorization or disk encryption.
let accountId: string | undefined;
export function setAccountId(id: string) {
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(id)) throw new Error('Identificador de cuenta inválido.');
  accountId = id;
}
export function getAccountId() {
  if (!accountId) throw new Error('Inicia sesión para acceder a tus reuniones.');
  return accountId;
}
export const accountKey = (key: string) => `${key}:${getAccountId()}`;
