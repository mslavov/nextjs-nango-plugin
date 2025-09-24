# Next.js Nango Plugin

Seamless OAuth integration for Next.js apps using Nango with complete database flexibility through dependency injection.

## Features

- 🚀 **Zero-config mode** - Start without any database - pure Nango API proxy
- 🔌 **Optional services architecture** - Use only what you need, when you need it
- 🎯 **Universal ownership model** - Adapter pattern works with any user/team/org structure
- 🗄️ **Database agnostic** - Optional dependency injection supports any database (Supabase, Prisma, PostgreSQL, MongoDB, etc.)
- 🔄 **Dynamic provider support** - No hardcoded provider list - works with any Nango-configured provider
- 🪝 **Automatic webhook handling** - Real-time connection status updates
- 🎨 **Production-ready React components** - Beautiful, customizable connection management UI
- 🛠️ **Interactive CLI** - Guided setup and configuration with automatic file generation
- 🔒 **Security first** - Built-in RLS support, secure token handling, webhook signature verification, and optional credential encryption
- 📦 **Lightweight** - Minimal dependencies, tree-shakeable exports
- 🧪 **Fully tested** - Comprehensive test coverage with Jest

## Installation

```bash
npm install nextjs-nango-plugin
```

## Quick Start

### Zero-Config Mode (NEW! 🚀)

Get started in seconds without any database setup:

```typescript
import { createNangoHandler } from 'nextjs-nango-plugin';

// app/api/nango/[...path]/route.ts
export const handler = createNangoHandler({
  nango: {
    secretKey: process.env.NANGO_SECRET_KEY!
  }
});

export const { GET, POST, PUT, DELETE } = handler;
```

That's it! You now have a working Nango integration.

### Standard Setup

### 1. Initialize the plugin

```bash
npx nextjs-nango-plugin init
```

This interactive CLI will:
- Guide you through database adapter selection (Supabase, Prisma, Custom)
- Create API routes at `/api/nango/[...path]/route.ts`
- Generate type-safe configuration in `/lib/nango-config.ts`
- Add required environment variables to `.env.local`
- Create example integration pages based on your app structure

### 2. Choose your configuration mode

The plugin now supports multiple configuration modes with all services being optional:

#### Zero-Config Mode (NEW! - No database required)
```typescript
// Simplest setup - pure Nango API proxy
export const nangoConfig: NangoPluginConfig = {
  nango: {
    secretKey: process.env.NANGO_SECRET_KEY!,
  },
};
```

#### With Connection Tracking (Most common)
```typescript
export const nangoConfig: NangoPluginConfig = {
  nango: {
    secretKey: process.env.NANGO_SECRET_KEY!,
  },
  createConnectionService: async (request?) => {
    // Your database adapter for tracking connections
    // The plugin works with ANY database through this interface
  },
};
```

### 3. Create your database schema

Create a table for storing Nango connections with these required fields:

```sql
CREATE TABLE nango_connections (
  id VARCHAR(255) PRIMARY KEY,
  owner_id VARCHAR(255) NOT NULL,        -- User/entity that owns this connection
  organization_id VARCHAR(255),          -- Optional: for multi-tenant scenarios
  provider VARCHAR(100) NOT NULL,        -- Provider config key from Nango
  connection_id VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL,           -- ACTIVE, INACTIVE, ERROR, EXPIRED
  metadata JSONB,                        -- Additional custom data
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_owner (owner_id),
  INDEX idx_org (organization_id),
  INDEX idx_connection (connection_id)
);
```

### 4. Configure Nango

