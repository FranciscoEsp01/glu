import { test, expect } from './auth-fixture';
const summary = {
  title: 'Propuesta para Acme',
  executiveSummary: ['Ana enviará la propuesta el viernes.'],
  actionItems: [{ text: 'Enviar propuesta', assignee: 'Ana', dueDate: null }],
  keyDecisions: [{ decision: 'Revisar el viernes', rationale: null }],
  unresolvedQuestions: [],
  enrichedNotes: 'Nota fundamentada en la conversación.',
};
async function importText(page: import('@playwright/test').Page) {
  await page
    .getByLabel('Transcripción para importar')
    .fill('Ana: enviaré la propuesta el viernes.');
  await page.getByRole('button', { name: 'Guardar transcripción' }).click();
}
async function configure(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Configuración', exact: true }).first().click();
  await page.getByLabel('Clave de Deepgram').fill('test-key-deepgram');
  await page.getByRole('button', { name: 'Guardar configuración' }).click();
}
test('Empty workspace, import, editing, persistent reload, actionable service failure', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('Las buenas ideas')).toBeVisible();
  await page.screenshot({ path: 'test-results/glu-welcome.png' });
  await importText(page);
  await page.getByLabel('Título de reunión').fill('Revisión Acme');
  await page.reload();
  await expect(page.getByLabel('Título de reunión')).toHaveValue('Revisión Acme');
  await page.getByRole('button', { name: 'Generar resumen', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('El servicio de IA no está disponible');
  await expect(page.locator('.transcript-lines')).toContainText(
    'Ana: enviaré la propuesta el viernes.',
  );
  await page.keyboard.press('Meta+k');
  await expect(page.getByPlaceholder('Buscar reuniones, tareas, comandos...')).toBeVisible();
  await page.keyboard.press('Escape');
  const persisted = await page.evaluate(() =>
    localStorage.getItem('glu_meetings_data_v1:11111111-1111-4111-8111-111111111111'),
  );
  expect(persisted).not.toContain('Iniciamos la reunión para revisar');
});
test('Real processing path uses provider result; secrets never persist; task completion and notes survive reload', async ({
  page,
}) => {
  await page.route('https://glu-test.supabase.co/functions/v1/paid-ai', (route) =>
    route.fulfill({
      json: { candidates: [{ content: { parts: [{ text: JSON.stringify(summary) }] } }] },
    }),
  );
  await page.goto('/');
  await configure(page);
  await importText(page);
  await page.getByRole('button', { name: 'Generar resumen', exact: true }).click();
  await expect(page.getByLabel('Título de reunión')).toHaveValue('Propuesta para Acme');
  await page.screenshot({ path: 'test-results/glu-meeting.png' });
  await page.getByRole('checkbox', { name: /Enviar propuesta/ }).check();
  await page.locator('.tiptap').fill('Apunte editado por el usuario');
  await page.reload();
  await expect(page.getByRole('checkbox', { name: /Enviar propuesta/ })).toBeChecked();
  await expect(page.locator('.tiptap')).toContainText('Apunte editado');
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('test-key');
});
test('Provider failure preserves transcript and permits retry without synthetic output', async ({
  page,
}) => {
  await page.route('https://glu-test.supabase.co/functions/v1/paid-ai', (route) =>
    route.fulfill({ status: 429, json: { error: 'Error 429: cuota agotada' } }),
  );
  await page.goto('/');
  await configure(page);
  await importText(page);
  await page.getByRole('button', { name: 'Generar resumen', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('429');
  await expect(page.locator('.transcript-lines')).toContainText(
    'Ana: enviaré la propuesta el viernes.',
  );
  await expect(page.getByRole('button', { name: 'Generar resumen', exact: true })).toBeEnabled();
});
test('Microphone capture pauses the timer, saves actual media and recovers without API keys', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Grabar mi primera reunión' }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Iniciar grabación', exact: true }).click();
  await expect(page.getByTitle('Pausar toda la captura')).toBeVisible();
  await page.waitForTimeout(1500);
  await page.getByTitle('Pausar toda la captura').click();
  const before = await page.locator('.timer').textContent();
  await page.waitForTimeout(1500);
  expect(await page.locator('.timer').textContent()).toBe(before);
  await page.getByTitle('Reanudar captura').click();
  await page.waitForTimeout(500);
  await page.getByTitle('Finalizar reunión').click();
  await expect(page.getByRole('alert')).toContainText('Deepgram');
  await expect(page.locator('audio')).toHaveAttribute('src', /^blob:/);
  await page.reload();
  await expect(page.locator('audio')).toHaveAttribute('src', /^blob:/);
});
test('Denied microphone never produces a fake meeting', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException('Permiso denegado', 'NotAllowedError');
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Grabar mi primera reunión' }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Iniciar grabación', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Permiso denegado');
  await expect(page.locator('.meeting-card')).toHaveCount(0);
});
test('Successful processing deletes audio only after saving the result when retention is disabled', async ({
  page,
}) => {
  await page.route('https://api.deepgram.com/**', (route) =>
    route.fulfill({
      json: {
        results: {
          utterances: [{ start: 0, end: 2, speaker: 0, transcript: 'Ana enviará la propuesta.' }],
        },
      },
    }),
  );
  await page.route('https://glu-test.supabase.co/functions/v1/paid-ai', (route) =>
    route.fulfill({
      json: { candidates: [{ content: { parts: [{ text: JSON.stringify(summary) }] } }] },
    }),
  );
  await page.goto('/');
  await configure(page);
  await page.getByRole('button', { name: 'Grabar mi primera reunión' }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Iniciar grabación', exact: true }).click();
  await expect(page.getByTitle('Finalizar reunión')).toBeVisible();
  await page.waitForTimeout(700);
  await page.getByTitle('Finalizar reunión').click();
  await expect(page.getByLabel('Título de reunión')).toHaveValue('Propuesta para Acme');
  await expect(page.getByText('No hay audio conservado para esta reunión.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Título de reunión')).toHaveValue('Propuesta para Acme');
  expect(
    await page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem('glu_meetings_data_v1:11111111-1111-4111-8111-111111111111')!,
        )[0].hasAudio,
    ),
  ).toBe(false);
});
test('A metadata storage failure prevents discarding the original audio', async ({ page }) => {
  await page.route('https://api.deepgram.com/**', (route) =>
    route.fulfill({
      json: {
        results: {
          utterances: [{ start: 0, end: 2, speaker: 0, transcript: 'Una conversación real.' }],
        },
      },
    }),
  );
  await page.route('https://glu-test.supabase.co/functions/v1/paid-ai', async (route) => {
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'glu_meetings_data_v1:11111111-1111-4111-8111-111111111111')
          throw new DOMException('Cuota agotada', 'QuotaExceededError');
        return original.call(this, key, value);
      };
    });
    await route.fulfill({
      json: { candidates: [{ content: { parts: [{ text: JSON.stringify(summary) }] } }] },
    });
  });
  await page.goto('/');
  await configure(page);
  await page.getByRole('button', { name: 'Grabar mi primera reunión' }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Iniciar grabación', exact: true }).click();
  await expect(page.getByTitle('Finalizar reunión')).toBeVisible();
  await page.waitForTimeout(700);
  await page.getByTitle('Finalizar reunión').click();
  await expect(page.getByRole('alert')).toContainText('Cuota agotada');
  await expect(page.locator('audio')).toHaveAttribute('src', /^blob:/);
  await page.reload();
  await expect(page.locator('audio')).toHaveAttribute('src', /^blob:/);
});

