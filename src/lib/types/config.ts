import { NextRequest } from 'next/server';
import type { ConnectionService } from './connection-service';

export interface NangoPluginConfig {
  // Factory function to create ConnectionService
  createConnectionService: (request?: NextRequest) => Promise<ConnectionService> | ConnectionService;

  // Nango configuration
  nango: {
    secretKey: string;
    host?: string;
    webhookSecret?: string;
  };

  // Optional: limit available providers
  providers?: string[];
}