import { z } from 'zod';
import type { ConnectionService } from '../types/connection-service';
import type { SecretsService, Credentials } from '../types/secrets-service';
import type { NangoService } from '../nango/client';

// Define the webhook event schema matching Nango's actual payload
const WebhookEventSchema = z.object({
  type: z.enum([
    'sync',
    'auth',
    'connection.deleted'
  ]),
  operation: z.enum([
    'creation',
    'deletion',
    'update'
  ]).optional(),
  success: z.boolean().optional(),
  connectionId: z.string(),
  providerConfigKey: z.string(),
  provider: z.string(),
  environment: z.string().optional(),
  authMode: z.string().optional(),
  syncJobId: z.string().optional(),
  data: z.any().optional(),
  endUser: z.object({
    endUserId: z.string(),
    organizationId: z.string().optional(),
  }).optional(),
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
    type: z.string().optional(),
    description: z.string().optional(),
  }).optional(),
  createdAt: z.string().optional(),
});

// Convert Nango credentials to our Credentials interface
function convertNangoCredentials(nangoCredentials: any): Credentials {
  const creds: Credentials = {
    type: 'CUSTOM', // Default to CUSTOM
    raw: nangoCredentials.raw || {}
  };

  // Map Nango credential types to our types
  switch (nangoCredentials.type) {
    case 'OAUTH2':
      creds.type = 'OAUTH2';
      creds.access_token = nangoCredentials.access_token;
      creds.refresh_token = nangoCredentials.refresh_token;
      // Convert Date to ISO string if present
      if ('expires_at' in nangoCredentials) {
        creds.expires_at = nangoCredentials.expires_at instanceof Date
          ? nangoCredentials.expires_at.toISOString()
          : nangoCredentials.expires_at;
      }
      break;

    case 'OAUTH2_CC': // OAuth2 Client Credentials
      creds.type = 'OAUTH2';
      creds.access_token = nangoCredentials.token;
      // Convert Date to ISO string if present
      if ('expires_at' in nangoCredentials) {
        creds.expires_at = nangoCredentials.expires_at instanceof Date
          ? nangoCredentials.expires_at.toISOString()
          : nangoCredentials.expires_at;
      }
      break;

    case 'OAUTH1':
      creds.type = 'OAUTH1';
      creds.access_token = nangoCredentials.oauth_token;
      // Store OAuth1 specific fields in raw
      creds.raw = {
        ...creds.raw,
        oauth_token: nangoCredentials.oauth_token,
        oauth_token_secret: nangoCredentials.oauth_token_secret
      };
      break;

    case 'API_KEY':
      creds.type = 'API_KEY';
      creds.api_key = nangoCredentials.api_key;
      break;

    case 'BASIC':
      creds.type = 'BASIC';
      creds.username = nangoCredentials.username;
      creds.password = nangoCredentials.password;
      break;

    default:
      // For any other types (JWT, TBA, APP_STORE, etc.), store in raw
      creds.type = 'CUSTOM';
      if (creds.raw) {
        Object.assign(creds.raw, nangoCredentials);
      }
  }

  return creds;
}

export async function handleWebhook(
  body: string,
  signature: string | null,
  connectionService: ConnectionService | null,
  nangoService: NangoService | null,
  secretsService?: SecretsService | null
) {
  try {
    // Parse the body first
    const parsedBody = JSON.parse(body);

    // Optional: Verify webhook signature using Nango's built-in method
    if (nangoService && signature) {
      const isValid = (nangoService as any).client.verifyWebhookSignature(signature, parsedBody);
      if (!isValid) {
        throw new Error('Invalid webhook signature');
      }
    }

    // Validate the webhook event
    const event = WebhookEventSchema.parse(parsedBody);

    // Handle different event types
    switch (event.type) {
      case 'auth':
        if (event.operation === 'creation' && event.success) {
          // Extract ownership information
          const ownerId = event.endUser?.endUserId;
          const organizationId = event.endUser?.organizationId;

          if (!ownerId) {
            console.error('No owner ID found in webhook event');
            break;
          }

          // Handle connection creation/update if service exists
          if (connectionService) {
            // Check if connection already exists (for idempotency)
            if (connectionService.getConnection) {
              const existingConnection = await connectionService.getConnection(event.connectionId);
              if (existingConnection) {
                // Connection exists, just update status
                await connectionService.updateConnectionStatus(event.connectionId, 'ACTIVE');
                break;
              }
            }

            // Build metadata for additional information
            const metadata: Record<string, any> = {};
            if (event.environment) {
              metadata.environment = event.environment;
            }

            try {
              // Try to create the connection with explicit ownership
              await connectionService.createConnection(
                event.providerConfigKey,
                event.connectionId,
                ownerId,
                organizationId,
                metadata
              );
            } catch (error) {
              // If creation fails, try updating status as fallback
              console.log(`Failed to create connection ${event.connectionId}:`, error);
              try {
                await connectionService.updateConnectionStatus(event.connectionId, 'ACTIVE');
              } catch (updateError) {
                console.error(`Failed to update connection ${event.connectionId}:`, updateError);
              }
            }
          }

          // Fetch and store credentials if both services exist
          if (secretsService && nangoService) {
            try {
              // Fetch the connection with credentials from Nango API
              const connection = await nangoService.getConnection(
                event.connectionId,
                event.providerConfigKey
              );

              if (connection && connection.credentials) {
                // Convert Nango credentials to match our Credentials interface
                const credentials = convertNangoCredentials(connection.credentials);

                // Store the credentials using SecretsService
                await secretsService.storeSecret(
                  event.connectionId,
                  event.provider,
                  credentials,
                  ownerId,
                  organizationId
                );
              }
            } catch (error) {
              console.error('Failed to fetch or store credentials:', error);
            }
          }
        } else if (!event.success && connectionService) {
          // Auth failed, update status to ERROR if connection exists
          try {
            await connectionService.updateConnectionStatus(event.connectionId, 'ERROR');
          } catch (error) {
            console.log(`Connection ${event.connectionId} doesn't exist yet, skipping status update`);
          }
        }
        break;

      case 'connection.deleted':
        if (connectionService) {
          await connectionService.updateConnectionStatus(event.connectionId, 'INACTIVE');
        }
        if (secretsService) {
          // Clean up stored credentials
          await secretsService.deleteSecret(event.connectionId);
        }
        break;

      case 'sync':
        if (connectionService) {
          if (event.success) {
            // Ensure active status after successful sync
            await connectionService.updateConnectionStatus(event.connectionId, 'ACTIVE');
          } else {
            await connectionService.updateConnectionStatus(event.connectionId, 'ERROR');
          }
        }
        break;
    }

    return { success: true, eventType: event.type, operation: event.operation };
  } catch (error) {
    console.error('Webhook processing failed:', error);
    throw error;
  }
}