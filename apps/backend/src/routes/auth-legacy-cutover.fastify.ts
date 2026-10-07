/**
 * Public cutover view. Does not change the mode and does not identify a user.
 * legacyEntryAvailable is false only in WALLET_ONLY. A failed read stays open
 * in the UI; the server still refuses legacy session issuance.
 */

import type { FastifyInstance } from 'fastify';
import { publicCutoverView } from '../services/legacy-auth-policy.service.js';

export default async function authLegacyCutoverRoutes(app: FastifyInstance): Promise<void> {
  app.get('/wallet-cutover', async (_request, reply) => {
    const view = await publicCutoverView();
    return reply.send({ success: true, data: view });
  });
}
