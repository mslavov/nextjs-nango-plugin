import { z } from 'zod';
import type { ConnectionService } from '../types/connection-service';
import crypto from 'crypto';

// Define the webhook event schema
const WebhookEventSchema = z.object({
  provider: z.string(),
  type: z.enum([
    'sync.success',
    'sync.error',
    'auth.success',
    'auth.error',
    'connection.deleted'
  ]),
  connectionId: z.string(),
  syncJobId: z.string().optional(),
  data: z.any(),
  error: z.object({
    message: z.string(),
    code: z.string(),
  }).optional(),
  createdAt: z.string().optional(),
});

// Verify webhook signature
function verifySignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function handleWebhook(
  body: string,
  signature: string | null,
  connectionService: ConnectionService,
  webhookSecret: string | null
) {
  try {
    // Optional: Verify webhook signature
    if (webhookSecret) {
      if (!verifySignature(body, signature, webhookSecret)) {
        throw new Error('Invalid webhook signature');
      }
    }

    // Parse and validate the webhook event
    const event = WebhookEventSchema.parse(JSON.parse(body));

    // Update connection status based on event type
    switch (event.type) {
      case 'auth.success':
        await connectionService.updateConnectionStatus(event.connectionId, 'ACTIVE');
        break;

      case 'auth.error':
        await connectionService.updateConnectionStatus(event.connectionId, 'ERROR');
        break;

      case 'connection.deleted':
        await connectionService.updateConnectionStatus(event.connectionId, 'INACTIVE');
        break;

      case 'sync.success':
        // Update last sync timestamp
        await connectionService.updateLastSync(event.connectionId);
        await connectionService.updateConnectionStatus(event.connectionId, 'ACTIVE');
        break;

      case 'sync.error':
        await connectionService.updateConnectionStatus(event.connectionId, 'ERROR');
        break;
    }

    return { success: true, eventType: event.type };
  } catch (error) {
    console.error('Webhook processing failed:', error);
    throw error;
  }
}