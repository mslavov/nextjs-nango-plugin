import { Nango } from '@nangohq/node';

export class NangoService {
  private client: Nango;

  constructor(secretKey: string, host?: string) {
    this.client = new Nango({
      secretKey,
      host: host || 'https://api.nango.dev'
    });
  }

  // Create a session for the Connect UI
  async createSession(userId: string, organizationId: string, integrationId?: string, userEmail?: string) {
    const allowedIntegrations = integrationId ? [integrationId] : undefined;

    const response = await this.client.createConnectSession({
      end_user: {
        id: userId,
        email: userEmail || `${userId}@app.local`,
      },
      organization: {
        id: organizationId,
      },
      allowed_integrations: allowedIntegrations,
    });

    return {
      sessionToken: response.data.token,
      expiresAt: response.data.expires_at,
    };
  }

  // List available integrations
  async listIntegrations() {
    const integrations = await this.client.listIntegrations();
    return integrations.configs.map((config: any) => ({
      id: config.unique_key,
      provider: config.provider,
      // Add any other relevant fields
    }));
  }

  // Get a specific connection
  async getConnection(connectionId: string, providerConfigKey: string) {
    try {
      const connection = await this.client.getConnection(providerConfigKey, connectionId);
      return connection;
    } catch (error) {
      console.error('Failed to get connection:', error);
      return null;
    }
  }

  // Delete a connection
  async deleteConnection(connectionId: string, providerConfigKey?: string) {
    try {
      // The Nango API requires both connectionId and providerConfigKey
      if (providerConfigKey) {
        await this.client.deleteConnection(providerConfigKey, connectionId);
      }
      return true;
    } catch (error) {
      console.error('Failed to delete connection:', error);
      return false;
    }
  }

  // Trigger a sync
  async triggerSync(connectionId: string, providerConfigKey: string, syncName?: string) {
    try {
      const result = await this.client.triggerSync(
        providerConfigKey,
        [syncName || 'default'],
        connectionId
      );
      return result;
    } catch (error) {
      console.error('Failed to trigger sync:', error);
      return null;
    }
  }
}