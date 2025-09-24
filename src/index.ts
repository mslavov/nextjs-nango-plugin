// Export all public APIs
export { ConnectionManager } from './components/ConnectionManager';
export { IntegrationCard } from './components/IntegrationCard';
export { NangoService } from './lib/nango/client';
export { handleWebhook } from './lib/webhooks/handler';
export { createNangoHandler } from './handler';

// Export types
export type { ConnectionService, Connection } from './lib/types/connection-service';
export type { IntegrationService, Integration } from './lib/types/integration-service';
export type { SecretsService, ConnectionSecret, Credentials } from './lib/types/secrets-service';
export type { NangoPluginConfig, ServiceFactory } from './lib/types/config';