import { handleWebhook } from './handler';
import type { ConnectionService } from '../types/connection-service';
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
    };
  });

  describe('webhook processing', () => {
    it('handles auth.success event', async () => {
      const event = {
        provider: 'slack',
        type: 'auth.success',
        connectionId: 'conn-123',
        data: {},
      };

      const result = await handleWebhook(
        JSON.stringify(event),
        null,
        mockConnectionService,
        null
      );

      expect(mockConnectionService.updateConnectionStatus).toHaveBeenCalledWith('conn-123', 'ACTIVE');
      expect(result).toEqual({ success: true, eventType: 'auth.success' });
    });

    it('handles auth.error event', async () => {
      const event = {
        provider: 'github',
        type: 'auth.error',
        connectionId: 'conn-456',
        data: {},
        error: {
          message: 'Authentication failed',
          code: 'AUTH_FAILED',
        },
      };

      const result = await handleWebhook(
        JSON.stringify(event),
        null,
        mockConnectionService,
        null
      );

      expect(mockConnectionService.updateConnectionStatus).toHaveBeenCalledWith('conn-456', 'ERROR');
      expect(result).toEqual({ success: true, eventType: 'auth.error' });
    });

    it('handles connection.deleted event', async () => {
      const event = {
        provider: 'google_drive',
        type: 'connection.deleted',
        connectionId: 'conn-789',
        data: {},
      };

      const result = await handleWebhook(
        JSON.stringify(event),
        null,
        mockConnectionService,
        null
      );

      expect(mockConnectionService.updateConnectionStatus).toHaveBeenCalledWith('conn-789', 'INACTIVE');
      expect(result).toEqual({ success: true, eventType: 'connection.deleted' });
    });

    it('handles sync.success event', async () => {
      const event = {
        provider: 'salesforce',
        type: 'sync.success',
        connectionId: 'conn-111',
        syncJobId: 'sync-job-123',
        data: {},
      };

      const result = await handleWebhook(
        JSON.stringify(event),
        null,
        mockConnectionService,
        null
      );

      expect(mockConnectionService.updateConnectionStatus).toHaveBeenCalledWith('conn-111', 'ACTIVE');
      expect(result).toEqual({ success: true, eventType: 'sync.success' });
    });

    it('handles sync.error event', async () => {
      const event = {
        provider: 'hubspot',
        type: 'sync.error',
        connectionId: 'conn-222',
        syncJobId: 'sync-job-456',
        data: {},
        error: {
          message: 'Sync failed',
          code: 'SYNC_FAILED',
        },
      };

      const result = await handleWebhook(
        JSON.stringify(event),
        null,
        mockConnectionService,
        null
      );

      expect(mockConnectionService.updateConnectionStatus).toHaveBeenCalledWith('conn-222', 'ERROR');
      expect(result).toEqual({ success: true, eventType: 'sync.error' });
    });
  });

  describe('webhook signature verification', () => {
    const webhookSecret = 'test-secret';

    it('verifies valid signature', async () => {
      const event = {
        provider: 'slack',
        type: 'auth.success',
        connectionId: 'conn-333',
        data: {},
      };
      const body = JSON.stringify(event);
      const signature = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');

      const result = await handleWebhook(body, signature, mockConnectionService, webhookSecret);

      expect(mockConnectionService.updateConnectionStatus).toHaveBeenCalledWith('conn-333', 'ACTIVE');
      expect(result).toEqual({ success: true, eventType: 'auth.success' });
    });

    it('rejects invalid signature', async () => {
      const event = {
        provider: 'slack',
        type: 'auth.success',
        connectionId: 'conn-444',
        data: {},
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
        provider: 'slack',
        type: 'auth.success',
        connectionId: 'conn-555',
        data: {},
      };
      const body = JSON.stringify(event);

      await expect(
        handleWebhook(body, null, mockConnectionService, webhookSecret)
      ).rejects.toThrow('Invalid webhook signature');

      expect(mockConnectionService.updateConnectionStatus).not.toHaveBeenCalled();
    });

    it('processes without verification when secret is not configured', async () => {
      const event = {
        provider: 'slack',
        type: 'auth.success',
        connectionId: 'conn-666',
        data: {},
      };
      const body = JSON.stringify(event);

      const result = await handleWebhook(body, null, mockConnectionService, null);

      expect(mockConnectionService.updateConnectionStatus).toHaveBeenCalledWith('conn-666', 'ACTIVE');
      expect(result).toEqual({ success: true, eventType: 'auth.success' });
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
        provider: 'slack',
        type: 'invalid.type',
        connectionId: 'conn-777',
        data: {},
      };
      const body = JSON.stringify(invalidEvent);

      await expect(
        handleWebhook(body, null, mockConnectionService, null)
      ).rejects.toThrow();

      expect(mockConnectionService.updateConnectionStatus).not.toHaveBeenCalled();
    });

    it('logs and re-throws service errors', async () => {
      const event = {
        provider: 'slack',
        type: 'auth.success',
        connectionId: 'conn-888',
        data: {},
      };
      const body = JSON.stringify(event);

      mockConnectionService.updateConnectionStatus.mockRejectedValue(
        new Error('Database error')
      );

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(
        handleWebhook(body, null, mockConnectionService, null)
      ).rejects.toThrow('Database error');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Webhook processing failed:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});