import { createNangoHandler, type NangoPluginConfig, type ConnectionService, type Connection } from 'nextjs-nango-plugin';

/**
 * Example ConnectionService implementation using in-memory storage
 *
 * WARNING: This is for demonstration purposes only!
 * In production, implement this with your actual database.
 */

// In-memory storage (will reset on server restart)
const connections = new Map<string, Connection>();

class InMemoryConnectionService implements ConnectionService {
  constructor(private userId: string, private organizationId?: string) {}

  async getConnections(filters?: Record<string, any>): Promise<Connection[]> {
    const userConnections: Connection[] = [];
    for (const conn of connections.values()) {
      // Check ownership
      if (conn.owner_id === this.userId) {
        // Apply additional filters if provided
        if (filters) {
          let matches = true;
          for (const [key, value] of Object.entries(filters)) {
            if ((conn as any)[key] !== value) {
              matches = false;
              break;
            }
          }
          if (!matches) continue;
        }
        userConnections.push(conn);
      }
    }
    return userConnections;
  }

  async createConnection(
    provider: string,
    connectionId: string,
    ownerId: string,
    organizationId?: string,
    metadata?: Record<string, any>
  ): Promise<Connection> {
    const id = `conn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const connection: Connection = {
      id,
      owner_id: ownerId,
      organization_id: organizationId,
      provider,
      connection_id: connectionId,
      status: 'ACTIVE',
      metadata,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    connections.set(id, connection);
    return connection;
  }

  async updateConnectionStatus(
    connectionId: string,
    status: Connection['status']
  ): Promise<Connection> {
    for (const conn of connections.values()) {
      if (conn.connection_id === connectionId && conn.owner_id === this.userId) {
        conn.status = status;
        conn.updated_at = new Date().toISOString();
        return conn;
      }
    }
    throw new Error('Connection not found');
  }


  async deleteConnection(connectionId: string): Promise<boolean> {
    for (const [id, conn] of connections.entries()) {
      if (conn.connection_id === connectionId && conn.owner_id === this.userId) {
        connections.delete(id);
        return true;
      }
    }
    return false;
  }
}

/**
 * Nango Plugin Configuration
 *
 * IMPORTANT: You must implement the ConnectionService factory below.
 * This factory should return an instance of your ConnectionService implementation.
 */
export const nangoConfig: NangoPluginConfig = {
  // Factory for creating ConnectionService instances
  createConnectionService: async (request?: any) => {
    // This example uses in-memory storage for demonstration
    // In production, replace this with your actual database implementation

    console.log('⚠️  Using in-memory ConnectionService - for demo only!');
    console.log('   In production, implement with your actual database.');

    // Extract user ID from request (in a real app, this would come from your auth system)
    // For demo, we'll use a hardcoded user ID that matches the one in integrations/page.tsx
    const userId = 'user-123'; // In production, get this from cookies/JWT/session
    const organizationId = undefined; // Optional: get from your auth system if using multi-tenancy

    return new InMemoryConnectionService(userId, organizationId);
  },

  // Nango configuration
  nango: {
    secretKey: process.env.NANGO_SECRET_KEY!,
    host: process.env.NANGO_HOST || 'https://api.nango.dev',
    webhookSecret: process.env.NANGO_WEBHOOK_SECRET,
  },

  // Optional: limit providers (uncomment and edit if needed)
  // providers: ['github', 'gitlab', 'slack', 'notion'],
};

// Export the handler for use in the route file
export const nangoHandler = createNangoHandler(nangoConfig);
