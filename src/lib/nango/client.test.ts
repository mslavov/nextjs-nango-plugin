import { NangoService } from './client';
import { Nango } from '@nangohq/node';

jest.mock('@nangohq/node');

describe('NangoService', () => {
  let service: NangoService;
  let mockNangoClient: jest.Mocked<Nango>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockNangoClient = {
      createConnectSession: jest.fn(),
      listIntegrations: jest.fn(),
      getConnection: jest.fn(),
      deleteConnection: jest.fn(),
      triggerSync: jest.fn(),
    } as any;

    (Nango as jest.MockedClass<typeof Nango>).mockImplementation(() => mockNangoClient);

    service = new NangoService('test-secret-key');
  });

  describe('constructor', () => {
    it('creates Nango client with default host', () => {
      service = new NangoService('test-secret');
      expect(Nango).toHaveBeenCalledWith({
        secretKey: 'test-secret',
        host: 'https://api.nango.dev',
      });
    });

    it('creates Nango client with custom host', () => {
      service = new NangoService('test-secret', 'https://custom.nango.dev');
      expect(Nango).toHaveBeenCalledWith({
        secretKey: 'test-secret',
        host: 'https://custom.nango.dev',
      });
    });
  });

  describe('createSession', () => {
    it('creates session with all parameters', async () => {
      const mockResponse = {
        data: {
          token: 'session-token-123',
          expires_at: '2024-01-15T10:00:00Z',
        },
      };
      mockNangoClient.createConnectSession.mockResolvedValue(mockResponse as any);

      const result = await service.createSession('user-123', 'org-456', 'slack', 'user@example.com');

      expect(mockNangoClient.createConnectSession).toHaveBeenCalledWith({
        end_user: {
          id: 'user-123',
          email: 'user@example.com',
        },
        organization: {
          id: 'org-456',
        },
        allowed_integrations: ['slack'],
      });

      expect(result).toEqual({
        sessionToken: 'session-token-123',
        expiresAt: '2024-01-15T10:00:00Z',
      });
    });

    it('creates session without optional parameters', async () => {
      const mockResponse = {
        data: {
          token: 'session-token-456',
          expires_at: '2024-01-16T10:00:00Z',
        },
      };
      mockNangoClient.createConnectSession.mockResolvedValue(mockResponse as any);

      const result = await service.createSession('user-789', 'org-012');

      expect(mockNangoClient.createConnectSession).toHaveBeenCalledWith({
        end_user: {
          id: 'user-789',
          email: 'user-789@app.local',
        },
        organization: {
          id: 'org-012',
        },
        allowed_integrations: undefined,
      });

      expect(result).toEqual({
        sessionToken: 'session-token-456',
        expiresAt: '2024-01-16T10:00:00Z',
      });
    });
  });

  describe('listIntegrations', () => {
    it('returns formatted list of integrations', async () => {
      const mockIntegrations = {
        configs: [
          { unique_key: 'slack', provider: 'slack' },
          { unique_key: 'github', provider: 'github' },
        ],
      };
      mockNangoClient.listIntegrations.mockResolvedValue(mockIntegrations as any);

      const result = await service.listIntegrations();

      expect(mockNangoClient.listIntegrations).toHaveBeenCalled();
      expect(result).toEqual([
        { id: 'slack', provider: 'slack' },
        { id: 'github', provider: 'github' },
      ]);
    });

    it('returns empty array when no integrations', async () => {
      mockNangoClient.listIntegrations.mockResolvedValue({ configs: [] } as any);

      const result = await service.listIntegrations();

      expect(result).toEqual([]);
    });
  });

  describe('getConnection', () => {
    it('returns connection when found', async () => {
      const mockConnection = {
        connection_id: 'conn-123',
        provider_config_key: 'slack',
        created_at: '2024-01-15T10:00:00Z',
      };
      mockNangoClient.getConnection.mockResolvedValue(mockConnection as any);

      const result = await service.getConnection('conn-123', 'slack');

      expect(mockNangoClient.getConnection).toHaveBeenCalledWith('slack', 'conn-123');
      expect(result).toEqual(mockConnection);
    });

    it('returns null when connection not found', async () => {
      mockNangoClient.getConnection.mockRejectedValue(new Error('Connection not found'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const result = await service.getConnection('invalid-conn', 'slack');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to get connection:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('deleteConnection', () => {
    it('deletes connection successfully', async () => {
      mockNangoClient.deleteConnection.mockResolvedValue({} as any);

      const result = await service.deleteConnection('conn-123', 'slack');

      expect(mockNangoClient.deleteConnection).toHaveBeenCalledWith('slack', 'conn-123');
      expect(result).toBe(true);
    });

    it('returns false when deletion fails', async () => {
      mockNangoClient.deleteConnection.mockRejectedValue(new Error('Deletion failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const result = await service.deleteConnection('conn-123', 'slack');

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to delete connection:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('does not call delete when providerConfigKey is missing', async () => {
      const result = await service.deleteConnection('conn-123');

      expect(mockNangoClient.deleteConnection).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('triggerSync', () => {
    it('triggers sync with custom sync name', async () => {
      const mockSyncResult = { sync_id: 'sync-123' };
      mockNangoClient.triggerSync.mockResolvedValue(mockSyncResult as any);

      const result = await service.triggerSync('conn-123', 'slack', 'custom-sync');

      expect(mockNangoClient.triggerSync).toHaveBeenCalledWith('slack', ['custom-sync'], 'conn-123');
      expect(result).toEqual(mockSyncResult);
    });

    it('triggers sync with default sync name', async () => {
      const mockSyncResult = { sync_id: 'sync-456' };
      mockNangoClient.triggerSync.mockResolvedValue(mockSyncResult as any);

      const result = await service.triggerSync('conn-123', 'github');

      expect(mockNangoClient.triggerSync).toHaveBeenCalledWith('github', ['default'], 'conn-123');
      expect(result).toEqual(mockSyncResult);
    });

    it('returns null when sync fails', async () => {
      mockNangoClient.triggerSync.mockRejectedValue(new Error('Sync failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const result = await service.triggerSync('conn-123', 'slack');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to trigger sync:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});