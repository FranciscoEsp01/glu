import { paidAIHandler } from '../_shared/paid-ai.ts';
import { runtime } from '../_shared/runtime.ts';
Deno.serve(paidAIHandler(runtime()));
