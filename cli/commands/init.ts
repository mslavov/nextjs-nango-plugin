import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

export async function initCommand() {
  console.log(chalk.blue('🚀 Setting up Nango integration for Next.js'));

  // Check if we're in a Next.js project
  if (!fs.existsSync('next.config.js') && !fs.existsSync('next.config.ts') && !fs.existsSync('next.config.mjs')) {
    console.error(chalk.red('❌ This doesn\'t look like a Next.js project'));
    console.log(chalk.yellow('Please run this command in your Next.js project root directory'));
    process.exit(1);
  }

  // Check for app directory
  if (!fs.existsSync('app')) {
    console.error(chalk.red('❌ No app directory found. This plugin requires Next.js App Router'));
    console.log(chalk.yellow('Please ensure you\'re using Next.js 13+ with App Router'));
    process.exit(1);
  }

  console.log(chalk.blue('\n📂 Creating directories and files...'));

  // Create necessary directories
  const apiPath = path.join('app', 'api', 'nango', '[[...path]]');
  const libPath = 'lib';

  fs.mkdirSync(apiPath, { recursive: true });
  fs.mkdirSync(libPath, { recursive: true });

  // Create config file
  const configPath = path.join(libPath, 'nango-config.ts');
  const configContent = `import { createNangoHandler, type NangoPluginConfig, type ConnectionService } from 'nextjs-nango-plugin';
import { NextRequest } from 'next/server';

/**
 * Example ConnectionService implementation
 *
 * You must implement this class to handle your specific database and ownership model.
 * This example shows the expected interface - adapt it to your database solution.
 */
class MyConnectionService implements ConnectionService {
  constructor(
    private db: any, // Your database client
    private tableName: string,
    private userId: string,
    private organizationId?: string
  ) {}

  async getConnections(filters?: Record<string, any>) {
    // Implement your database query here
    // Example for SQL-based database:
    // const query = this.db.from(this.tableName).select('*').where('owner_id', this.userId);
    // if (this.organizationId) {
    //   query.where('organization_id', this.organizationId);
    // }
    // if (filters) {
    //   Object.entries(filters).forEach(([key, value]) => {
    //     query.where(key, value);
    //   });
    // }
    // return await query;
    throw new Error('getConnections not implemented');
  }

  async createConnection(
    provider: string,
    connectionId: string,
    ownerId: string,
    organizationId?: string,
    metadata?: Record<string, any>
  ) {
    // Implement your database insert here
    // const connection = {
    //   id: generateId(),
    //   owner_id: ownerId,
    //   organization_id: organizationId,
    //   provider,
    //   connection_id: connectionId,
    //   status: 'ACTIVE',
    //   metadata,
    //   created_at: new Date(),
    //   updated_at: new Date()
    // };
    // await this.db.from(this.tableName).insert(connection);
    // return connection;
    throw new Error('createConnection not implemented');
  }

  async updateConnectionStatus(connectionId: string, status: 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'EXPIRED') {
    // Implement your database update here
    // await this.db.from(this.tableName)
    //   .update({ status, updated_at: new Date() })
    //   .where('connection_id', connectionId)
    //   .where('owner_id', this.userId);
    throw new Error('updateConnectionStatus not implemented');
  }

  async deleteConnection(connectionId: string) {
    // Implement your database delete here
    // const result = await this.db.from(this.tableName)
    //   .delete()
    //   .where('connection_id', connectionId)
    //   .where('owner_id', this.userId);
    // return result.rowCount > 0;
    throw new Error('deleteConnection not implemented');
  }
}

/**
 * Nango Plugin Configuration
 *
 * IMPORTANT: You must implement the ConnectionService factory below.
 * This factory should return an instance of your ConnectionService implementation.
 */
export const nangoConfig: NangoPluginConfig = {
  // Factory for creating ConnectionService instances
  createConnectionService: async (request?: NextRequest) => {
    // TODO: Implement your database connection logic here
    //
    // If request is provided, you're handling a user request:
    // 1. Extract user information from the request (e.g., from cookies, headers, JWT)
    // 2. Create a database connection scoped to that user
    //
    // If request is undefined, you're handling webhooks/admin operations:
    // 1. Create a database connection with service account privileges
    //
    // Then return your ConnectionService implementation:

    // Example:
    // const db = await getDB();  // Your database connection
    // const userId = request ? await getUserId(request) : 'system';
    // const organizationId = request ? await getOrgId(request) : undefined;
    // return new MyConnectionService(db, 'nango_connections', userId, organizationId);

    throw new Error('createConnectionService not implemented - you must implement this');
  },

  // Nango configuration
  nango: {
    secretKey: process.env.NANGO_SECRET_KEY!,
    host: process.env.NANGO_HOST || 'https://api.nango.dev',
    webhookSecret: process.env.NANGO_WEBHOOK_SECRET,
  },

  // Optional: limit providers (uncomment and edit if needed)
  // providers: ['github', 'gitlab', 'slack', 'notion'],
};

// Export the handler for use in the route file
export const nangoHandler = createNangoHandler(nangoConfig);
`;

  fs.writeFileSync(configPath, configContent);
  console.log(chalk.green(`✅ Created config: ${configPath}`));

  // Create the minimal route handler
  const routePath = path.join(apiPath, 'route.ts');
  const routeContent = `// This file is generated by nextjs-nango-plugin
// All logic is in the plugin - just wire up the routes
import { nangoHandler } from '@/lib/nango-config';

export const GET = nangoHandler.GET;
export const POST = nangoHandler.POST;
export const PUT = nangoHandler.PUT;
export const DELETE = nangoHandler.DELETE;
`;

  fs.writeFileSync(routePath, routeContent);
  console.log(chalk.green(`✅ Created route: ${routePath}`));

  // Create or update .env.local
  const envPath = '.env.local';
  const envContent = `# Nango Integration Configuration
# Get your keys from: https://app.nango.dev/
NANGO_SECRET_KEY=your-nango-secret-key-here
NANGO_HOST=https://api.nango.dev
# Optional: Add webhook secret for secure webhook handling
# NANGO_WEBHOOK_SECRET=your-webhook-secret-here
`;

  if (fs.existsSync(envPath)) {
    // Check if Nango vars already exist
    const existingEnv = fs.readFileSync(envPath, 'utf8');
    if (!existingEnv.includes('NANGO_SECRET_KEY')) {
      fs.appendFileSync(envPath, '\n' + envContent);
      console.log(chalk.green(`✅ Added Nango configuration to ${envPath}`));
    } else {
      console.log(chalk.yellow(`⚠️  ${envPath} already contains Nango configuration - skipping`));
    }
  } else {
    fs.writeFileSync(envPath, envContent);
    console.log(chalk.green(`✅ Created ${envPath}`));
  }

  // Create a sample page for using the component
  const samplePagePath = path.join('app', 'integrations', 'page.tsx');
  if (!fs.existsSync(path.dirname(samplePagePath))) {
    fs.mkdirSync(path.dirname(samplePagePath), { recursive: true });

    const samplePageContent = `'use client';

import { ConnectionManager } from 'nextjs-nango-plugin';
import { useEffect, useState } from 'react';

export default function IntegrationsPage() {
  const [sessionData, setSessionData] = useState<any>(null);

  useEffect(() => {
    // TODO: Replace this with your actual session/user data logic
    // The session data should match what your ConnectionService implementation expects
    // For example, get it from your auth provider (NextAuth, Clerk, Supabase Auth, etc.)

    // Example session data - adapt to your needs:
    setSessionData({
      id: 'user-123',
      email: 'user@example.com',
      name: 'John Doe',
      // Add any other fields your implementation needs
      // organizationId: 'org-456',
      // teamId: 'team-789',
    });
  }, []);

  if (!sessionData) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Integrations</h1>
      <ConnectionManager
        sessionData={sessionData}
        // Optional: Specify providers (otherwise fetches from Nango)
        // providers={['github', 'gitlab', 'slack', 'notion']}
        onConnectionUpdate={() => {
          console.log('Connection updated!');
        }}
      />
    </div>
  );
}
`;

    fs.writeFileSync(samplePagePath, samplePageContent);
    console.log(chalk.green(`✅ Created sample page: ${samplePagePath}`));
  }

  console.log(chalk.green('\n✅ Nango integration set up successfully!'));
  console.log(chalk.yellow('\n📋 Next steps:'));

  console.log(chalk.cyan('\n1. Configure Nango credentials:'));
  console.log('   Edit ' + chalk.white('.env.local') + ' and add your Nango secret key');
  console.log('   Get your keys from: ' + chalk.white('https://app.nango.dev/'));

  console.log(chalk.cyan('\n2. Implement ConnectionService:'));
  console.log('   Edit ' + chalk.white('lib/nango-config.ts') + ' to:');
  console.log('   - Implement the ' + chalk.white('MyConnectionService') + ' class methods for your database');
  console.log('   - Update ' + chalk.white('createConnectionService') + ' factory to return your implementation');

  console.log(chalk.cyan('\n3. Create your database schema:'));
  console.log('   Create a table for storing Nango connections with these fields:');
  console.log('   - id (primary key)');
  console.log('   - owner_id (string, required) - User/entity that owns this connection');
  console.log('   - organization_id (string, optional) - For multi-tenant scenarios');
  console.log('   - provider (string)');
  console.log('   - connection_id (string, unique)');
  console.log('   - status (enum: ACTIVE, INACTIVE, ERROR, EXPIRED)');
  console.log('   - metadata (JSON/JSONB, optional) - For custom data');
  console.log('   - created_at (timestamp)');
  console.log('   - updated_at (timestamp)');

  console.log(chalk.cyan('\n4. Configure Nango webhook (optional):'));
  console.log('   In your Nango dashboard, set webhook URL to:');
  console.log('   ' + chalk.white('https://your-app.com/api/nango/webhooks'));
  console.log('   Add the webhook secret to your .env.local file');

  console.log(chalk.cyan('\n5. Test the integration:'));
  console.log('   Start your dev server: ' + chalk.white('npm run dev'));
  console.log('   Visit ' + chalk.white('/integrations') + ' to see your connection manager');

  console.log(chalk.blue('\n📚 For more information:'));
  console.log('   Plugin docs: ' + chalk.white('https://github.com/your-org/nextjs-nango-plugin'));
  console.log('   Nango docs: ' + chalk.white('https://docs.nango.dev/'));
}