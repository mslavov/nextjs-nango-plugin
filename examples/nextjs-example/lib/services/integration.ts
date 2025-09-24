import type { IntegrationService, Integration } from 'nextjs-nango-plugin';

/**
 * Example IntegrationService implementation with in-memory caching
 *
 * This service caches integration metadata to reduce API calls.
 * In production, you might use Redis or another caching solution.
 */

// In-memory cache with TTL
interface CachedIntegration {
  integration: Integration;
  cachedAt: number;
}

const integrationCache = new Map<string, CachedIntegration>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class InMemoryIntegrationService implements IntegrationService {
  async getIntegrations(filters?: Record<string, any>): Promise<Integration[]> {
    const integrations: Integration[] = [];
    const now = Date.now();

    // Clean up expired entries
    for (const [key, cached] of integrationCache.entries()) {
      if (now - cached.cachedAt > CACHE_TTL) {
        integrationCache.delete(key);
      } else {
        integrations.push(cached.integration);
      }
    }

    // Apply filters if provided
    if (filters) {
      return integrations.filter(integration => {
        for (const [key, value] of Object.entries(filters)) {
          if ((integration as any)[key] !== value) {
            return false;
          }
        }
        return true;
      });
    }

    return integrations;
  }

  async getIntegration(providerKey: string): Promise<Integration | null> {
    const cached = integrationCache.get(providerKey);

    if (cached) {
      const now = Date.now();
      if (now - cached.cachedAt <= CACHE_TTL) {
        return cached.integration;
      } else {
        integrationCache.delete(providerKey);
      }
    }

    return null;
  }

  async storeIntegration(integration: Integration): Promise<void> {
    integrationCache.set(integration.provider, {
      integration,
      cachedAt: Date.now()
    });
  }

  async updateIntegration(
    providerKey: string,
    data: Partial<Integration>
  ): Promise<Integration> {
    const cached = integrationCache.get(providerKey);

    if (!cached) {
      throw new Error(`Integration ${providerKey} not found`);
    }

    const updated: Integration = {
      ...cached.integration,
      ...data,
      updated_at: new Date().toISOString()
    };

    integrationCache.set(providerKey, {
      integration: updated,
      cachedAt: Date.now()
    });

    return updated;
  }

  async deleteIntegration(providerKey: string): Promise<boolean> {
    return integrationCache.delete(providerKey);
  }

  async syncIntegrations?(): Promise<number> {
    // In a real implementation, this would fetch from Nango API
    // and populate the cache
    console.log('Syncing integrations from Nango API...');
    return integrationCache.size;
  }

  async needsRefresh?(): Promise<boolean> {
    // Check if cache is empty or all entries are expired
    if (integrationCache.size === 0) return true;

    const now = Date.now();
    for (const cached of integrationCache.values()) {
      if (now - cached.cachedAt <= CACHE_TTL) {
        return false; // At least one valid entry exists
      }
    }

    return true; // All entries are expired
  }
}