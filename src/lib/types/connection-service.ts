
// Generic connection type - no hard dependencies on user/org structure
export interface Connection {
  id: string;
  provider: string; // Flexible - depends on Nango configuration
  connection_id: string;
  owner_id: string; // Generic owner - could be user, team, org, etc.
  secondary_owner_id?: string; // Optional secondary owner
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'EXPIRED';
  metadata?: Record<string, any>;
  last_sync_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ConnectionService {
  // Get connections for the current context (user/team/org determined by implementation)
  getConnections(): Promise<Connection[]>;

  // Create a connection for the current context
  createConnection(
    provider: string,
    connectionId: string,
    metadata?: Record<string, any>
  ): Promise<Connection>;

  // Update connection status (implementation ensures ownership)
  updateConnectionStatus(
    connectionId: string,
    status: Connection['status']
  ): Promise<Connection>;

  // Update last sync timestamp (implementation ensures ownership)
  updateLastSync(connectionId: string): Promise<Connection>;

  // Delete a connection (implementation ensures ownership)
  deleteConnection(connectionId: string): Promise<boolean>;
}