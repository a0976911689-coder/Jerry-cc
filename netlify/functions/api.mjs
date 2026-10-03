import { handle } from '../../lib/api.js';

export default async (req) => handle(req);
export const config = { path: '/api/*' };
