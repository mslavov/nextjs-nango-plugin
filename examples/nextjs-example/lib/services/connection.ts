import type { ConnectionService, Connection } from 'nextjs-nango-plugin';

/**
 * Example ConnectionService implementation using in-memory storage
 *
 * WARNING: This is for demonstration purposes only!
 * In production, implement this with your actual database.
 */

// In-memory storage (will reset on server restart)
const connections = new Map<string, Connection>();

export class InMemoryConnectionService implements ConnectionService {
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

  async getConnection(connectionId: string): Promise<Connection | null> {
    for (const conn of connections.values()) {
      if (conn.connection_id === connectionId && conn.owner_id === this.userId) {
        return conn;
      }
    }
    return null;
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