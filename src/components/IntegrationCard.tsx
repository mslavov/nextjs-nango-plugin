'use client';

import React from 'react';

interface IntegrationCardProps {
  provider: string;
  displayName?: string;
  description?: string;
  logoUrl?: string;
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
  displayName,
  description,
  logoUrl,
  connection,
  onConnect,
  onDisconnect,
  isConnecting
}: IntegrationCardProps) {
  const isConnected = connection?.status === 'ACTIVE';
  const hasError = connection?.status === 'ERROR';
  const isExpired = connection?.status === 'EXPIRED';

  const getStatusBadgeClass = () => {
    if (hasError) return 'badge badge-error';
    if (isExpired) return 'badge badge-warning';
    if (isConnected) return 'badge badge-success';
    return 'badge badge-ghost';
  };

  const getStatusText = () => {
    if (hasError) return 'Error';
    if (isExpired) return 'Expired';
    if (isConnected) return 'Connected';
    return 'Not Connected';
  };

  const formatProviderName = (name: string) => {
    return name
      .split(/[_-]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow duration-200">
      <div className="card-body">
        {/* Header with Logo and Status */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* Avatar with logo or placeholder */}
            <div className="avatar placeholder">
              <div className="w-12 rounded-lg bg-neutral text-neutral-content">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={`${displayName || provider} logo`}
                    className="w-full h-full object-contain p-1"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      if (target.nextElementSibling) {
                        (target.nextElementSibling as HTMLElement).style.display = 'block';
                      }
                    }}
                  />
                ) : null}
                <span className={logoUrl ? 'hidden' : 'block text-xl font-bold'}>
                  {(displayName || formatProviderName(provider)).charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            <div>
              <h2 className="card-title text-base-content">
                {displayName || formatProviderName(provider)}
              </h2>
              {description && (
                <p className="text-sm text-base-content/70 line-clamp-1">
                  {description}
                </p>
              )}
            </div>
          </div>
          <span className={getStatusBadgeClass()}>
            {getStatusText()}
          </span>
        </div>

        {/* Last Sync Info */}
        {connection?.lastSync && (
          <>
            <div className="divider my-2"></div>
            <p className="text-xs text-base-content/50">
              Last synced: {new Date(connection.lastSync).toLocaleString()}
            </p>
          </>
        )}

        {/* Action Buttons */}
        <div className="card-actions justify-end mt-4">
          {!isConnected || hasError || isExpired ? (
            <button
              onClick={onConnect}
              disabled={isConnecting}
              className={`btn btn-primary btn-block ${
                isConnecting ? 'btn-disabled' : ''
              }`}
            >
              {isConnecting ? (
                <>
                  <span className="loading loading-spinner"></span>
                  Connecting...
                </>
              ) : hasError || isExpired ? (
                'Reconnect'
              ) : (
                'Connect'
              )}
            </button>
          ) : (
            <>
              <button
                onClick={onConnect}
                disabled={isConnecting}
                className="btn btn-ghost flex-1"
              >
                Refresh
              </button>
              {onDisconnect && (
                <button
                  onClick={onDisconnect}
                  className="btn btn-error btn-outline"
                >
                  Disconnect
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}