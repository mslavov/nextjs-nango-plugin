'use client';

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
