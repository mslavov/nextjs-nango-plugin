# Next.js Nango Plugin Example

This is a demonstration of the `nextjs-nango-plugin` in a Next.js application.

## ⚠️ Important Note

This example uses **in-memory storage** for the ConnectionService, which means:
- Data will be lost when the server restarts
- It's for demonstration purposes only
- In production, you must implement a real database

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Nango Credentials

Edit `.env.local` and add your actual Nango credentials:

```env
NANGO_SECRET_KEY=your-actual-nango-secret-key
NANGO_HOST=https://api.nango.dev
```

Get your credentials from [https://app.nango.dev/](https://app.nango.dev/)

### 3. Run the Development Server

```bash
npm run dev
```

### 4. Test the Integration

Visit [http://localhost:3000/integrations](http://localhost:3000/integrations) to see the ConnectionManager component.

## What's Included

- **`/app/api/nango/[[...path]]/route.ts`** - API routes that handle all Nango requests
- **`/lib/nango-config.ts`** - Configuration and in-memory ConnectionService implementation
- **`/app/integrations/page.tsx`** - Example page using the ConnectionManager component
- **`.env.local`** - Environment variables for Nango configuration

## Production Implementation

For production use, you need to:

### 1. Implement Real Database Storage

Replace the `InMemoryConnectionService` in `/lib/nango-config.ts` with your actual database implementation:

```typescript
class MyConnectionService implements ConnectionService {
  constructor(private userId: string, private db: DatabaseClient) {}

  async getConnections(): Promise<Connection[]> {
    // Query your database
    return await this.db
      .from('nango_connections')
      .select('*')
      .where('owner_id', this.userId);
  }

  // ... implement other methods
}
```

### 2. Implement User Authentication

Update the `createConnectionService` factory to extract the real user ID:

```typescript
createConnectionService: async (request?: NextRequest) => {
  // Example with NextAuth
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  // Or with Clerk
  const { userId } = auth();

  // Or from JWT
  const token = request?.cookies.get('token');
  const { userId } = verifyJWT(token);

  return new MyConnectionService(userId, db);
}
```

### 3. Create Database Schema

Create a table for storing connections:

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

### 4. Configure Webhooks (Optional)

In your Nango dashboard:
1. Set webhook URL to: `https://your-app.com/api/nango/webhooks`
2. Add the webhook secret to `.env.local`:
   ```env
   NANGO_WEBHOOK_SECRET=your-webhook-secret
   ```

## Troubleshooting

### "Connection not found" errors
The in-memory storage resets on server restart. Refresh the page to create new connections.

### "NANGO_SECRET_KEY is not defined"
Make sure you've added your actual Nango credentials to `.env.local`

### TypeScript errors
Ensure you've run `npm install` and that the plugin is properly linked.

## Next Steps

1. Implement a real database connection service
2. Add proper user authentication
3. Configure webhook handling for sync updates
4. Add error handling and logging
5. Implement connection refresh logic

## Resources

- [Nango Documentation](https://docs.nango.dev/)
- [Plugin Documentation](https://github.com/your-org/nextjs-nango-plugin)
- [Next.js Documentation](https://nextjs.org/docs)