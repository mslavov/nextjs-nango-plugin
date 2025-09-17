import { NangoPluginConfig } from './lib/types/config';
import { NangoService, NangoSessionData } from './lib/nango/client';
import { handleWebhook } from './lib/webhooks/handler';

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

  return {
    GET: async (request: NextRequest, context?: { params?: { path?: string[] } | Promise<{ path?: string[] }> }) => {
      const params = context?.params ? await context.params : undefined;
      const path = params?.path?.join('/') || '';

      try {
        switch (path) {
          case 'connections': {
            // Use injected ConnectionService
            const service = await config.createConnectionService(request);

            // Extract metadata filters from query parameters
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
          }

          case 'integrations': {
            const integrations = await nango.listIntegrations();
            return jsonResponse(integrations);
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

    POST: async (request: NextRequest, context?: { params?: { path?: string[] } | Promise<{ path?: string[] }> }) => {
      const params = context?.params ? await context.params : undefined;
      const path = params?.path?.join('/') || '';

      try {
        switch (path) {
          case 'webhooks': {
            // Use injected ConnectionService for webhooks (no request)
            const service = await config.createConnectionService();

            const body = await request.text();
            const signature = request.headers.get('x-nango-signature');
            const webhookSecret = config.nango.webhookSecret || null;
            const result = await handleWebhook(body, signature, service, webhookSecret);
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
          const service = await config.createConnectionService(request);
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
          const service = await config.createConnectionService(request);

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

          // Delete from our database
          await service.deleteConnection(connectionId);

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