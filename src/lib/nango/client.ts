import { Nango } from '@nangohq/node';

export interface NangoSessionData {
  end_user: {
    id: string;
    email?: string;
    display_name?: string;
  };
  organization?: {
    id: string;
    display_name?: string;
  };
  allowed_integrations?: string[];
}

export class NangoService {
  private client: Nango;

  constructor(secretKey: string, host?: string) {
    this.client = new Nango({
      secretKey,
      host: host || 'https://api.nango.dev'
    });
  }

  // Create a session for the Connect UI - matches Nango's API signature
  async createSession(sessionData: NangoSessionData) {
    const response = await this.client.createConnectSession(sessionData);

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
      displayName: config.displayName
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
}