import { api } from './client';
import type { Shop } from './types';

/** Flat array (small bounded set). All roles may read it. */
export function listShops() {
  return api<Shop[]>('/shops');
}
