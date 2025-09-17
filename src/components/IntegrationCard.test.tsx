import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntegrationCard } from './IntegrationCard';

describe('IntegrationCard', () => {
  const defaultProps = {
    provider: 'google_drive',
    onConnect: jest.fn(),
    onDisconnect: jest.fn(),
    isConnecting: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders provider name correctly', () => {
    render(<IntegrationCard {...defaultProps} />);
    expect(screen.getByText('google drive')).toBeInTheDocument();
  });

  it('shows "Not Connected" status when no connection', () => {
    render(<IntegrationCard {...defaultProps} />);
    expect(screen.getByText('Not Connected')).toBeInTheDocument();
  });

  it('shows "Connected" status when connection is active', () => {
    const props = {
      ...defaultProps,
      connection: {
        status: 'ACTIVE' as const,
        lastSync: '2024-01-15T10:00:00Z',
      },
    };
    render(<IntegrationCard {...props} />);
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('shows "Error" status when connection has error', () => {
    const props = {
      ...defaultProps,
      connection: {
        status: 'ERROR' as const,
      },
    };
    render(<IntegrationCard {...props} />);
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('shows "Expired" status when connection is expired', () => {
    const props = {
      ...defaultProps,
      connection: {
        status: 'EXPIRED' as const,
      },
    };
    render(<IntegrationCard {...props} />);
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('displays last sync date when available', () => {
    const props = {
      ...defaultProps,
      connection: {
        status: 'ACTIVE' as const,
        lastSync: '2024-01-15T10:00:00Z',
      },
    };
    render(<IntegrationCard {...props} />);
    expect(screen.getByText(/Last synced:/)).toBeInTheDocument();
  });

  it('shows Connect button when not connected', () => {
    render(<IntegrationCard {...defaultProps} />);
    expect(screen.getByText('Connect')).toBeInTheDocument();
  });

  it('shows Reconnect button when there is an error', () => {
    const props = {
      ...defaultProps,
      connection: {
        status: 'ERROR' as const,
      },
    };
    render(<IntegrationCard {...props} />);
    expect(screen.getByText('Reconnect')).toBeInTheDocument();
  });

  it('shows Refresh and Disconnect buttons when connected', () => {
    const props = {
      ...defaultProps,
      connection: {
        status: 'ACTIVE' as const,
      },
    };
    render(<IntegrationCard {...props} />);
    expect(screen.getByText('Refresh Connection')).toBeInTheDocument();
    expect(screen.getByText('Disconnect')).toBeInTheDocument();
  });

  it('calls onConnect when Connect button is clicked', () => {
    render(<IntegrationCard {...defaultProps} />);
    fireEvent.click(screen.getByText('Connect'));
    expect(defaultProps.onConnect).toHaveBeenCalledTimes(1);
  });

  it('calls onDisconnect when Disconnect button is clicked', () => {
    const props = {
      ...defaultProps,
      connection: {
        status: 'ACTIVE' as const,
      },
    };
    render(<IntegrationCard {...props} />);
    fireEvent.click(screen.getByText('Disconnect'));
    expect(defaultProps.onDisconnect).toHaveBeenCalledTimes(1);
  });

  it('disables buttons when isConnecting is true', () => {
    const props = {
      ...defaultProps,
      isConnecting: true,
    };
    render(<IntegrationCard {...props} />);
    const button = screen.getByText('Connecting...');
    expect(button).toBeDisabled();
  });

  it('does not render Disconnect button when onDisconnect is not provided', () => {
    const props = {
      ...defaultProps,
      onDisconnect: undefined,
      connection: {
        status: 'ACTIVE' as const,
      },
    };
    render(<IntegrationCard {...props} />);
    expect(screen.queryByText('Disconnect')).not.toBeInTheDocument();
  });
});