import type { SecretsService, ConnectionSecret, Credentials } from 'nextjs-nango-plugin';
import crypto from 'crypto';

/**
 * Example SecretsService implementation with basic encryption
 *
 * WARNING: This is for demonstration purposes only!
 * In production:
 * - Use a proper key management service (AWS KMS, Azure Key Vault, etc.)
 * - Store encrypted secrets in a secure database
 * - Implement proper audit logging
 * - Use stronger encryption algorithms
 */

// Simple encryption helper (DO NOT USE IN PRODUCTION)
class SimpleEncryption {
  private algorithm = 'aes-256-gcm';
  private key: Buffer;

  constructor() {
    // In production, load this from a secure key management service
    const keyString = process.env.ENCRYPTION_KEY || 'demo-key-do-not-use-in-production!!';
    this.key = crypto.scryptSync(keyString, 'salt', 32);
  }

  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  decrypt(encryptedData: string): string {
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

// In-memory storage (will reset on server restart)
const secretsStore = new Map<string, ConnectionSecret>();
const encryption = new SimpleEncryption();

export class InMemorySecretsService implements SecretsService {
  constructor(private userId: string, private organizationId?: string) {}

  async storeSecret(
    connectionId: string,
    provider: string,
    credentials: Credentials,
    ownerId: string,
    organizationId?: string
  ): Promise<ConnectionSecret> {
    // Encrypt sensitive fields
    const encryptedCredentials: Credentials = { ...credentials };

    if (credentials.access_token) {
      encryptedCredentials.access_token = encryption.encrypt(credentials.access_token);
    }
    if (credentials.refresh_token) {
      encryptedCredentials.refresh_token = encryption.encrypt(credentials.refresh_token);
    }
    if (credentials.api_key) {
      encryptedCredentials.api_key = encryption.encrypt(credentials.api_key);
    }
    if (credentials.password) {
      encryptedCredentials.password = encryption.encrypt(credentials.password);
    }

    const secret: ConnectionSecret = {
      connection_id: connectionId,
      provider,
      owner_id: ownerId,
      organization_id: organizationId,
      credentials: encryptedCredentials,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    secretsStore.set(connectionId, secret);

    // Log access for audit (in production, use proper audit logging)
    console.log(`[AUDIT] Secret stored for connection ${connectionId} by user ${ownerId}`);

    return this.decryptSecret(secret);
  }

  async getSecret(connectionId: string): Promise<ConnectionSecret | null> {
    const secret = secretsStore.get(connectionId);

    if (!secret) return null;

    // Check ownership
    if (secret.owner_id !== this.userId) {
      console.warn(`[SECURITY] Unauthorized access attempt to secret ${connectionId} by user ${this.userId}`);
      return null;
    }

    // Log access for audit
    console.log(`[AUDIT] Secret accessed for connection ${connectionId} by user ${this.userId}`);

    return this.decryptSecret(secret);
  }

  async updateSecret(
    connectionId: string,
    credentials: Partial<Credentials>
  ): Promise<ConnectionSecret> {
    const existing = secretsStore.get(connectionId);

    if (!existing) {
      throw new Error(`Secret not found for connection ${connectionId}`);
    }

    if (existing.owner_id !== this.userId) {
      throw new Error('Unauthorized');
    }

    // Decrypt existing credentials
    const decryptedExisting = this.decryptSecret(existing);

    // Merge and re-encrypt
    const updatedCredentials = {
      ...decryptedExisting.credentials,
      ...credentials
    };

    // Encrypt sensitive fields in the update
    const encryptedCredentials: Credentials = { ...updatedCredentials };

    if (updatedCredentials.access_token) {
      encryptedCredentials.access_token = encryption.encrypt(updatedCredentials.access_token);
    }
    if (updatedCredentials.refresh_token) {
      encryptedCredentials.refresh_token = encryption.encrypt(updatedCredentials.refresh_token);
    }
    if (updatedCredentials.api_key) {
      encryptedCredentials.api_key = encryption.encrypt(updatedCredentials.api_key);
    }
    if (updatedCredentials.password) {
      encryptedCredentials.password = encryption.encrypt(updatedCredentials.password);
    }

    existing.credentials = encryptedCredentials;
    existing.updated_at = new Date().toISOString();
    existing.last_refreshed_at = new Date().toISOString();

    console.log(`[AUDIT] Secret updated for connection ${connectionId} by user ${this.userId}`);

    return this.decryptSecret(existing);
  }

  async deleteSecret(connectionId: string): Promise<boolean> {
    const existing = secretsStore.get(connectionId);

    if (existing && existing.owner_id === this.userId) {
      secretsStore.delete(connectionId);
      console.log(`[AUDIT] Secret deleted for connection ${connectionId} by user ${this.userId}`);
      return true;
    }

    return false;
  }

  async needsRefresh?(connectionId: string): Promise<boolean> {
    const secret = await this.getSecret(connectionId);

    if (!secret || !secret.credentials.expires_at) {
      return false;
    }

    const expiresAt = new Date(secret.credentials.expires_at);
    const now = new Date();
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer

    return (expiresAt.getTime() - now.getTime()) <= bufferTime;
  }

  // Helper method to decrypt a secret
  private decryptSecret(secret: ConnectionSecret): ConnectionSecret {
    const decrypted: ConnectionSecret = { ...secret };
    const credentials = { ...secret.credentials };

    try {
      if (credentials.access_token) {
        credentials.access_token = encryption.decrypt(credentials.access_token);
      }
      if (credentials.refresh_token) {
        credentials.refresh_token = encryption.decrypt(credentials.refresh_token);
      }
      if (credentials.api_key) {
        credentials.api_key = encryption.decrypt(credentials.api_key);
      }
      if (credentials.password) {
        credentials.password = encryption.decrypt(credentials.password);
      }
    } catch (error) {
      console.error('[SECURITY] Failed to decrypt credentials:', error);
      throw new Error('Failed to decrypt credentials');
    }

    decrypted.credentials = credentials;
    return decrypted;
  }
}