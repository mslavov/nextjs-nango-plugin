import { createNangoHandler, type NangoPluginConfig } from 'nextjs-nango-plugin';

// Import example service implementations
import { InMemoryConnectionService } from './services/connection';
import { InMemoryIntegrationService } from './services/integration';
import { InMemorySecretsService } from './services/secrets';

/**
 * Nango Plugin Configuration Examples
 *
 * This file demonstrates different configuration patterns:
 * 1. Zero-config mode (no database required)
 * 2. Selective services (only what you need)
 * 3. Full implementation (all services)
 */

// Helper function to extract user context from request
// In production, this would integrate with your auth system
const getUserContext = async (request?: any) => {
  // For demo, we'll use a hardcoded user ID
  // In production, extract from cookies/JWT/session
  const userId = 'user-123';
  const organizationId = undefined; // Optional for multi-tenancy

  return { userId, organizationId };
};

/**
 * EXAMPLE 1: Zero-Config Mode (Simplest)
 * No database required - pure Nango API proxy
 * Uncomment to use this mode
 */
// export const nangoConfig: NangoPluginConfig = {
//   nango: {
//     secretKey: process.env.NANGO_SECRET_KEY!,
//     host: process.env.NANGO_HOST || 'https://api.nango.dev',
//   },
// };

/**
 * EXAMPLE 2: Connection Service Only (Common Pattern)
 * Store connections locally, fetch integrations from API
 * Uncomment to use this mode
 */
// export const nangoConfig: NangoPluginConfig = {
//   createConnectionService: async (request) => {
//     const { userId, organizationId } = await getUserContext(request);
//     return new InMemoryConnectionService(userId, organizationId);
//   },
//   nango: {
//     secretKey: process.env.NANGO_SECRET_KEY!,
//     host: process.env.NANGO_HOST || 'https://api.nango.dev',
//     webhookSecret: process.env.NANGO_WEBHOOK_SECRET,
//   },
// };

/**
 * EXAMPLE 3: With Integration Caching
 * Cache integration metadata to reduce API calls
 * Uncomment to use this mode
 */
// export const nangoConfig: NangoPluginConfig = {
//   createConnectionService: async (request) => {
//     const { userId, organizationId } = await getUserContext(request);
//     return new InMemoryConnectionService(userId, organizationId);
//   },
//   createIntegrationService: async () => {
//     return new InMemoryIntegrationService();
//   },
//   nango: {
//     secretKey: process.env.NANGO_SECRET_KEY!,
//     host: process.env.NANGO_HOST || 'https://api.nango.dev',
//     webhookSecret: process.env.NANGO_WEBHOOK_SECRET,
//   },
// };

/**
 * EXAMPLE 4: Full Implementation (All Services)
 * Complete control with local storage, caching, and encrypted secrets
 * This is the active configuration for the demo
 */
export const nangoConfig: NangoPluginConfig = {
  // Connection tracking
  createConnectionService: async (request) => {
    console.log('⚠️  Using in-memory services - for demo only!');
    console.log('   In production, implement with your actual database.');

    const { userId, organizationId } = await getUserContext(request);
    return new InMemoryConnectionService(userId, organizationId);
  },

  // Integration caching
  createIntegrationService: async () => {
    return new InMemoryIntegrationService();
  },

  // Secure credential storage
  createSecretsService: async (request) => {
    const { userId, organizationId } = await getUserContext(request);
    return new InMemorySecretsService(userId, organizationId);
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

// Create and export the handler
export const nangoHandler = createNangoHandler(nangoConfig);

/**
 * Progressive Enhancement Strategy:
 *
 * 1. Start with zero-config for quick prototyping
 * 2. Add ConnectionService when you need to track connections
 * 3. Add IntegrationService to cache provider metadata
 * 4. Add SecretsService for secure credential management
 *
 * Each service is independent - add only what you need!
 */
