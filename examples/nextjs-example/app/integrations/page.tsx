'use client';

import { ConnectionManager } from 'nextjs-nango-plugin';
import { useEffect, useState } from 'react';

export default function IntegrationsPage() {
  const [sessionData, setSessionData] = useState<any>(null);

  useEffect(() => {
    // TODO: Replace this with your actual session/user data logic
    // For example, get it from your auth provider (NextAuth, Clerk, Supabase Auth, etc.)

    // Session data must match Nango's API structure:
    setSessionData({
      end_user: {
        id: 'user-123',  // Required
        email: 'user@example.com',  // Optional
        display_name: 'John Doe'  // Optional
      },
      // Optional organization info
      organization: {
        id: 'org-456',
        display_name: 'Acme Corp'
      }
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
