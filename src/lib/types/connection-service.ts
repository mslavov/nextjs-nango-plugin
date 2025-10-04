
/**
 * Represents a connection between your application and an external service via Nango.
 * This interface explicitly defines ownership to ensure proper access control.
 */
export interface Connection {
  /** Unique identifier for the connection in your database */
  id: string;

  /** The owner identifier - typically user ID, required for all connections */
  owner_id: string;

  /** Optional organization/team identifier for multi-tenant scenarios */
  organization_id?: string;

  /** The provider config key (unique integration identifier from Nango, e.g., 'github-prod', 'slack-dev', 'salesforce') */
  provider: string;

  /** The connection ID used in Nango - a unique identifier for this connection */
  connection_id: string;

  /** Current status of the connection */
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'EXPIRED';

  /**
   * Flexible metadata storage for any additional information.
   * Common uses:
   * - Connection configuration
   * - Custom application data
   * - Scopes or permissions
   * - Environment information
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
   * @param filters - Optional filters to query specific connections.
   *                  Can filter by ownership fields or metadata.
   *                  Common filters:
   *                  - { owner_id: 'user123' } - Get connections for a specific user
   *                  - { organization_id: 'org456' } - Get connections for an organization
   *                  - { provider: 'github' } - Get GitHub connections
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
   * // Get organization connections for a specific provider
   * const orgGithubConnections = await service.getConnections({
   *   organization_id: 'org456',
   *   provider: 'github'
   * });
   */
  getConnections(filters?: Record<string, any>): Promise<Connection[]>;

  /**
   * Creates a new connection record in your database.
   * Ownership is explicitly required to ensure proper access control.
   *
   * @param provider - The provider config key (unique integration identifier from Nango)
   * @param connectionId - Unique identifier for this connection in Nango
   * @param ownerId - The owner identifier (typically user ID)
   * @param organizationId - Optional organization/team identifier
   * @param metadata - Additional metadata to store with the connection.
   *                   Can include custom data like environment, scopes, etc.
   *
   * @returns The created connection record
   *
   * @example
   * const connection = await service.createConnection(
   *   'github-prod',
   *   'conn_abc123',
   *   'user123',
   *   'org456',  // optional
   *   {
   *     scopes: ['repo', 'user'],
   *     environment: 'production'
   *   }
   * );
   */
  createConnection(
    provider: string,
    connectionId: string,
    ownerId: string,
    organizationId?: string,
    metadata?: Record<string, any>
  ): Promise<Connection>;

  /**
   * Retrieves a single connection by its ID.
   * Implementation should verify ownership before returning.
   *
   * @param connectionId - The connection ID to retrieve
   * @returns The connection if found and owned by the requester, null otherwise
   */
  getConnection?(connectionId: string): Promise<Connection | null>;

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
   * Updates connection metadata and other fields.
   * Implementation should verify ownership before updating.
   *
   * @param connectionId - The connection ID to update
   * @param updates - Partial connection updates (e.g., metadata)
   * @returns The updated connection record
   * @throws Error if connection not found or ownership validation fails
   */
  updateConnection?(
    connectionId: string,
    updates: Partial<Pick<Connection, 'metadata'>>
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