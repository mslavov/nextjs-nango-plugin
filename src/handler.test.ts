import { createNangoHandler } from './handler';
import { NangoPluginConfig } from './lib/types/config';
import { NangoService } from './lib/nango/client';
import { handleWebhook } from './lib/webhooks/handler';
import type { ConnectionService } from './lib/types/connection-service';

// Mock Response for Node.js environment
global.Response = class Response {
  body: any;
  status: number;
  headers: any;

  constructor(body: any, init?: any) {
    this.body = body;
    this.status = init?.status || 200;
    this.headers = init?.headers || {};
  }

  async json() {
    return JSON.parse(this.body);
  }
} as any;

jest.mock('./lib/nango/client');
jest.mock('./lib/webhooks/handler');

describe('createNangoHandler', () => {
  let mockConnectionService: jest.Mocked<ConnectionService>;
  let mockNangoService: jest.Mocked<NangoService>;
  let handler: ReturnType<typeof createNangoHandler>;
  let config: NangoPluginConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConnectionService = {
      getConnections: jest.fn(),
      createConnection: jest.fn(),
      updateConnectionStatus: jest.fn(),
      deleteConnection: jest.fn(),
    } as any;

    mockNangoService = {
      createSession: jest.fn(),
      listIntegrations: jest.fn(),
      getConnection: jest.fn(),
      deleteConnection: jest.fn(),
      triggerSync: jest.fn(),
    } as any;

    (NangoService as jest.MockedClass<typeof NangoService>).mockImplementation(() => mockNangoService);

    config = {
      nango: {
        secretKey: 'test-secret',
        host: 'https://api.nango.dev',
        webhookSecret: 'webhook-secret',
      },
      createConnectionService: jest.fn().mockResolvedValue(mockConnectionService),
    };

    handler = createNangoHandler(config);
  });

  describe('GET endpoints', () => {
    it('handles /connections endpoint', async () => {
      const mockConnections = [
        {
          id: 'id-1',
          owner_id: 'user-1',
          connection_id: 'conn-1',
          provider: 'slack',
          status: 'ACTIVE' as const,
          metadata: { environment: 'production' },
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'id-2',
          owner_id: 'user-1',
          organization_id: 'org-1',
          connection_id: 'conn-2',
          provider: 'github',
          status: 'ACTIVE' as const,
          metadata: { environment: 'staging' },
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
      ];
      mockConnectionService.getConnections.mockResolvedValue(mockConnections);

      const mockRequest = {
        url: 'http://localhost/api/nango/connections',
        headers: new Map(),
      } as any;

      const response = await handler.GET(mockRequest, {
        params: { path: ['connections'] },
      });

      const data = await response.json();

      expect(config.createConnectionService).toHaveBeenCalledWith(mockRequest);
      expect(mockConnectionService.getConnections).toHaveBeenCalledWith(undefined);
      expect(data).toEqual(mockConnections);
    });

    it('handles /connections endpoint with metadata filters', async () => {
      const mockConnections = [
        {
          id: 'id-1',
          owner_id: 'user-1',
          organization_id: 'org-1',
          connection_id: 'conn-1',
          provider: 'slack',
          status: 'ACTIVE' as const,
          metadata: { team_id: 'team-1', environment: 'production' },
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
      ];
      mockConnectionService.getConnections.mockResolvedValue(mockConnections);

      const mockRequest = {
        url: 'http://localhost/api/nango/connections?metadata.owner_id=user-1&metadata.team_id=team-1',
        headers: new Map(),
      } as any;

      const response = await handler.GET(mockRequest, {
        params: { path: ['connections'] },
      });

      const data = await response.json();

      expect(config.createConnectionService).toHaveBeenCalledWith(mockRequest);
      expect(mockConnectionService.getConnections).toHaveBeenCalledWith({
        owner_id: 'user-1',
        team_id: 'team-1'
      });
      expect(data).toEqual(mockConnections);
    });

    it('handles /integrations endpoint', async () => {
      const mockIntegrations = [
        { id: 'slack', provider: 'slack' },
        { id: 'github', provider: 'github' },
      ];
      mockNangoService.listIntegrations.mockResolvedValue(mockIntegrations);

      const mockRequest = {} as any;

      const response = await handler.GET(mockRequest, {
        params: { path: ['integrations'] },
      });

      const data = await response.json();

      expect(mockNangoService.listIntegrations).toHaveBeenCalled();
      expect(data).toEqual(mockIntegrations);
    });

    it('returns 404 for unknown endpoints', async () => {
      const mockRequest = {} as any;

      const response = await handler.GET(mockRequest, {
        params: { path: ['unknown'] },
      });

      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ error: 'Not found' });
    });

    it('handles errors gracefully', async () => {
      mockConnectionService.getConnections.mockRejectedValue(new Error('Database error'));

      const mockRequest = {
        url: 'http://localhost/api/nango/connections',
        headers: new Map(),
      } as any;

      const response = await handler.GET(mockRequest, {
        params: { path: ['connections'] },
      });

      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Database error' });
    });
  });

  describe('POST endpoints', () => {
    it('handles /webhooks endpoint', async () => {
      const webhookBody = JSON.stringify({
        type: 'auth.success',
        connectionId: 'conn-123',
        provider: 'slack',
      });

      const mockRequest = {
        text: jest.fn().mockResolvedValue(webhookBody),
        headers: {
          get: jest.fn().mockReturnValue('signature-123'),
        },
      } as any;

      (handleWebhook as jest.Mock).mockResolvedValue({ success: true, eventType: 'auth.success' });

      const response = await handler.POST(mockRequest, {
        params: { path: ['webhooks'] },
      });

      const data = await response.json();

      expect(config.createConnectionService).toHaveBeenCalled();
      expect(handleWebhook).toHaveBeenCalledWith(
        webhookBody,
        'signature-123',
        mockConnectionService,
        'webhook-secret',
        null // No SecretsService configured returns null
      );
      expect(data).toEqual({ success: true, eventType: 'auth.success' });
    });

    it('handles /auth/session endpoint', async () => {
      const sessionData = {
        end_user: {
          id: 'user-123',
          email: 'user@example.com',
          display_name: 'John Doe'
        },
        organization: {
          id: 'org-456',
          display_name: 'Acme Corp'
        },
        allowed_integrations: ['slack']
      };

      const mockRequest = {
        json: jest.fn().mockResolvedValue(sessionData),
      } as any;

      mockNangoService.createSession.mockResolvedValue({
        sessionToken: 'token-123',
        expiresAt: '2024-01-15T10:00:00Z',
      });

      const response = await handler.POST(mockRequest, {
        params: { path: ['auth', 'session'] },
      });

      const data = await response.json();

      expect(mockNangoService.createSession).toHaveBeenCalledWith(sessionData);
      expect(data).toEqual({
        sessionToken: 'token-123',
        expiresAt: '2024-01-15T10:00:00Z',
      });
    });


    it('returns error when required end_user.id is missing', async () => {
      const sessionData = {
        organization: {
          id: 'org-456'
        }
      };

      const mockRequest = {
        json: jest.fn().mockResolvedValue(sessionData),
      } as any;

      const response = await handler.POST(mockRequest, {
        params: { path: ['auth', 'session'] },
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: 'end_user.id is required' });
      expect(mockNangoService.createSession).not.toHaveBeenCalled();
    });
  });

  describe('PUT endpoints', () => {
    it('handles connection status update', async () => {
      const updateData = { status: 'ACTIVE' };

      const mockRequest = {
        json: jest.fn().mockResolvedValue(updateData),
      } as any;

      const mockConnection = {
        id: 'id-123',
        connection_id: 'conn-123',
        provider: 'slack',
        status: 'ACTIVE' as const,
        metadata: { owner_id: 'user-1' },
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };
      mockConnectionService.updateConnectionStatus.mockResolvedValue(mockConnection);

      const response = await handler.PUT(mockRequest, {
        params: { path: ['connections', 'conn-123'] },
      });

      const data = await response.json();

      expect(config.createConnectionService).toHaveBeenCalledWith(mockRequest);
      expect(mockConnectionService.updateConnectionStatus).toHaveBeenCalledWith('conn-123', 'ACTIVE');
      expect(data).toEqual(mockConnection);
    });

    it('returns 400 for invalid update', async () => {
      const mockRequest = {
        json: jest.fn().mockResolvedValue({}),
      } as any;

      const response = await handler.PUT(mockRequest, {
        params: { path: ['connections', 'conn-123'] },
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: 'Invalid update' });
    });

    it('returns 501 for non-connection endpoints', async () => {
      const mockRequest = {
        json: jest.fn().mockResolvedValue({}),
      } as any;

      const response = await handler.PUT(mockRequest, {
        params: { path: ['other'] },
      });

      const data = await response.json();

      expect(response.status).toBe(501);
      expect(data).toEqual({ error: 'Not implemented' });
    });
  });

  describe('DELETE endpoints', () => {
    it('handles connection deletion with providerConfigKey', async () => {
      const mockRequest = {
        json: jest.fn().mockResolvedValue({ providerConfigKey: 'slack-prod' }),
      } as any;

      mockNangoService.deleteConnection.mockResolvedValue(true);
      mockConnectionService.deleteConnection.mockResolvedValue(true);

      const response = await handler.DELETE(mockRequest, {
        params: { path: ['connections', 'conn-123'] },
      });

      const data = await response.json();

      expect(config.createConnectionService).toHaveBeenCalledWith(mockRequest);
      expect(mockNangoService.deleteConnection).toHaveBeenCalledWith('conn-123', 'slack-prod');
      expect(mockConnectionService.deleteConnection).toHaveBeenCalledWith('conn-123');
      expect(data).toEqual({ success: true });
    });

    it('handles connection deletion without providerConfigKey', async () => {
      const mockRequest = {
        json: jest.fn().mockResolvedValue({}),
      } as any;

      mockConnectionService.deleteConnection.mockResolvedValue(true);

      const response = await handler.DELETE(mockRequest, {
        params: { path: ['connections', 'conn-123'] },
      });

      const data = await response.json();

      expect(config.createConnectionService).toHaveBeenCalledWith(mockRequest);
      expect(mockNangoService.deleteConnection).not.toHaveBeenCalled();
      expect(mockConnectionService.deleteConnection).toHaveBeenCalledWith('conn-123');
      expect(data).toEqual({ success: true });
    });

    it('returns 501 for non-connection endpoints', async () => {
      const mockRequest = {} as any;

      const response = await handler.DELETE(mockRequest, {
        params: { path: ['other'] },
      });

      const data = await response.json();

      expect(response.status).toBe(501);
      expect(data).toEqual({ error: 'Not implemented' });
    });

    it('handles errors gracefully', async () => {
      mockConnectionService.deleteConnection.mockRejectedValue(new Error('Delete failed'));

      const mockRequest = {
        json: jest.fn().mockResolvedValue({}),
      } as any;

      const response = await handler.DELETE(mockRequest, {
        params: { path: ['connections', 'conn-123'] },
      });

      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Delete failed' });
    });
  });

  describe('edge cases', () => {
    it('handles missing path parameters', async () => {
      const mockRequest = {} as any;

      const response = await handler.GET(mockRequest);

      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ error: 'Not found' });
    });

    it('handles empty path array', async () => {
      const mockRequest = {} as any;

      const response = await handler.GET(mockRequest, {
        params: { path: [] },
      });

      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ error: 'Not found' });
    });

    it('handles promise-based params', async () => {
      const mockConnections = [{
        id: 'id-1',
        connection_id: 'conn-1',
        provider: 'slack',
        status: 'ACTIVE' as const,
        metadata: { owner_id: 'user-1' },
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }];
      mockConnectionService.getConnections.mockResolvedValue(mockConnections);

      const mockRequest = {
        url: 'http://localhost/api/nango/connections',
        headers: new Map(),
      } as any;

      const response = await handler.GET(mockRequest, {
        params: Promise.resolve({ path: ['connections'] }),
      });

      const data = await response.json();

      expect(mockConnectionService.getConnections).toHaveBeenCalled();
      expect(data).toEqual(mockConnections);
    });
  });
});

