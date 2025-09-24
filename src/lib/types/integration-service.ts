/**
 * Integration Service Interface
 *
 * Optional service for managing integration metadata and configurations.
 * When implemented, this service can cache integration data locally to reduce
 * API calls and improve performance. When not implemented, the plugin will
 * fetch integration data directly from Nango's API.
 */

/**
 * Represents an integration/provider configuration in Nango.
 * This includes OAuth providers, API key integrations, and custom integrations.
 */
export interface Integration {
  /** Unique identifier for the integration */
  id: string;

  /** The provider key (e.g., 'github', 'slack', 'salesforce') */
  provider: string;

  /** Unique key for this integration configuration */
  unique_key: string;

  /** Display name for the integration */
  display_name?: string;

  /** URL to the provider's logo */
  logo_url?: string;

  /** Authentication mode used by this integration */
  auth_mode: 'OAUTH2' | 'OAUTH1' | 'API_KEY' | 'BASIC' | 'CUSTOM';

  /** OAuth scopes if applicable */
  scopes?: string[];

  /** Additional metadata about the integration */
  metadata?: Record<string, any>;

  /** ISO timestamp when the integration was created */
  created_at: string;

  /** ISO timestamp when the integration was last updated */
  updated_at: string;
}

/**
 * Service interface for managing integration configurations.
 *
 * Implementing this service allows you to:
 * - Cache integration metadata locally
 * - Reduce API calls to Nango
 * - Customize integration presentation
 * - Add custom business logic to integration management
 *
 * When not implemented, the plugin will fetch integration data
 * directly from Nango's API on each request.
 */
export interface IntegrationService {
  /**
   * Get all available integrations.
   *
   * @param filters - Optional filters to apply (e.g., by auth_mode, provider)
   * @returns Array of integrations matching the filters
   *
   * @example
   * // Get all integrations
   * const all = await service.getIntegrations();
   *
   * @example
   * // Get only OAuth2 integrations
   * const oauth = await service.getIntegrations({ auth_mode: 'OAUTH2' });
   */
  getIntegrations(filters?: Record<string, any>): Promise<Integration[]>;

  /**
   * Get a specific integration by provider key.
   *
   * @param providerKey - The provider key to look up
   * @returns The integration if found, null otherwise
   *
   * @example
   * const github = await service.getIntegration('github');
   */
  getIntegration(providerKey: string): Promise<Integration | null>;

  /**
   * Store or cache an integration configuration.
   * This is typically called after fetching from Nango to cache locally.
   *
   * @param integration - The integration to store
   *
   * @example
   * const integration = await nangoApi.getIntegration('github');
   * await service.storeIntegration(integration);
   */
  storeIntegration(integration: Integration): Promise<void>;

  /**
   * Update an existing integration configuration.
   *
   * @param providerKey - The provider key to update
   * @param data - Partial integration data to update
   * @returns The updated integration
   *
   * @example
   * const updated = await service.updateIntegration('github', {
   *   display_name: 'GitHub Enterprise',
   *   metadata: { enterprise: true }
   * });
   */
  updateIntegration(providerKey: string, data: Partial<Integration>): Promise<Integration>;

  /**
   * Delete an integration configuration from local storage.
   * Note: This doesn't delete the integration from Nango.
   *
   * @param providerKey - The provider key to delete
   * @returns true if deleted, false if not found
   */
  deleteIntegration(providerKey: string): Promise<boolean>;

  /**
   * Sync integrations from Nango API to local storage.
   * This is useful for refreshing cached data.
   *
   * @returns Number of integrations synced
   */
  syncIntegrations?(): Promise<number>;

  /**
   * Check if cached data is stale and needs refresh.
   *
   * @returns true if data should be refreshed from API
   */
  needsRefresh?(): Promise<boolean>;
}