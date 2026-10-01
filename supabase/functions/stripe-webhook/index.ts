import { webhookHandler } from '../_shared/webhook.ts';
import { runtime } from '../_shared/runtime.ts';
Deno.serve(webhookHandler(runtime()));
