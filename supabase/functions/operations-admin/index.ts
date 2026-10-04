import { operationsHandler } from '../_shared/operations-admin.ts';
import { operationsRuntime } from '../_shared/operations-runtime.ts';
Deno.serve(operationsHandler(operationsRuntime()));
