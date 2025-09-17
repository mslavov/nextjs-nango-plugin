
/**
 * Represents a connection between your application and an external service via Nango.
 * This interface is generic and flexible to support various ownership models.
 */
export interface Connection {
  /** Unique identifier for the connection in your database */
  id: string;

  /** The provider/integration name (e.g., 'github', 'slack', 'salesforce') - must match Nango configuration */
  provider: string;

  /** The connection ID used in Nango - a unique identifier for this connection */
  connection_id: string;

  /** Current status of the connection */
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'EXPIRED';

  /**
   * Flexible metadata storage for any additional information.
   * Common uses:
   * - Ownership details (user_id, team_id, org_id)
   * - Connection configuration
   * - Custom application data
   * - Scopes or permissions
   */
  metadata?: Record<string, any>;

  /** ISO timestamp when the connection was created */
  created_at: string;

  /** ISO timestamp when the connection was last updated */
  updated_at: string;
}

/**
 * Service interface for managing Nango connections in your application.
 * Implementations should handle database operations and ownership validation.
 */
export interface ConnectionService {
  /**
   * Retrieves connections based on the current context and optional filters.
   *
   * @param metadata - Optional metadata filters to query specific connections.
   *                   Only connections with ALL matching metadata fields will be returned.
   *                   Common filters:
   *                   - { owner_id: 'user123' } - Get connections for a specific user
   *                   - { team_id: 'team456' } - Get connections for a team
   *                   - { owner_id: 'user123', provider: 'github' } - User's GitHub connections
   *
   * @returns Array of connections matching the criteria
   *
   * @example
   * // Get all connections for the current context
   * const allConnections = await service.getConnections();
   *
   * @example
   * // Get connections for a specific user
   * const userConnections = await service.getConnections({ owner_id: 'user123' });
   *
   * @example
   * // Get team connections for a specific provider
   * const teamGithubConnections = await service.getConnections({
   *   team_id: 'team456',
   *   provider: 'github'
   * });
   */
  getConnections(metadata?: Record<string, any>): Promise<Connection[]>;

  /**
   * Creates a new connection record in your database.
   * The implementation should determine ownership from the request context.
   *
   * @param provider - The provider/integration name (must match Nango configuration)
   * @param connectionId - Unique identifier for this connection (typically owner_id)
   * @param metadata - Additional metadata to store with the connection.
   *                   Should include ownership information (owner_id, team_id, etc.)
   *                   and any custom data needed by your application.
   *
   * @returns The created connection record
   *
   * @example
   * const connection = await service.createConnection(
   *   'github',
   *   'user123',
   *   {
   *     owner_id: 'user123',
   *     team_id: 'team456',
   *     scopes: ['repo', 'user'],
   *     environment: 'production'
   *   }
   * );
   */
  createConnection(
    provider: string,
    connectionId: string,
    metadata?: Record<string, any>
  ): Promise<Connection>;

  /**
   * Updates the status of an existing connection.
   * Implementation should verify ownership before updating.
   *
   * @param connectionId - The connection ID to update
   * @param status - New status value
   * @returns The updated connection record
   * @throws Error if connection not found or ownership validation fails
   */
  updateConnectionStatus(
    connectionId: string,
    status: Connection['status']
  ): Promise<Connection>;

  /**
   * Deletes a connection from your database.
   * Implementation should verify ownership before deletion.
   * Note: This doesn't automatically delete the connection from Nango.
   *
   * @param connectionId - The connection ID to delete
   * @returns true if deleted successfully, false if not found
   * @throws Error if ownership validation fails
   */
  deleteConnection(connectionId: string): Promise<boolean>;
}