In your [Nango dashboard](https://app.nango.dev):
1. Add your OAuth providers (GitHub, Notion, etc.)
2. Set your webhook URL to: `https://your-app.com/api/nango/webhooks`

### 5. Use the ConnectionManager component

```tsx
import { ConnectionManager } from 'nextjs-nango-plugin';

export default function IntegrationsPage() {
  const user = await getUser(); // Your auth logic

  return (
    <ConnectionManager
      sessionData={{
        end_user: {
          id: user.id,
          email: user.email,
          display_name: user.name
        }
      }}
      providers={['github', 'notion', 'slack']} // Optional: auto-fetches if not provided
      onConnectionUpdate={() => {
        console.log('Connection updated!');
      }}
      className="max-w-4xl mx-auto"
    />
  );
}
```

## Configuration

### Optional Services Architecture (NEW in v0.3.0)

All services are now optional with automatic Nango API fallback:

#### Available Services

1. **ConnectionService** (Optional)
   - Tracks OAuth connections in your database
   - Manages ownership and access control
   - Falls back to Nango when not provided

2. **IntegrationService** (Optional)
   - Caches provider metadata locally
   - Reduces API calls for better performance
   - Falls back to Nango API when not provided

3. **SecretsService** (Optional)
   - Stores encrypted credentials locally
   - Enables offline token refresh
   - Falls back to Nango's secure storage when not provided

#### Progressive Enhancement Pattern

Start simple and add services as your needs grow:

```typescript
// 1. Start with zero-config
const handler = createNangoHandler({
  nango: { secretKey: process.env.NANGO_SECRET_KEY! }
});

// 2. Add connection tracking when needed
const handler = createNangoHandler({
  createConnectionService: async (req) => new MyConnectionService(req),
  nango: { secretKey: process.env.NANGO_SECRET_KEY! }
});

// 3. Add integration caching for performance
const handler = createNangoHandler({
  createConnectionService: async (req) => new MyConnectionService(req),
  createIntegrationService: async () => new CachedIntegrationService(),
  nango: { secretKey: process.env.NANGO_SECRET_KEY! }
});

// 4. Add secure credential storage
const handler = createNangoHandler({
  createConnectionService: async (req) => new MyConnectionService(req),
  createIntegrationService: async () => new CachedIntegrationService(),
  createSecretsService: async (req) => new EncryptedSecretsService(req),
  nango: { secretKey: process.env.NANGO_SECRET_KEY! }
});
```

### Dependency Injection Architecture

When you need database storage, the plugin uses a powerful dependency injection pattern that adapts to ANY database and ownership model:

```typescript
interface Connection {
  id: string;                    // Unique identifier in your database
  owner_id: string;              // Required: User/entity that owns this connection
  organization_id?: string;      // Optional: Organization/team identifier
  provider: string;              // Provider config key from Nango
  connection_id: string;         // Connection identifier in Nango
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'EXPIRED';
  metadata?: Record<string, any>; // Additional custom data
  created_at: string;
  updated_at: string;
}

interface ConnectionService {
  getConnections(filters?: Record<string, any>): Promise<Connection[]>;
  createConnection(
    provider: string,
    connectionId: string,
    ownerId: string,
    organizationId?: string,
    metadata?: Record<string, any>
  ): Promise<Connection>;
  getConnection?(connectionId: string): Promise<Connection | null>;
  updateConnectionStatus(connectionId: string, status: Connection['status']): Promise<Connection>;
  deleteConnection(connectionId: string): Promise<boolean>;
}
```

Your implementation determines:
- How to extract the owner_id from your authentication system
- Which database/ORM to use
- How to handle multi-tenancy with organization_id
- What additional metadata to store

### Database Adapter Examples

#### Supabase Adapter
```typescript
import { createClient } from '@supabase/supabase-js';

export const nangoConfig: NangoPluginConfig = {
  createConnectionService: async (request?) => {
    // Get auth from request headers
    const token = request?.headers.get('authorization')?.replace('Bearer ', '');
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    return {
      async getConnections() {
        const { data } = await supabase
          .from('nango_connections')
          .select('*');
        return data || [];
      },
      async createConnection(provider, connectionId, ownerId, organizationId, metadata) {
        const { data } = await supabase
          .from('nango_connections')
          .insert({
            provider,
            connection_id: connectionId,
            owner_id: ownerId,
            organization_id: organizationId,
            metadata,
            status: 'ACTIVE'
          })
          .select()
          .single();
        return data;
      },
      // ... other methods
    };
  },
};
```

#### Prisma Adapter
```typescript
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';

export const nangoConfig: NangoPluginConfig = {
  createConnectionService: async (request?) => {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    return {
      async getConnections() {
        return await prisma.nangoConnection.findMany({
          where: { userId }
        });
      },
      async createConnection(provider, connectionId, ownerId, organizationId, metadata) {
        return await prisma.nangoConnection.create({
          data: {
            owner_id: ownerId,
            organization_id: organizationId,
            provider,
            connection_id: connectionId,
            metadata,
            status: 'ACTIVE'
          }
        });
      },
      // ... other methods
    };
  },
};
```

#### MongoDB Adapter
```typescript
import { MongoClient } from 'mongodb';

export const nangoConfig: NangoPluginConfig = {
  createConnectionService: async (request?) => {
    const client = new MongoClient(MONGODB_URI);
    const db = client.db('myapp');
    const userId = await getUserIdFromRequest(request);

    return {
      async getConnections() {
        return await db.collection('connections')
          .find({ userId })
          .toArray();
      },
      // ... other methods
    };
  },
};
```

## API Reference

### Core Handler

#### createNangoHandler
Creates all the API route handlers for your Next.js app.

```typescript
import { createNangoHandler } from 'nextjs-nango-plugin';
import { nangoConfig } from '@/lib/nango-config';

const handlers = createNangoHandler(nangoConfig);

export const { GET, POST, PUT, DELETE } = handlers;
```

This single handler manages:
- `GET /api/nango/connections` - List user's connections
- `GET /api/nango/integrations` - List available providers
- `POST /api/nango/auth/session` - Create OAuth session
- `POST /api/nango/webhooks` - Handle Nango webhooks (auto-creates connections on successful auth)
- `PUT /api/nango/connections/[id]` - Update connection status
- `DELETE /api/nango/connections/[id]` - Delete connection (removes from both database and Nango)

### Components

#### ConnectionManager
Main component for managing OAuth connections.

```tsx
interface ConnectionManagerProps {
  sessionData?: {                // Session data for Nango Connect
    end_user: {
      id: string;                // Required: User identifier
      email?: string;            // Optional: User email
      display_name?: string;     // Optional: Display name
    };
    organization?: {             // Optional: Organization context
      id: string;
      display_name?: string;
    };
  };
  providers?: string[];          // List of providers (auto-fetches if not provided)
  onConnectionUpdate?: () => void; // Callback on connection change
  apiEndpoint?: string;          // API endpoint (default: '/api/nango')
  className?: string;            // Additional CSS classes
}
```

#### IntegrationCard
Individual provider card component with automatic provider metadata.

```tsx
interface IntegrationCardProps {
  provider: string;              // Provider key (e.g., 'github', 'notion')
  connection?: {                 // Current connection state
    status: 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'EXPIRED';
    lastSync?: string;
  };
  onConnect: () => void;         // Connect callback
  onDisconnect?: () => void;     // Disconnect callback
  isConnecting: boolean;         // Loading state
  className?: string;            // Additional CSS classes
  showStatus?: boolean;          // Show connection status badge
}
```

The component automatically:
- Fetches and displays provider logos
- Shows human-readable provider names
- Handles loading and error states
- Displays connection status with color coding

### Core Services

#### NangoService
Type-safe wrapper for Nango API operations.

```typescript
import { NangoService } from 'nextjs-nango-plugin';

const nango = new NangoService(secretKey, host?);

// Create OAuth session for Nango Connect
const session = await nango.createSession(
  userId: string,
  organizationId: string,
  integrationId?: string,
  userEmail?: string
);

// List all configured integrations
const integrations = await nango.listIntegrations();
// Returns: Integration[] with provider metadata

// Get specific connection details
const connection = await nango.getConnection(connectionId);

// Delete connection from Nango
await nango.deleteConnection(connectionId, providerConfigKey);
```

#### ConnectionService Interface
Your adapter must implement this interface:

```typescript
interface ConnectionService {
  // Get all connections for the current context
  // Optional filters parameter for querying
  getConnections(filters?: Record<string, any>): Promise<Connection[]>;

  // Create a new connection record with explicit ownership
  createConnection(
    provider: string,
    connectionId: string,
    ownerId: string,
    organizationId?: string,
    metadata?: Record<string, any>
  ): Promise<Connection>;

  // Update connection status
  updateConnectionStatus(
    connectionId: string,
    status: ConnectionStatus
  ): Promise<Connection>;

  // Delete connection record
  deleteConnection(connectionId: string): Promise<void>;
}

// Connection status enum
enum ConnectionStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ERROR = 'ERROR',
  EXPIRED = 'EXPIRED'
}
```

## Dynamic Provider Support

The plugin automatically works with ANY provider configured in Nango - no code changes needed:

### 1. Configure in Nango Dashboard
- Add any OAuth provider (standard or custom)
- Configure OAuth credentials and scopes
- Set up sync scripts if needed

### 2. Use immediately in your app
```tsx
<ConnectionManager
  sessionData={{
    end_user: {
      id: userId,
      email: userEmail,
      display_name: userName
    }
  }}
  providers={[
    'github',           // Standard providers
    'notion',
    'slack',
    'custom-erp',       // Your custom providers
    'internal-api',
    'legacy-system'
  ]}
/>
```

### 3. Provider metadata is automatic
The plugin automatically:
- Fetches provider names and logos from Nango
- Handles OAuth flow for any provider
- Manages connection lifecycle
- Syncs webhook events

## Webhook Handling

The plugin automatically processes Nango webhook events with signature verification:

### Supported Events
- `auth:success` - Connection authorized → Status: ACTIVE
- `auth:error` - Authorization failed → Status: ERROR
- `connection:deleted` - Connection removed → Status: INACTIVE
- `sync:success` - Sync completed → Updates lastSync timestamp
- `sync:error` - Sync failed → Status: ERROR
- `connection:expired` - Token expired → Status: EXPIRED

### Security
- Webhook signatures are automatically verified using Nango's built-in verification
- Events are processed atomically with proper error handling
- Connection IDs are validated before database updates

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Nango
NANGO_SECRET_KEY=your-nango-secret-key
```

## CLI Commands

### init
Interactive setup wizard for your Next.js app.

```bash
npx nextjs-nango-plugin init
```

Options:
- `--database <type>` - Skip interactive mode (supabase | prisma | custom)
- `--path <path>` - API route path (default: /api/nango)
- `--skip-env` - Don't create .env.local file

The CLI will:
1. Detect your Next.js app structure (App Router/Pages Router)
2. Guide you through database adapter selection
3. Generate all necessary files with proper types
4. Add environment variables
5. Provide next steps documentation

## TypeScript Support

Full TypeScript support with exported types for maximum type safety:

```typescript
import type {
  // Configuration
  NangoPluginConfig,

  // Services
  ConnectionService,
  NangoService,

  // Data types
  Connection,
  ConnectionStatus,
  Integration,

  // Component props
  ConnectionManagerProps,
  IntegrationCardProps,

  // Webhook types
  WebhookEvent,
  WebhookPayload
} from 'nextjs-nango-plugin';
```

All components and services are fully typed with strict mode compatibility.

## Architecture Benefits

### Dependency Injection
The plugin's architecture provides:
- **Database Independence**: Works with any database or ORM
- **Auth Flexibility**: Integrates with any authentication system
- **Custom Logic**: Add business logic in your ConnectionService
- **Type Safety**: Full TypeScript support with generics
- **Testing**: Easy to mock and test with dependency injection

### Production Ready
- **Error Handling**: Comprehensive error boundaries and fallbacks
- **Performance**: Optimized with React.memo and SWR caching
- **Accessibility**: WCAG 2.1 AA compliant components
- **Security**: Webhook verification, CSRF protection ready
- **Monitoring**: Detailed logging and error tracking support

## Testing

```bash
npm test        # Run all tests
npm test:watch  # Watch mode
npm test:coverage # Coverage report
```

The plugin includes:
- Unit tests for all services
- Component tests with React Testing Library
- Integration tests for API handlers
- Mock implementations for testing

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Examples

See the `/examples` directory for complete implementations:
- **nextjs-example** - Basic Next.js App Router setup
- **with-supabase** - Supabase integration with RLS
- **with-prisma** - Prisma ORM with PostgreSQL
- **multi-tenant** - Organization-based multi-tenancy

## Support

- [GitHub Issues](https://github.com/mslavov/nextjs-nango-plugin/issues)
- [Documentation](https://github.com/mslavov/nextjs-nango-plugin/wiki)
- [Discussions](https://github.com/mslavov/nextjs-nango-plugin/discussions)
- [LLM Documentation](./llm.txt) - Comprehensive documentation for AI/LLM usage

## Acknowledgments

Built with:
- [Nango](https://nango.dev) - Unified OAuth for developers
- [Supabase](https://supabase.com) - Open source Firebase alternative
- [Next.js](https://nextjs.org) - The React framework