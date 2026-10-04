import { transcriptionHandler } from '../_shared/transcription.ts';
import { runtime } from '../_shared/runtime.ts';
Deno.serve(transcriptionHandler(runtime()));
