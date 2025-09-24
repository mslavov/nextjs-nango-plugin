/**
 * Secrets Service Interface
 *
 * Optional service for managing OAuth credentials and API keys.
 * When implemented, this service can securely store credentials locally
 * for faster access and offline capabilities. When not implemented,
 * credentials are fetched from Nango's API on demand.
 *
 * SECURITY NOTICE: Implementations MUST handle credentials securely:
 * - Always encrypt sensitive data at rest
 * - Never log credentials
 * - Use secure comparison for tokens
 * - Implement proper access controls
 * - Consider using key management services in production
 */

/**
 * Represents authentication credentials for a connection.
 * Supports various authentication types used by different providers.
 */
export interface Credentials {
  /** The type of authentication used */
  type: 'OAUTH2' | 'OAUTH1' | 'API_KEY' | 'BASIC' | 'CUSTOM';

  /** OAuth2/OAuth1 access token */
  access_token?: string;

  /** OAuth2 refresh token for token renewal */
  refresh_token?: string;

  /** Token expiration time (ISO string) */
  expires_at?: string;

  /** API key for API_KEY auth type */
  api_key?: string;

  /** Username for BASIC auth */
  username?: string;

  /** Password for BASIC auth (should be encrypted) */
  password?: string;

  /** Additional provider-specific credentials */
  raw?: Record<string, any>;
}

/**
 * Represents a stored connection secret with ownership information.
 * Links credentials to a specific connection and owner.
 */
export interface ConnectionSecret {
  /** The connection ID this secret belongs to */
  connection_id: string;

  /** The provider key (e.g., 'github', 'slack') */
  provider: string;

  /** Owner identifier (user ID) */
  owner_id: string;

  /** Optional organization identifier for multi-tenant scenarios */
  organization_id?: string;

  /** The actual credentials (should be encrypted at rest) */
  credentials: Credentials;

  /** Additional metadata about the secret */
  metadata?: Record<string, any>;

  /** ISO timestamp when the secret was created */
  created_at: string;

  /** ISO timestamp when the secret was last updated */
  updated_at: string;

  /** ISO timestamp when the credentials were last refreshed */
  last_refreshed_at?: string;
}

/**
 * Service interface for managing connection secrets and credentials.
 *
 * Implementing this service allows you to:
 * - Store credentials locally with encryption
 * - Reduce API calls for credential retrieval
 * - Implement custom refresh strategies
 * - Add audit logging for credential access
 * - Support offline scenarios
 *
 * When not implemented, the plugin will fetch credentials
 * from Nango's API each time they're needed.
 *
 * IMPORTANT: Implementations MUST prioritize security.
 * See the example implementations for encryption patterns.
 */
export interface SecretsService {
  /**
   * Store credentials for a connection.
   * Called after successful OAuth flow or API key configuration.
   *
   * @param connectionId - The connection ID
   * @param provider - The provider key
   * @param credentials - The credentials to store (should be encrypted)
   * @param ownerId - The owner identifier
   * @param organizationId - Optional organization identifier
   * @returns The stored secret record
   *
   * @example
   * const secret = await service.storeSecret(
   *   'conn_123',
   *   'github',
   *   {
   *     type: 'OAUTH2',
   *     access_token: 'gho_xxx',
   *     refresh_token: 'ghr_xxx',
   *     expires_at: '2024-12-31T00:00:00Z'
   *   },
   *   'user_456',
   *   'org_789'
   * );
   */
  storeSecret(
    connectionId: string,
    provider: string,
    credentials: Credentials,
    ownerId: string,
    organizationId?: string
  ): Promise<ConnectionSecret>;

  /**
   * Retrieve credentials for a connection.
   * Should verify ownership before returning credentials.
   *
   * @param connectionId - The connection ID
   * @returns The secret if found and authorized, null otherwise
   *
   * @example
   * const secret = await service.getSecret('conn_123');
   * if (secret) {
   *   // Use decrypted credentials
   *   const token = secret.credentials.access_token;
   * }
   */
  getSecret(connectionId: string): Promise<ConnectionSecret | null>;

  /**
   * Update credentials for a connection.
   * Typically used after token refresh or credential rotation.
   *
   * @param connectionId - The connection ID
   * @param credentials - Partial credentials to update
   * @returns The updated secret record
   *
   * @example
   * // Update after token refresh
   * const updated = await service.updateSecret('conn_123', {
   *   access_token: 'new_token',
   *   expires_at: '2025-01-01T00:00:00Z'
   * });
   */
  updateSecret(
    connectionId: string,
    credentials: Partial<Credentials>
  ): Promise<ConnectionSecret>;

  /**
   * Delete stored credentials for a connection.
   * Should be called when a connection is deleted.
   *
   * @param connectionId - The connection ID
   * @returns true if deleted, false if not found
   *
   * @example
   * const deleted = await service.deleteSecret('conn_123');
   */
  deleteSecret(connectionId: string): Promise<boolean>;

  /**
   * Check if credentials need refresh based on expiration.
   * Used to proactively refresh tokens before they expire.
   *
   * @param connectionId - The connection ID
   * @returns true if refresh is needed
   *
   * @example
   * if (await service.needsRefresh('conn_123')) {
   *   // Trigger token refresh flow
   * }
   */
  needsRefresh?(connectionId: string): Promise<boolean>;

  /**
   * Get credentials for multiple connections at once.
   * Useful for batch operations.
   *
   * @param connectionIds - Array of connection IDs
   * @returns Map of connection ID to secret
   */
  getSecrets?(connectionIds: string[]): Promise<Map<string, ConnectionSecret>>;

  /**
   * Rotate encryption keys for all stored secrets.
   * Important for security compliance and key rotation policies.
   *
   * @returns Number of secrets re-encrypted
   */
  rotateEncryptionKeys?(): Promise<number>;

  /**
   * Audit log for credential access.
   * Useful for compliance and security monitoring.
   *
   * @param connectionId - The connection accessed
   * @param action - The action performed
   * @param userId - The user who performed the action
   */
  auditAccess?(connectionId: string, action: string, userId: string): Promise<void>;
}