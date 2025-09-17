# Next.js Nango Plugin

Seamless OAuth integration for Next.js apps using Nango with complete database flexibility through dependency injection.

## Features

- 🔌 **Zero-config integration** - Set up OAuth in minutes with a single CLI command
- 🎯 **Universal ownership model** - Adapter pattern works with any user/team/org structure
- 🗄️ **Database agnostic** - Dependency injection supports any database (Supabase, Prisma, PostgreSQL, MongoDB, etc.)
- 🔄 **Dynamic provider support** - No hardcoded provider list - works with any Nango-configured provider
- 🪝 **Automatic webhook handling** - Real-time connection status updates
- 🎨 **Production-ready React components** - Beautiful, customizable connection management UI
- 🛠️ **Interactive CLI** - Guided setup and configuration with automatic file generation
- 🔒 **Security first** - Built-in RLS support, secure token handling, and webhook signature verification
- 📦 **Lightweight** - Minimal dependencies, tree-shakeable exports
- 🧪 **Fully tested** - Comprehensive test coverage with Jest

## Installation

```bash
npm install nextjs-nango-plugin
```

## Quick Start

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

### 2. Configure your database adapter

The plugin uses dependency injection, so you configure your database once in `/lib/nango-config.ts`:

```typescript
export const nangoConfig: NangoPluginConfig = {
  nango: {
    secretKey: process.env.NANGO_SECRET_KEY!,
    webhookSecret: process.env.NANGO_WEBHOOK_SECRET,
  },
  createConnectionService: async (request?) => {
    // Your database adapter implementation
    // The plugin works with ANY database through this interface
  },
};
```

### 3. Configure Nango

In your [Nango dashboard](https://app.nango.dev):
1. Add your OAuth providers (GitHub, Notion, etc.)
2. Set your webhook URL to: `https://your-app.com/api/nango/webhooks`

### 4. Use the ConnectionManager component

```tsx
import { ConnectionManager } from 'nextjs-nango-plugin';

export default function IntegrationsPage() {
  const user = await getUser(); // Your auth logic

  return (
    <ConnectionManager
      ownerId={user.id}
      ownerEmail={user.email}
      ownerName={user.name}
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

### Dependency Injection Architecture

The plugin uses a powerful dependency injection pattern that adapts to ANY database and ownership model through a single `ConnectionService` interface:

```typescript
interface ConnectionService {
  getConnections(): Promise<Connection[]>;
  createConnection(provider: string, connectionId: string, metadata?: any): Promise<Connection>;
  updateConnectionStatus(connectionId: string, status: ConnectionStatus): Promise<Connection>;
  deleteConnection(connectionId: string): Promise<void>;
}
```

Your implementation determines:
- How to identify the owner (user, team, organization)
- Which database/ORM to use
- What fields to store
- How to handle authentication

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
      async createConnection(provider, connectionId, metadata) {
        const { data } = await supabase
          .from('nango_connections')
          .insert({ provider, connection_id: connectionId, ...metadata })
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
      async createConnection(provider, connectionId, metadata) {
        return await prisma.nangoConnection.create({
          data: { userId, provider, connectionId, ...metadata }
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
- `POST /api/nango/webhooks` - Handle Nango webhooks
- `PUT /api/nango/connections/[id]` - Update connection status
- `DELETE /api/nango/connections/[id]` - Delete connection

### Components

#### ConnectionManager
Main component for managing OAuth connections.

```tsx
interface ConnectionManagerProps {
  ownerId: string;               // Primary owner ID
  secondaryOwnerId?: string;     // Optional secondary owner
  ownerEmail?: string;           // User email for display
  ownerName?: string;            // User name for display
  providers?: string[];          // List of providers (auto-fetches if not provided)
  onConnectionUpdate?: () => void; // Callback on connection change
  apiEndpoint?: string;          // API endpoint (default: '/api/nango')
  className?: string;            // Additional CSS classes
  showHeader?: boolean;          // Show/hide header (default: true)
  showDescription?: boolean;     // Show/hide descriptions (default: true)
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
  getConnections(): Promise<Connection[]>;

  // Create a new connection record
  createConnection(
    provider: string,
    connectionId: string,
    metadata?: any
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
  ownerId={userId}
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
- Webhook signatures are verified when `NANGO_WEBHOOK_SECRET` is set
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
NANGO_WEBHOOK_SECRET=your-webhook-secret # Optional but recommended
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

## Acknowledgments

Built with:
- [Nango](https://nango.dev) - Unified OAuth for developers
- [Supabase](https://supabase.com) - Open source Firebase alternative
- [Next.js](https://nextjs.org) - The React framework