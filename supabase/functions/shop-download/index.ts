import { getServiceClient } from '../_shared/shop.ts';
import { createDownloadHandler } from './handler.mjs';

Deno.serve(createDownloadHandler({ getServiceClient }));
