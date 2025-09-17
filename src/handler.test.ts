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
      getConnection: jest.fn(),
      saveConnection: jest.fn(),
      listConnections: jest.fn(),
      deleteConnection: jest.fn(),
      updateConnectionStatus: jest.fn(),
      updateLastSync: jest.fn(),
      getConnections: jest.fn(),
      createConnection: jest.fn(),
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
          connection_id: 'conn-1',
          provider: 'slack',
          status: 'ACTIVE' as const,
          owner_id: 'user-1',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'id-2',
          connection_id: 'conn-2',
          provider: 'github',
          status: 'ACTIVE' as const,
          owner_id: 'user-1',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
      ];
      mockConnectionService.getConnections.mockResolvedValue(mockConnections);

      const mockRequest = {
        headers: new Map(),
      } as any;

      const response = await handler.GET(mockRequest, {
        params: { path: ['connections'] },
      });

      const data = await response.json();

      expect(config.createConnectionService).toHaveBeenCalledWith(mockRequest);
      expect(mockConnectionService.getConnections).toHaveBeenCalled();
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

      const mockRequest = {} as any;

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

      expect(config.createConnectionService).toHaveBeenCalledWith();
      expect(handleWebhook).toHaveBeenCalledWith(
        webhookBody,
        'signature-123',
        mockConnectionService,
        'webhook-secret'
      );
      expect(data).toEqual({ success: true, eventType: 'auth.success' });
    });

    it('handles /auth/session endpoint', async () => {
      const sessionData = {
        id: 'user-123',
        email: 'user@example.com',
        organizationId: 'org-456',
        integrationId: 'slack',
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

      expect(mockNangoService.createSession).toHaveBeenCalledWith(
        'user-123',
        'org-456',
        'slack',
        'user@example.com'
      );
      expect(data).toEqual({
        sessionToken: 'token-123',
        expiresAt: '2024-01-15T10:00:00Z',
      });
    });

    it('handles /connections endpoint for creating connections', async () => {
      const connectionData = {
        provider: 'slack',
        connectionId: 'conn-new',
        metadata: { team: 'engineering' },
      };

      const mockRequest = {
        json: jest.fn().mockResolvedValue(connectionData),
      } as any;

      const mockConnection = {
        id: 'id-new',
        connection_id: 'conn-new',
        provider: 'slack',
        status: 'ACTIVE' as const,
        owner_id: 'user-1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };
      mockConnectionService.createConnection.mockResolvedValue(mockConnection);

      const response = await handler.POST(mockRequest, {
        params: { path: ['connections'] },
      });

      const data = await response.json();

      expect(config.createConnectionService).toHaveBeenCalledWith(mockRequest);
      expect(mockConnectionService.createConnection).toHaveBeenCalledWith(
        'slack',
        'conn-new',
        { team: 'engineering' }
      );
      expect(data).toEqual(mockConnection);
    });

    it('uses default values for session when data is missing', async () => {
      const sessionData = {};

      const mockRequest = {
        json: jest.fn().mockResolvedValue(sessionData),
      } as any;

      mockNangoService.createSession.mockResolvedValue({
        sessionToken: 'token-456',
        expiresAt: '2024-01-16T10:00:00Z',
      });

      await handler.POST(mockRequest, {
        params: { path: ['auth', 'session'] },
      });

      expect(mockNangoService.createSession).toHaveBeenCalledWith(
        'default-user',
        'default-user',
        undefined,
        'default-user@app.local'
      );
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
        owner_id: 'user-1',
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
    it('handles connection deletion', async () => {
      const mockRequest = {} as any;

      const response = await handler.DELETE(mockRequest, {
        params: { path: ['connections', 'conn-123'] },
      });

      const data = await response.json();

      expect(config.createConnectionService).toHaveBeenCalledWith(mockRequest);
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

      const mockRequest = {} as any;

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
        owner_id: 'user-1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }];
      mockConnectionService.getConnections.mockResolvedValue(mockConnections);

      const mockRequest = {} as any;

      const response = await handler.GET(mockRequest, {
        params: Promise.resolve({ path: ['connections'] }),
      });

      const data = await response.json();

      expect(mockConnectionService.getConnections).toHaveBeenCalled();
      expect(data).toEqual(mockConnections);
    });
  });
});