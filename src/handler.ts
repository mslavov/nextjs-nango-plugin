import { NangoPluginConfig } from './lib/types/config';
import { NangoService } from './lib/nango/client';
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

            // The service implementation will determine ownership from the request
            const connections = await service.getConnections();
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

            // Use provided session data or fallback to defaults
            // The component passes whatever session data is needed
            const userId = data.id || data.userId || 'default-user';
            const orgId = data.organizationId || data.orgId || userId;
            const email = data.email || `${userId}@app.local`;

            const session = await nango.createSession(
              userId,
              orgId,
              data.integrationId,
              email
            );
            return jsonResponse(session);
          }

          case 'connections': {
            // Create a new connection
            const service = await config.createConnectionService(request);
            const data = await request.json() as any;

            const connection = await service.createConnection(
              data.provider,
              data.connectionId,
              data.metadata
            );
            return jsonResponse(connection);
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

          // Note: To delete from Nango, we'd need the providerConfigKey
          // which would need to be fetched or stored with the connection

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