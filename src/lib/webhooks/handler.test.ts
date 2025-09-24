import { handleWebhook } from './handler';
import type { ConnectionService } from '../types/connection-service';
import type { SecretsService } from '../types/secrets-service';
import crypto from 'crypto';

describe('handleWebhook', () => {
  let mockConnectionService: jest.Mocked<ConnectionService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnectionService = {
      getConnections: jest.fn(),
      createConnection: jest.fn(),
      deleteConnection: jest.fn(),
      updateConnectionStatus: jest.fn(),
      getConnection: jest.fn(),
    };
  });

  describe('webhook processing', () => {
    it('handles auth creation success event', async () => {
      const event = {
        type: 'auth',
        operation: 'creation',
        success: true,
        connectionId: 'conn-123',
        providerConfigKey: 'slack-prod',
        provider: 'slack',
        endUser: {
          endUserId: 'user-123',
          organizationId: 'org-456'
        },
        environment: 'production',
      };

      mockConnectionService.getConnection.mockResolvedValue(null);

      const result = await handleWebhook(
        JSON.stringify(event),
        null,
        mockConnectionService,
        null
      );

      expect(mockConnectionService.getConnection).toHaveBeenCalledWith('conn-123');
      expect(mockConnectionService.createConnection).toHaveBeenCalledWith(
        'slack-prod',
        'conn-123',
        'user-123',
        'org-456',
        {
          environment: 'production'
        }
      );
      expect(result).toEqual({ success: true, eventType: 'auth', operation: 'creation' });
    });

    it('handles auth creation success when connection exists', async () => {
      const event = {
        type: 'auth',
        operation: 'creation',
        success: true,
        connectionId: 'conn-existing',
        providerConfigKey: 'github-prod',
        provider: 'github',
        endUser: {
          endUserId: 'user-123'
        }
      };

      mockConnectionService.getConnection.mockResolvedValue({
        id: 'db-id',
        owner_id: 'user-123',
        connection_id: 'conn-existing',
        provider: 'github-prod',
        status: 'INACTIVE',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      });

      const result = await handleWebhook(
        JSON.stringify(event),
        null,
        mockConnectionService,
        null
      );

      expect(mockConnectionService.getConnection).toHaveBeenCalledWith('conn-existing');
      expect(mockConnectionService.createConnection).not.toHaveBeenCalled();
      expect(mockConnectionService.updateConnectionStatus).toHaveBeenCalledWith('conn-existing', 'ACTIVE');
      expect(result).toEqual({ success: true, eventType: 'auth', operation: 'creation' });
    });

    it('skips creation when no owner_id is provided', async () => {
      const event = {
        type: 'auth',
        operation: 'creation',
        success: true,
        connectionId: 'conn-no-owner',
        providerConfigKey: 'slack-prod',
        provider: 'slack',
        // No endUser data
      };

      mockConnectionService.getConnection.mockResolvedValue(null);

      const result = await handleWebhook(
        JSON.stringify(event),
        null,
        mockConnectionService,
        null
      );

      expect(mockConnectionService.createConnection).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true, eventType: 'auth', operation: 'creation' });
    });

    it('handles auth failure event', async () => {
      const event = {
        type: 'auth',
        operation: 'creation',
        success: false,
        connectionId: 'conn-456',
        providerConfigKey: 'github-prod',
        provider: 'github',
        error: {
          message: 'Authentication failed',
          type: 'AUTH_FAILED',
        },
      };

      const result = await handleWebhook(
        JSON.stringify(event),
        null,
        mockConnectionService,
        null
      );

      expect(mockConnectionService.updateConnectionStatus).toHaveBeenCalledWith('conn-456', 'ERROR');
      expect(result).toEqual({ success: true, eventType: 'auth', operation: 'creation' });
    });

    it('handles connection.deleted event', async () => {
      const event = {
        type: 'connection.deleted',
        connectionId: 'conn-789',
        providerConfigKey: 'google_drive-prod',
        provider: 'google_drive',
      };

      const result = await handleWebhook(
        JSON.stringify(event),
        null,
        mockConnectionService,
        null
      );

      expect(mockConnectionService.updateConnectionStatus).toHaveBeenCalledWith('conn-789', 'INACTIVE');
      expect(result).toEqual({ success: true, eventType: 'connection.deleted', operation: undefined });
    });

    it('handles sync success event', async () => {
      const event = {
        type: 'sync',
        success: true,
        connectionId: 'conn-111',
        providerConfigKey: 'salesforce-prod',
        provider: 'salesforce',
        syncJobId: 'sync-job-123',
      };

      const result = await handleWebhook(
        JSON.stringify(event),
        null,
        mockConnectionService,
        null
      );

      expect(mockConnectionService.updateConnectionStatus).toHaveBeenCalledWith('conn-111', 'ACTIVE');
      expect(result).toEqual({ success: true, eventType: 'sync', operation: undefined });
    });

    it('handles sync error event', async () => {
      const event = {
        type: 'sync',
        success: false,
        connectionId: 'conn-222',
        providerConfigKey: 'hubspot-prod',
        provider: 'hubspot',
        syncJobId: 'sync-job-456',
        error: {
          message: 'Sync failed',
          type: 'SYNC_FAILED',
        },
      };

      const result = await handleWebhook(
        JSON.stringify(event),
        null,
        mockConnectionService,
        null
      );

      expect(mockConnectionService.updateConnectionStatus).toHaveBeenCalledWith('conn-222', 'ERROR');
      expect(result).toEqual({ success: true, eventType: 'sync', operation: undefined });
    });
  });

  describe('webhook signature verification', () => {
    const webhookSecret = 'test-secret';

    it('verifies valid signature', async () => {
      const event = {
        type: 'auth',
        operation: 'creation',
        success: true,
        connectionId: 'conn-333',
        providerConfigKey: 'slack-prod',
        provider: 'slack',
        endUser: {
          endUserId: 'user-333'
        }
      };
      const body = JSON.stringify(event);
      const signature = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');

      mockConnectionService.getConnection.mockResolvedValue(null);

      const result = await handleWebhook(body, signature, mockConnectionService, webhookSecret);

      expect(mockConnectionService.createConnection).toHaveBeenCalledWith(
        'slack-prod',
        'conn-333',
        'user-333',
        undefined,
        {}
      );
      expect(result).toEqual({ success: true, eventType: 'auth', operation: 'creation' });
    });

    it('rejects invalid signature', async () => {
      const event = {
        type: 'auth',
        operation: 'creation',
        success: true,
        connectionId: 'conn-444',
        providerConfigKey: 'slack-prod',
        provider: 'slack',
      };
      const body = JSON.stringify(event);
      // Invalid signature should be same length as valid hex signature
      const invalidSignature = '0'.repeat(64); // Same length as SHA256 hex

      await expect(
        handleWebhook(body, invalidSignature, mockConnectionService, webhookSecret)
      ).rejects.toThrow('Invalid webhook signature');

      expect(mockConnectionService.updateConnectionStatus).not.toHaveBeenCalled();
    });

    it('rejects missing signature when secret is configured', async () => {
      const event = {
        type: 'auth',
        operation: 'creation',
        success: true,
        connectionId: 'conn-555',
        providerConfigKey: 'slack-prod',
        provider: 'slack',
      };
      const body = JSON.stringify(event);

      await expect(
        handleWebhook(body, null, mockConnectionService, webhookSecret)
      ).rejects.toThrow('Invalid webhook signature');

      expect(mockConnectionService.updateConnectionStatus).not.toHaveBeenCalled();
    });

    it('processes without verification when secret is not configured', async () => {
      const event = {
        type: 'auth',
        operation: 'creation',
        success: true,
        connectionId: 'conn-666',
        providerConfigKey: 'slack-prod',
        provider: 'slack',
        endUser: {
          endUserId: 'user-666'
        }
      };
      const body = JSON.stringify(event);

      mockConnectionService.getConnection.mockResolvedValue(null);

      const result = await handleWebhook(body, null, mockConnectionService, null);

      expect(mockConnectionService.createConnection).toHaveBeenCalledWith(
        'slack-prod',
        'conn-666',
        'user-666',
        undefined,
        {}
      );
      expect(result).toEqual({ success: true, eventType: 'auth', operation: 'creation' });
    });
  });

  describe('error handling', () => {
    it('throws error for invalid JSON', async () => {
      const invalidBody = 'not valid json';

      await expect(
        handleWebhook(invalidBody, null, mockConnectionService, null)
      ).rejects.toThrow();

      expect(mockConnectionService.updateConnectionStatus).not.toHaveBeenCalled();
    });

    it('throws error for invalid event schema', async () => {
      const invalidEvent = {
        invalidField: 'test',
      };
      const body = JSON.stringify(invalidEvent);

      await expect(
        handleWebhook(body, null, mockConnectionService, null)
      ).rejects.toThrow();

      expect(mockConnectionService.updateConnectionStatus).not.toHaveBeenCalled();
    });

    it('throws error for invalid event type', async () => {
      const invalidEvent = {
        type: 'invalid.type',
        connectionId: 'conn-123',
        providerConfigKey: 'slack-prod',
        provider: 'slack',
        connectionId: 'conn-777',
        data: {},
      };
      const body = JSON.stringify(invalidEvent);

      await expect(
        handleWebhook(body, null, mockConnectionService, null)
      ).rejects.toThrow();

      expect(mockConnectionService.updateConnectionStatus).not.toHaveBeenCalled();
    });

    it('logs service errors but continues processing', async () => {
      const event = {
        type: 'auth',
        operation: 'creation',
        success: true,
        connectionId: 'conn-888',
        providerConfigKey: 'slack-prod',
        provider: 'slack',
        endUser: {
          endUserId: 'user-888'
        }
      };
      const body = JSON.stringify(event);

      mockConnectionService.getConnection.mockResolvedValue(null);
      mockConnectionService.createConnection.mockRejectedValue(
        new Error('Database error')
      );
      mockConnectionService.updateConnectionStatus.mockRejectedValue(
        new Error('Database error')
      );

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // Should NOT throw, but continue processing
      const result = await handleWebhook(body, null, mockConnectionService, null);

      expect(result).toEqual({ success: true, eventType: 'auth', operation: 'creation' });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Failed to create connection conn-888:',
        expect.any(Error)
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to update connection conn-888:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });
  });
});

