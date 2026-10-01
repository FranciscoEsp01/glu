import { billingHandler } from '../_shared/billing-core.ts';
import { runtime } from '../_shared/runtime.ts';
Deno.serve(billingHandler(runtime()));