test('Questions display real citations and navigate back to the source meeting', async ({
  page,
}) => {
  await page.route('https://glu-test.supabase.co/functions/v1/paid-ai', async (route) => {
    const data = JSON.parse(route.request().postData()!);
    const evidence = data.evidence;
    await route.fulfill({
      json: {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    answer: 'Ana enviará la propuesta el viernes.',
                    sources: [
                      { id: evidence[0].id, quote: 'Ana: enviaré la propuesta el viernes.' },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      },
    });
  });
  await page.goto('/');
  await configure(page);
  await importText(page);
  await page.getByRole('button', { name: 'Preguntar a mis reuniones' }).click();
  await page.getByLabel('Pregunta sobre reuniones').fill('¿Cuándo enviará Ana la propuesta?');
  await page.getByRole('button', { name: 'Responder con Gemini' }).click();
  await expect(page.locator('.knowledge-answer')).toContainText(
    'Ana enviará la propuesta el viernes.',
  );
  await page.getByRole('button', { name: /Abrir reunión/ }).click();
  await expect(page.getByLabel('Título de reunión')).toHaveValue('Reunión importada');
});
test('History backup restores new meetings and preserves duplicates', async ({ page }) => {
  await page.goto('/');
  await importText(page);
  await page.getByRole('button', { name: 'Copias del historial', exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: /Descargar copia/ }).click();
  const download = await downloaded;
  const file = await download.path();
  await page.getByLabel('Archivo de copia').setInputFiles(file!);
  await expect(page.getByText('0 reuniones nuevas · 1 ya existentes')).toBeVisible();
  await page.getByLabel('Cerrar copias').click();
  await page.evaluate(() =>
    localStorage.removeItem('glu_meetings_data_v1:11111111-1111-4111-8111-111111111111'),
  );
  await page.reload();
  await page.getByRole('button', { name: 'Copias del historial', exact: true }).click();
  await page.getByLabel('Archivo de copia').setInputFiles(file!);
  await page.getByRole('button', { name: 'Restaurar 1 reuniones' }).click();
  await expect(page.getByRole('status')).toContainText('Se restauraron 1 reuniones.');
  await page.getByLabel('Cerrar copias').click();
  await expect(page.getByLabel('Título de reunión')).toHaveValue('Reunión importada');
});
test('Browser sharing shows its limitation and does not pretend to send', async ({ page }) => {
  await page.goto('/');
  await importText(page);
  await page.getByRole('button', { name: 'Slack ↗' }).click();
  await expect(page.getByRole('form', { name: 'Compartir en Slack' })).toContainText(
    'El envío directo está disponible en Glu para escritorio.',
  );
  await expect(page.getByRole('button', { name: 'Enviar a Slack', exact: true })).toBeDisabled();
});
test('Native sharing waits for preview confirmation and displays only confirmed receipts', async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).__testRequests = [];
    (window as any).__TAURI__ = {
      core: {
        invoke: async (command: string, args: any) => {
          if (command === 'auth_session_get') return sessionStorage.getItem('glu-auth-session');
          if (command === 'load_meetings') return null;
          if (command === 'secret_get') return args.name === 'slack' ? 'test-token' : '';
          if (command === 'send_integration') {
            (window as any).__testRequests.push(args);
            return { reference: '123.456' };
          }
          return null;
        },
      },
      event: { listen: async () => () => {} },
    };
  });
  await page.goto('/');
  await importText(page);
  await page.getByRole('button', { name: 'Slack ↗' }).click();
  await page.getByLabel('ID del canal de Slack').fill('C123456789');
  await page.getByLabel('Contenido para compartir').fill('Resumen revisado por el usuario.');
  expect(await page.evaluate(() => (window as any).__testRequests.length)).toBe(0);
  await page.getByRole('button', { name: 'Enviar a Slack', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Mensaje enviado a Slack.');
  expect(await page.evaluate(() => (window as any).__testRequests[0].body.text)).toBe(
    'Resumen revisado por el usuario.',
  );
  await expect(page.getByRole('button', { name: 'Enviar a Slack', exact: true })).toHaveCount(0);
});
