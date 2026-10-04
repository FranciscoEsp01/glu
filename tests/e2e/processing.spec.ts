import { test, expect, accountId } from './auth-fixture';
const summary = {
  title: 'Trabajo recuperado',
  executiveSummary: ['Resultado guardado'],
  actionItems: [],
  keyDecisions: [],
  unresolvedQuestions: [],
  enrichedNotes: 'Notas guardadas',
};
const response = { candidates: [{ content: { parts: [{ text: JSON.stringify(summary) }] } }] };

test('A interrupted summary resumes after reload using the same persisted operation ID', async ({
  page,
}) => {
  const ids: string[] = [];
  await page.route('https://glu-test.supabase.co/functions/v1/paid-ai', async (route) => {
    ids.push(route.request().headers()['x-request-id']);
    if (ids.length === 1) return route.abort('connectionfailed');
    return route.fulfill({ json: response });
  });
  await page.goto('/');
  await page.getByLabel('Transcripción para importar').fill('Contenido que se conserva.');
  await page.getByRole('button', { name: 'Guardar transcripción' }).click();
  await page.getByRole('button', { name: 'Generar resumen', exact: true }).click();
  await expect(page.getByLabel('Estado del procesamiento')).toContainText('Esperando reintento');
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!)[0].processingJob,
    `glu_meetings_data_v1:${accountId}`,
  );
  expect(saved.requestId).toBe(ids[0]);
  await page.reload();
  await expect(page.getByLabel('Estado del procesamiento')).toContainText('Completado', {
    timeout: 15000,
  });
  expect(ids).toHaveLength(2);
  expect(ids[0]).toBe(ids[1]);
  await expect(page.getByLabel('Título de reunión')).toHaveValue('Trabajo recuperado');
});

test('A provider outcome that cannot be confirmed stops automatic retries and keeps the original text', async ({
  page,
}) => {
  let calls = 0;
  await page.route('https://glu-test.supabase.co/functions/v1/paid-ai', (route) => {
    calls++;
    return route.fulfill({
      status: 502,
      json: {
        error: 'Resultado no confirmado',
        code: 'operation_unknown',
        retryable: false,
        newOperation: false,
      },
    });
  });
  await page.goto('/');
  await page.getByLabel('Transcripción para importar').fill('Transcripción intacta.');
  await page.getByRole('button', { name: 'Guardar transcripción' }).click();
  await page.getByRole('button', { name: 'Generar resumen', exact: true }).click();
  await expect(page.getByLabel('Estado del procesamiento')).toContainText('Revisión necesaria');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Reanudar procesamiento' })).toBeEnabled();
  expect(calls).toBe(1);
  await expect(page.locator('.transcript-lines')).toContainText('Transcripción intacta');
  await page.getByRole('button', { name: 'Cancelar trabajo' }).click();
  await expect(page.getByLabel('Estado del procesamiento')).toContainText('Cancelado');
});

test('Completed audio blocks are persisted and skipped after an interrupted second block', async ({
  page,
}) => {
  const audio = Buffer.alloc(44 + 16000 * 2 * 301);
  audio.write('RIFF', 0);
  audio.writeUInt32LE(audio.length - 8, 4);
  audio.write('WAVEfmt ', 8);
  audio.writeUInt32LE(16, 16);
  audio.writeUInt16LE(1, 20);
  audio.writeUInt16LE(1, 22);
  audio.writeUInt32LE(16000, 24);
  audio.writeUInt32LE(32000, 28);
  audio.writeUInt16LE(2, 32);
  audio.writeUInt16LE(16, 34);
  audio.write('data', 36);
  audio.writeUInt32LE(audio.length - 44, 40);
  const ids: string[] = [];
  const sizes: number[] = [];
  await page.route('https://glu-test.supabase.co/functions/v1/transcribe**', (route) => {
    ids.push(route.request().headers()['x-request-id']);
    sizes.push(route.request().postDataBuffer()!.length);
    if (ids.length === 2) return route.abort('connectionfailed');
    return route.fulfill({
      json: {
        results: {
          utterances: [
            {
              speaker: 0,
              start: 0,
              end: 1,
              transcript: ids.length === 1 ? 'Primer bloque' : 'Segundo bloque',
            },
          ],
        },
      },
    });
  });
  await page.route('https://glu-test.supabase.co/functions/v1/paid-ai', (route) =>
    route.fulfill({ json: response }),
  );
  await page.goto('/');
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles({ name: 'Larga.wav', mimeType: 'audio/wav', buffer: audio });
  await expect(page.getByLabel('Título de reunión')).toHaveValue('Larga');
  await page.getByRole('button', { name: 'Generar resumen', exact: true }).click();
  await expect(page.getByLabel('Estado del procesamiento')).toContainText('Esperando reintento');
  await expect(page.getByLabel('Estado del procesamiento')).toContainText(
    '1 de 2 bloques guardados',
  );
  await page.reload();
  await expect(page.getByLabel('Estado del procesamiento')).toContainText('Completado', {
    timeout: 15000,
  });
  expect(ids).toHaveLength(3);
  expect(ids[1]).toBe(ids[2]);
  expect(ids[0]).not.toBe(ids[1]);
  expect(sizes).toEqual([9600000, 32000, 32000]);
  await expect(page.locator('.transcript-lines')).toContainText('Primer bloque');
  await expect(page.locator('.transcript-lines')).toContainText('Segundo bloque');
});
