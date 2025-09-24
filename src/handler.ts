import { NangoPluginConfig } from './lib/types/config';
import { NangoService, NangoSessionData } from './lib/nango/client';
import { handleWebhook } from './lib/webhooks/handler';
import type { ConnectionService } from './lib/types/connection-service';
import type { IntegrationService } from './lib/types/integration-service';
import type { SecretsService } from './lib/types/secrets-service';

// Type definitions for Next.js without importing from next/server
type NextRequest = any;
type NextResponse = any;

export function createNangoHandler(config: NangoPluginConfig) {
  const nango = new NangoService(config.nango.secretKey, config.nango.host);

  // Helper to create JSON responses
  const jsonResponse = (data: any, init?: ResponseInit) => {
    return new Response(JSON.stringify(data), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {})
      }
    });
  };

  // Helper functions to get optional services
  const getConnectionService = async (request?: NextRequest): Promise<ConnectionService | null> => {
    if (!config.createConnectionService) return null;
    return await config.createConnectionService(request);
  };

  const getIntegrationService = async (request?: NextRequest): Promise<IntegrationService | null> => {
    if (!config.createIntegrationService) return null;
    return await config.createIntegrationService(request);
  };

  const getSecretsService = async (request?: NextRequest): Promise<SecretsService | null> => {
    if (!config.createSecretsService) return null;
    return await config.createSecretsService(request);
  };

  // Extract auth context for zero-config mode
  const extractAuthContext = (request: NextRequest) => {
    // Try to extract user/org from headers (can be customized)
    const userId = request.headers.get?.('x-user-id') || 'anonymous';
    const organizationId = request.headers.get?.('x-organization-id') || undefined;
    return { userId, organizationId };
  };

  return {
    GET: async (request: NextRequest, context?: { params?: { path?: string[] } | Promise<{ path?: string[] }> }) => {
      const params = context?.params ? await context.params : undefined;
      const path = params?.path?.join('/') || '';

      try {
        switch (path) {
          case 'connections': {
            // Get optional ConnectionService
            const service = await getConnectionService(request);

            if (service) {
              // Use local ConnectionService
              const url = new URL(request.url);
              const metadata: Record<string, any> = {};

              // Parse query parameters that start with 'metadata.' as filters
              // Example: ?metadata.owner_id=user123&metadata.team_id=team456
              url.searchParams.forEach((value, key) => {
                if (key.startsWith('metadata.')) {
                  const metadataKey = key.substring('metadata.'.length);
                  // Try to parse as JSON for complex values, otherwise use as string
                  try {
                    metadata[metadataKey] = JSON.parse(value);
                  } catch {
                    metadata[metadataKey] = value;
                  }
                }
              });

              // Pass metadata filters to getConnections
              const connections = await service.getConnections(
                Object.keys(metadata).length > 0 ? metadata : undefined
              );
              return jsonResponse(connections);
            } else {
              // Fallback to Nango API - connections are managed by Nango
              // In zero-config mode, we can list connections but they're not stored locally
              const { userId } = extractAuthContext(request);

              // Note: Nango doesn't have a direct list connections API
              // In zero-config mode, connections are only accessible via Nango's dashboard
              // Return empty array as we don't store connections locally
              console.log('ConnectionService not configured - connections managed by Nango');
              return jsonResponse([]);
            }
          }

          case 'integrations': {
            // Get optional IntegrationService
            const service = await getIntegrationService(request);

            if (service) {
              // Use local IntegrationService (cached data)
              const integrations = await service.getIntegrations();
              return jsonResponse(integrations);
            } else {
              // Fallback to Nango API
              const integrations = await nango.listIntegrations();
              return jsonResponse(integrations);
            }
          }

          default:
            // Handle connection-specific routes
            if (path.startsWith('connections/') && path.endsWith('/credentials')) {
              const connectionId = path.split('/')[1];
              const secretsService = await getSecretsService(request);

              if (secretsService) {
                // Try to get from local storage
                const secret = await secretsService.getSecret(connectionId);
                if (secret) {
                  return jsonResponse(secret.credentials);
                }
              }

              // Fallback: would need to get from Nango, but requires provider key
              // In practice, this would need additional context
              return jsonResponse(
                { error: 'Credentials not available without SecretsService or provider context' },
                { status: 501 }
              );
            }

            return jsonResponse({ error: 'Not found' }, { status: 404 });
        }
      } catch (error: any) {
        console.error('API error:', error);
        return jsonResponse(
          { error: error.message || 'Internal server error' },
          { status: 500 }
        );
      }
    },

    POST: async (request: NextRequest, context?: { params?: { path?: string[] } | Promise<{ path?: string[] }> }) => {
      const params = context?.params ? await context.params : undefined;
      const path = params?.path?.join('/') || '';

      try {
        switch (path) {
          case 'webhooks': {
            // Get optional services for webhook handling
            const connectionService = await getConnectionService();
            const secretsService = await getSecretsService();

            const body = await request.text();
            const signature = request.headers.get('x-nango-signature');

            // Pass nango service and both optional services to webhook handler
            const result = await handleWebhook(
              body,
              signature,
              connectionService,
              nango,
              secretsService
            );
            return jsonResponse(result);
          }

          case 'auth/session': {
            const data = await request.json() as any;

            // Validate required fields
            if (!data.end_user?.id) {
              return jsonResponse(
                { error: 'end_user.id is required' },
                { status: 400 }
              );
            }

            // Build session data matching Nango's API signature
            const sessionData: NangoSessionData = {
              end_user: {
                id: data.end_user.id,
              }
            };

            // Only add optional end_user fields if provided
            if (data.end_user.email) {
              sessionData.end_user.email = data.end_user.email;
            }
            if (data.end_user.display_name) {
              sessionData.end_user.display_name = data.end_user.display_name;
            }

            // Only add organization if provided
            if (data.organization && data.organization.id) {
              sessionData.organization = { id: data.organization.id };
              if (data.organization.display_name) {
                sessionData.organization.display_name = data.organization.display_name;
              }
            }

            // Only add allowed_integrations if provided
            if (data.allowed_integrations) {
              sessionData.allowed_integrations = data.allowed_integrations;
            }

            const session = await nango.createSession(sessionData);
            return jsonResponse(session);
          }


          default:
            return jsonResponse({ error: 'Not found' }, { status: 404 });
        }
      } catch (error: any) {
        console.error('API error:', error);
        return jsonResponse(
          { error: error.message || 'Internal server error' },
          { status: 500 }
        );
      }
    },

    PUT: async (request: NextRequest, context?: { params?: { path?: string[] } | Promise<{ path?: string[] }> }) => {
      const params = context?.params ? await context.params : undefined;
      const path = params?.path?.join('/') || '';

      try {
        // Handle connection status updates
        if (path.startsWith('connections/')) {
          const connectionId = path.split('/')[1];
          const service = await getConnectionService(request);

          if (!service) {
            return jsonResponse(
              { error: 'ConnectionService required for updates' },
              { status: 501 }
            );
          }

          const data = await request.json() as any;

          if (data.status) {
            const connection = await service.updateConnectionStatus(connectionId, data.status);
            return jsonResponse(connection);
          }

          return jsonResponse({ error: 'Invalid update' }, { status: 400 });
        }

        return jsonResponse({ error: 'Not implemented' }, { status: 501 });
      } catch (error: any) {
        console.error('API error:', error);
        return jsonResponse(
          { error: error.message || 'Internal server error' },
          { status: 500 }
        );
      }
    },

    DELETE: async (request: NextRequest, context?: { params?: { path?: string[] } | Promise<{ path?: string[] }> }) => {
      const params = context?.params ? await context.params : undefined;
      const path = params?.path?.join('/') || '';

      try {
        // Handle connection deletion
        if (path.startsWith('connections/')) {
          const connectionId = path.split('/')[1];
          const service = await getConnectionService(request);

          // Get providerConfigKey from request body
          const data = await request.json() as any;
          const providerConfigKey = data.providerConfigKey;

          // Delete from Nango if providerConfigKey is provided
          if (providerConfigKey) {
            const deleted = await nango.deleteConnection(connectionId, providerConfigKey);
            if (!deleted) {
              console.warn(`Failed to delete connection from Nango: ${connectionId}`);
            }
          }

          // Delete from local database if service exists
          if (service) {
            await service.deleteConnection(connectionId);
          }

          return jsonResponse({ success: true });
        }

        return jsonResponse({ error: 'Not implemented' }, { status: 501 });
      } catch (error: any) {
        console.error('API error:', error);
        return jsonResponse(
          { error: error.message || 'Internal server error' },
          { status: 500 }
        );
      }
    },
  };
}