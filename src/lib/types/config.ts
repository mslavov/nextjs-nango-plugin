import { NextRequest } from 'next/server';
import type { ConnectionService } from './connection-service';
import type { IntegrationService } from './integration-service';
import type { SecretsService } from './secrets-service';

/**
 * Factory function type for creating service instances.
 * Services can access the request to extract authentication context.
 */
export type ServiceFactory<T> = (request?: NextRequest) => Promise<T> | T;

/**
 * Configuration for the Next.js Nango Plugin.
 *
 * All services are optional, enabling multiple usage patterns:
 * - Zero-config: No services, pure Nango API proxy
 * - Selective: Implement only needed services
 * - Full: Implement all services for complete control
 */
export interface NangoPluginConfig {
  /**
   * Optional factory function to create ConnectionService.
   * When provided, connections are stored locally.
   * When not provided, connections are managed entirely by Nango.
   */
  createConnectionService?: ServiceFactory<ConnectionService>;

  /**
   * Optional factory function to create IntegrationService.
   * When provided, integration metadata can be cached locally.
   * When not provided, integrations are fetched from Nango on each request.
   */
  createIntegrationService?: ServiceFactory<IntegrationService>;

  /**
   * Optional factory function to create SecretsService.
   * When provided, credentials can be stored locally with encryption.
   * When not provided, credentials are fetched from Nango when needed.
   */
  createSecretsService?: ServiceFactory<SecretsService>;

  /**
   * Nango configuration (required).
   */
  nango: {
    /** Nango secret key for API authentication */
    secretKey: string;
    /** Optional: Nango API host (defaults to https://api.nango.dev) */
    host?: string;
  };

  /**
   * Optional: limit available providers.
   * When specified, only these providers will be shown in the UI.
   */
  providers?: string[];
}