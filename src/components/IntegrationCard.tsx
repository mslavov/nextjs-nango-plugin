'use client';

import React from 'react';

interface IntegrationCardProps {
  provider: string;
  connection?: {
    status: 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'EXPIRED';
    lastSync?: string;
  };
  onConnect: () => void;
  onDisconnect?: () => void;
  isConnecting: boolean;
}

export function IntegrationCard({
  provider,
  connection,
  onConnect,
  onDisconnect,
  isConnecting
}: IntegrationCardProps) {
  const isConnected = connection?.status === 'ACTIVE';
  const hasError = connection?.status === 'ERROR';
  const isExpired = connection?.status === 'EXPIRED';

  const getStatusColor = () => {
    if (hasError) return 'bg-red-100 text-red-800';
    if (isExpired) return 'bg-yellow-100 text-yellow-800';
    if (isConnected) return 'bg-green-100 text-green-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getStatusText = () => {
    if (hasError) return 'Error';
    if (isExpired) return 'Expired';
    if (isConnected) return 'Connected';
    return 'Not Connected';
  };

  return (
    <div className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold capitalize">
          {provider.replace(/_/g, ' ')}
        </h3>
        <span className={`px-2 py-1 rounded text-sm ${getStatusColor()}`}>
          {getStatusText()}
        </span>
      </div>

      {connection?.lastSync && (
        <p className="text-sm text-gray-600 mb-4">
          Last synced: {new Date(connection.lastSync).toLocaleDateString()}
        </p>
      )}

      <div className="flex gap-2">
        {!isConnected || hasError || isExpired ? (
          <button
            onClick={onConnect}
            disabled={isConnecting}
            className={`flex-1 py-2 px-4 rounded transition-colors ${
              isConnecting
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {isConnecting ? 'Connecting...' : hasError ? 'Reconnect' : 'Connect'}
          </button>
        ) : (
          <>
            <button
              onClick={onConnect}
              disabled={isConnecting}
              className="flex-1 py-2 px-4 rounded bg-blue-500 hover:bg-blue-600 text-white transition-colors"
            >
              Refresh Connection
            </button>
            {onDisconnect && (
              <button
                onClick={onDisconnect}
                className="py-2 px-4 rounded bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                Disconnect
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}