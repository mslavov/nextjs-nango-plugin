import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConnectionManager } from './ConnectionManager';

jest.mock('@nangohq/frontend', () => ({
  default: jest.fn().mockImplementation(() => ({
    openConnectUI: jest.fn(),
  })),
}));

global.fetch = jest.fn() as jest.Mock;

describe('ConnectionManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  it('renders loading state initially', () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));

    render(<ConnectionManager />);
    expect(screen.getByText('Loading integrations...')).toBeInTheDocument();
  });

  it('fetches and displays available integrations', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 'google_drive' },
          { id: 'slack' },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

    render(<ConnectionManager />);

    await waitFor(() => {
      expect(screen.getByText('google drive')).toBeInTheDocument();
      expect(screen.getByText('slack')).toBeInTheDocument();
    });
  });

  it('uses provided providers instead of fetching', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    const providers = ['github', 'gitlab'];
    render(<ConnectionManager providers={providers} />);

    await waitFor(() => {
      expect(screen.getByText('github')).toBeInTheDocument();
      expect(screen.getByText('gitlab')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('/api/nango/connections');
  });

  it('displays existing connections', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'google_drive' }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            provider: 'google_drive',
            status: 'ACTIVE',
            connection_id: 'conn_123',
            last_sync_at: '2024-01-15T10:00:00Z',
          },
        ],
      });

    render(<ConnectionManager />);

    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(screen.getByText(/Last synced:/)).toBeInTheDocument();
    });
  });

  it('handles connection flow', async () => {
    // Mock the Nango frontend module before the component uses it
    jest.doMock('@nangohq/frontend', () => ({
      default: jest.fn().mockImplementation(() => ({
        openConnectUI: jest.fn(({ onEvent }) => {
          // Simulate successful connection
          setTimeout(() => onEvent({ type: 'connect' }), 0);
        }),
      })),
    }));

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'slack' }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionToken: 'test-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            provider: 'slack',
            status: 'ACTIVE',
            connection_id: 'conn_456',
          },
        ],
      });

    const onConnectionUpdate = jest.fn();
    render(<ConnectionManager onConnectionUpdate={onConnectionUpdate} />);

    await waitFor(() => {
      expect(screen.getByText('slack')).toBeInTheDocument();
    });

    const connectButton = screen.getByText('Connect');
    fireEvent.click(connectButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/nango/auth/session', expect.any(Object));
    });
  });

  it('handles disconnection', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'github' }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            provider: 'github',
            status: 'ACTIVE',
            connection_id: 'conn_789',
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => {},
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

    const onConnectionUpdate = jest.fn();
    render(<ConnectionManager onConnectionUpdate={onConnectionUpdate} />);

    await waitFor(() => {
      expect(screen.getByText('Disconnect')).toBeInTheDocument();
    });

    const disconnectButton = screen.getByText('Disconnect');
    fireEvent.click(disconnectButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/nango/connections/conn_789', {
        method: 'DELETE',
      });
      expect(onConnectionUpdate).toHaveBeenCalled();
    });
  });

  it('displays error when fetching connections fails', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'slack' }],
      })
      .mockRejectedValueOnce(new Error('Network error'));

    render(<ConnectionManager />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load connections')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('displays message when no integrations available', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

    render(<ConnectionManager />);

    await waitFor(() => {
      expect(screen.getByText(/No integrations available/)).toBeInTheDocument();
    });
  });

  it('uses custom API endpoint', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

    render(<ConnectionManager apiEndpoint="/custom/api" providers={['test']} />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/custom/api/connections');
    });
  });

  it('passes session data when connecting', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionToken: 'test-token' }),
      });

    const sessionData = { email: 'test@example.com', name: 'Test User' };
    render(<ConnectionManager providers={['slack']} sessionData={sessionData} />);

    await waitFor(() => {
      expect(screen.getByText('Connect')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Connect'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/nango/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integrationId: 'slack',
          ...sessionData,
        }),
      });
    });
  });
});