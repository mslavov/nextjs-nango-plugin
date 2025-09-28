'use client';

import React, { useState, useEffect } from 'react';
import { IntegrationCard } from './IntegrationCard';

interface Connection {
  provider: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'EXPIRED';
  metadata?: any;
  last_sync_at?: string;
  connection_id: string;
}

interface ConnectionManagerProps {
  // Session data matching Nango's API structure
  sessionData?: {
    end_user: {
      id: string;
      email?: string;
      display_name?: string;
    };
    organization?: {
      id: string;
      display_name?: string;
    };
  };

  providers?: string[]; // Optional: filter integrations by provider unique_key
  onConnectionUpdate?: () => void;

  // Optional API endpoint override
  apiEndpoint?: string; // Default: '/api/nango'

  // Optional styling
  className?: string;
}

export function ConnectionManager({
  sessionData,
  providers,
  onConnectionUpdate,
  apiEndpoint = '/api/nango',
  className = ''
}: ConnectionManagerProps) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [availableProviders, setAvailableProviders] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch existing connections and available providers on mount
  useEffect(() => {
    const init = async () => {
      try {
        // Always fetch integrations from Nango to get full metadata
        try {
          const res = await fetch(`${apiEndpoint}/integrations`);
          if (!res.ok) throw new Error('Failed to fetch integrations');
          const data = await res.json();

          // If providers array is specified, filter the integrations
          if (providers && providers.length > 0) {
            // Filter integrations based on the unique_key field
            const filteredIntegrations = data.filter((integration: any) => {
              // Match against unique_key (e.g., 'github', 'notion', 'slack')
              return providers.includes(integration.unique_key);
            });
            setAvailableProviders(filteredIntegrations);
          } else {
            // No filtering, use all integrations
            setAvailableProviders(data as any[]);
          }
        } catch (error) {
          console.error('Failed to fetch available integrations:', error);
          setError('Failed to load available integrations');
        }
        await fetchConnections();
      } catch (error) {
        console.error('Initialization error:', error);
        setError('Failed to initialize connection manager');
      }
    };
    init();
  }, [providers, apiEndpoint]);

  const fetchConnections = async () => {
    try {
      // The API will use the request context (cookies, headers, etc.)
      // to determine which connections to return
      const res = await fetch(`${apiEndpoint}/connections`);
      if (!res.ok) throw new Error('Failed to fetch connections');
      const data = await res.json();
      setConnections(data as Connection[]);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch connections:', error);
      setError('Failed to load connections');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (providerId: string) => {
    setConnecting(providerId);
    setError(null);

    try {
      // Validate that sessionData is provided with required fields
      if (!sessionData?.end_user?.id) {
        throw new Error('Session data with end_user.id is required');
      }

      // Build session request matching Nango's API
      const sessionRequest = {
        ...sessionData,
        allowed_integrations: [providerId]
      };

      // Get session token
      const res = await fetch(`${apiEndpoint}/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionRequest)
      });

      if (!res.ok) {
        throw new Error('Failed to create session');
      }

      const response = await res.json() as any;
      const sessionToken = response.sessionToken;

      // Dynamic import Nango frontend
      const Nango = (await import('@nangohq/frontend')).default;

      // Open Connect UI
      // Note: Nango's modal creates a full-screen overlay. If you experience issues
      // with the modal appearing too dark or covering the entire screen with UI
      // frameworks like DaisyUI, you may need to add custom CSS to adjust the
      // z-index or overlay opacity. The modal typically uses z-index > 9999.
      const nango = new Nango({ connectSessionToken: sessionToken });

      await new Promise<void>((resolve, reject) => {
        nango.openConnectUI({
          onEvent: (event: any) => {
            if (event.type === 'connect') {
              fetchConnections();
              onConnectionUpdate?.();
              setConnecting(null);
              resolve();
            } else if (event.type === 'close') {
              setConnecting(null);
              resolve();
            } else if (event.type === 'error') {
              setError(`Connection failed: ${event.message || 'Unknown error'}`);
              setConnecting(null);
              reject(new Error(event.message));
            }
          }
        });
      });
    } catch (error: any) {
      console.error('Connection failed:', error);
      setError(`Connection failed: ${error.message || 'Unknown error'}`);
      setConnecting(null);
    }
  };

  const handleDisconnect = async (providerId: string, connectionId: string) => {
    try {
      const res = await fetch(`${apiEndpoint}/connections/${connectionId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerConfigKey: providerId })
      });

      if (!res.ok) {
        throw new Error('Failed to disconnect');
      }

      await fetchConnections();
      onConnectionUpdate?.();
    } catch (error: any) {
      console.error('Disconnect failed:', error);
      setError(`Disconnect failed: ${error.message || 'Unknown error'}`);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-gray-600">Loading integrations...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  if (availableProviders.length === 0) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
          No integrations available. Please configure integrations in your Nango dashboard.
        </div>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
      {availableProviders.map(integration => {
        // Integration has: id (UUID), unique_key (provider key), provider, display_name, etc.
        const providerId = integration.unique_key;
        const connection = connections.find(c => c.provider === providerId);

        return (
          <IntegrationCard
            key={integration.id || providerId}
            provider={providerId}
            displayName={integration.display_name || integration.displayName}
            description={integration.description}
            logoUrl={integration.logo_url || integration.logoUrl}
            connection={connection ? {
              status: connection.status,
              lastSync: connection.last_sync_at
            } : undefined}
            onConnect={() => handleConnect(providerId)}
            onDisconnect={connection ? () => handleDisconnect(providerId, connection.connection_id) : undefined}
            isConnecting={connecting === providerId}
          />
        );
      })}
    </div>
  );
}