describe('createNangoHandler with optional services', () => {
  let mockNangoService: jest.Mocked<NangoService>;
  let handler: ReturnType<typeof createNangoHandler>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockNangoService = {
      createSession: jest.fn(),
      listIntegrations: jest.fn(),
      getConnection: jest.fn(),
      deleteConnection: jest.fn(),
      triggerSync: jest.fn(),
    } as any;

    (NangoService as jest.MockedClass<typeof NangoService>).mockImplementation(() => mockNangoService);
  });

  describe('zero-config mode', () => {
    beforeEach(() => {
      const config: NangoPluginConfig = {
        nango: {
          secretKey: 'test-secret',
          host: 'https://api.nango.dev',
        },
        // No services provided
      };
      handler = createNangoHandler(config);
    });

    it('handles /connections endpoint without ConnectionService', async () => {
      const mockRequest = {
        url: 'http://localhost/api/nango/connections',
        headers: {
          get: jest.fn().mockReturnValue(null)
        },
      } as any;

      const response = await handler.GET(mockRequest, {
        params: { path: ['connections'] },
      });

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });

    it('handles /integrations endpoint by calling Nango API', async () => {
      const mockIntegrations = [
        { id: 'github', provider: 'github', displayName: 'GitHub' },
        { id: 'slack', provider: 'slack', displayName: 'Slack' },
      ];
      mockNangoService.listIntegrations.mockResolvedValue(mockIntegrations);

      const mockRequest = {
        url: 'http://localhost/api/nango/integrations',
        headers: {
          get: jest.fn().mockReturnValue(null)
        },
      } as any;

      const response = await handler.GET(mockRequest, {
        params: { path: ['integrations'] },
      });

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(mockNangoService.listIntegrations).toHaveBeenCalled();
      expect(data).toEqual(mockIntegrations);
    });

    it('returns 501 for connection updates without service', async () => {
      const mockRequest = {
        url: 'http://localhost/api/nango/connections/conn-1',
        headers: {
          get: jest.fn().mockReturnValue(null)
        },
        json: jest.fn().mockResolvedValue({ status: 'INACTIVE' }),
      } as any;

      const response = await handler.PUT(mockRequest, {
        params: { path: ['connections', 'conn-1'] },
      });

      const data = await response.json();
      expect(response.status).toBe(501);
      expect(data.error).toBe('ConnectionService required for updates');
    });
  });

  describe('selective services mode', () => {
    it('uses ConnectionService when provided but falls back for integrations', async () => {
      const mockConnectionService = {
        getConnections: jest.fn().mockResolvedValue([]),
        createConnection: jest.fn(),
        updateConnectionStatus: jest.fn(),
        deleteConnection: jest.fn(),
      } as any;

      const config: NangoPluginConfig = {
        nango: {
          secretKey: 'test-secret',
        },
        createConnectionService: jest.fn().mockResolvedValue(mockConnectionService),
        // No IntegrationService
      };

      handler = createNangoHandler(config);

      // Test connections endpoint - should use service
      const connRequest = {
        url: 'http://localhost/api/nango/connections',
        headers: {
          get: jest.fn().mockReturnValue(null)
        },
      } as any;

      await handler.GET(connRequest, {
        params: { path: ['connections'] },
      });

      expect(mockConnectionService.getConnections).toHaveBeenCalled();

      // Test integrations endpoint - should use Nango API
      mockNangoService.listIntegrations.mockResolvedValue({
        configs: [],
      } as any);

      const intRequest = {
        url: 'http://localhost/api/nango/integrations',
        headers: {
          get: jest.fn().mockReturnValue(null)
        },
      } as any;

      await handler.GET(intRequest, {
        params: { path: ['integrations'] },
      });

      expect(mockNangoService.listIntegrations).toHaveBeenCalled();
    });
  });
});