describe('handleWebhook with optional services', () => {
  let mockSecretsService: jest.Mocked<SecretsService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSecretsService = {
      storeSecret: jest.fn(),
      getSecret: jest.fn(),
      updateSecret: jest.fn(),
      deleteSecret: jest.fn(),
    } as any;
  });

  describe('without ConnectionService', () => {
    it('processes auth event without storing connection', async () => {
      const event = {
        type: 'auth',
        operation: 'creation',
        success: true,
        connectionId: 'conn-999',
        providerConfigKey: 'slack-prod',
        provider: 'slack',
        endUser: {
          endUserId: 'user-999'
        }
      };

      const result = await handleWebhook(
        JSON.stringify(event),
        null,
        null, // No ConnectionService
        null
      );

      expect(result).toEqual({ success: true, eventType: 'auth', operation: 'creation' });
    });

    it('processes sync event without updating status', async () => {
      const event = {
        type: 'sync',
        success: true,
        connectionId: 'conn-1000',
        providerConfigKey: 'github-prod',
        provider: 'github',
      };

      const result = await handleWebhook(
        JSON.stringify(event),
        null,
        null, // No ConnectionService
        null
      );

      expect(result).toEqual({ success: true, eventType: 'sync', operation: undefined });
    });

    it('processes connection.deleted event without updating', async () => {
      const event = {
        type: 'connection.deleted',
        connectionId: 'conn-1001',
        providerConfigKey: 'notion-prod',
        provider: 'notion',
      };

      const result = await handleWebhook(
        JSON.stringify(event),
        null,
        null, // No ConnectionService
        null
      );

      expect(result).toEqual({ success: true, eventType: 'connection.deleted', operation: undefined });
    });
  });

  describe('with SecretsService', () => {
    it('stores credentials on auth success when provided', async () => {
      const event = {
        type: 'auth',
        operation: 'creation',
        success: true,
        connectionId: 'conn-2000',
        providerConfigKey: 'slack-prod',
        provider: 'slack',
        endUser: {
          endUserId: 'user-2000',
          organizationId: 'org-2000'
        },
        data: {
          credentials: {
            type: 'OAUTH2',
            access_token: 'token-abc',
            refresh_token: 'refresh-xyz',
            expires_at: '2025-01-01T00:00:00Z'
          }
        }
      };

      const result = await handleWebhook(
        JSON.stringify(event),
        null,
        null, // No ConnectionService
        null,
        mockSecretsService
      );

      expect(mockSecretsService.storeSecret).toHaveBeenCalledWith(
        'conn-2000',
        'slack',
        {
          type: 'OAUTH2',
          access_token: 'token-abc',
          refresh_token: 'refresh-xyz',
          expires_at: '2025-01-01T00:00:00Z'
        },
        'user-2000',
        'org-2000'
      );
      expect(result).toEqual({ success: true, eventType: 'auth', operation: 'creation' });
    });

    it('deletes secret on connection deletion', async () => {
      const event = {
        type: 'connection.deleted',
        connectionId: 'conn-2001',
        providerConfigKey: 'github-prod',
        provider: 'github',
      };

      mockSecretsService.deleteSecret.mockResolvedValue(true);

      const result = await handleWebhook(
        JSON.stringify(event),
        null,
        null, // No ConnectionService
        null,
        mockSecretsService
      );

      expect(mockSecretsService.deleteSecret).toHaveBeenCalledWith('conn-2001');
      expect(result).toEqual({ success: true, eventType: 'connection.deleted', operation: undefined });
    });

    it('handles secret storage failure gracefully', async () => {
      const event = {
        type: 'auth',
        operation: 'creation',
        success: true,
        connectionId: 'conn-2002',
        providerConfigKey: 'slack-prod',
        provider: 'slack',
        endUser: {
          endUserId: 'user-2002'
        },
        data: {
          credentials: {
            type: 'OAUTH2',
            access_token: 'token-fail'
          }
        }
      };

      mockSecretsService.storeSecret.mockRejectedValue(new Error('Storage failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await handleWebhook(
        JSON.stringify(event),
        null,
        null,
        null,
        mockSecretsService
      );

      expect(consoleSpy).toHaveBeenCalledWith('Failed to store credentials:', expect.any(Error));
      expect(result).toEqual({ success: true, eventType: 'auth', operation: 'creation' });

      consoleSpy.mockRestore();
    });
  });

  describe('with both services', () => {
    let mockConnectionService: jest.Mocked<ConnectionService>;

    beforeEach(() => {
      mockConnectionService = {
        getConnections: jest.fn(),
        createConnection: jest.fn(),
        deleteConnection: jest.fn(),
        updateConnectionStatus: jest.fn(),
        getConnection: jest.fn(),
      };
    });

    it('updates both connection and secrets on auth success', async () => {
      const event = {
        type: 'auth',
        operation: 'creation',
        success: true,
        connectionId: 'conn-3000',
        providerConfigKey: 'slack-prod',
        provider: 'slack',
        endUser: {
          endUserId: 'user-3000',
          organizationId: 'org-3000'
        },
        environment: 'production',
        data: {
          credentials: {
            type: 'OAUTH2',
            access_token: 'token-3000'
          }
        }
      };

      mockConnectionService.getConnection.mockResolvedValue(null);

      const result = await handleWebhook(
        JSON.stringify(event),
        null,
        mockConnectionService,
        null,
        mockSecretsService
      );

      expect(mockConnectionService.createConnection).toHaveBeenCalledWith(
        'slack-prod',
        'conn-3000',
        'user-3000',
        'org-3000',
        { environment: 'production' }
      );
      expect(mockSecretsService.storeSecret).toHaveBeenCalledWith(
        'conn-3000',
        'slack',
        { type: 'OAUTH2', access_token: 'token-3000' },
        'user-3000',
        'org-3000'
      );
      expect(result).toEqual({ success: true, eventType: 'auth', operation: 'creation' });
    });

    it('deletes both connection and secret on deletion', async () => {
      const event = {
        type: 'connection.deleted',
        connectionId: 'conn-3001',
        providerConfigKey: 'github-prod',
        provider: 'github',
      };

      mockConnectionService.updateConnectionStatus.mockResolvedValue({} as any);
      mockSecretsService.deleteSecret.mockResolvedValue(true);

      const result = await handleWebhook(
        JSON.stringify(event),
        null,
        mockConnectionService,
        null,
        mockSecretsService
      );

      expect(mockConnectionService.updateConnectionStatus).toHaveBeenCalledWith('conn-3001', 'INACTIVE');
      expect(mockSecretsService.deleteSecret).toHaveBeenCalledWith('conn-3001');
      expect(result).toEqual({ success: true, eventType: 'connection.deleted', operation: undefined });
    });
  });
});