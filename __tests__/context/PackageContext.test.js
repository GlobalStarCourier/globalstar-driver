import React from 'react';
import { Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';

import { useAuth } from '@/context/AuthContext';
import { PackageProvider, usePackages } from '@/context/PackageContext';

jest.mock('@/constants/AuthClient', () => ({
  AUTH_API_BASE_URL: 'https://backend.test',
  MOBILE_CLIENT_PLATFORM_HEADER: 'X-Client-Platform',
  MOBILE_DRIVER_CLIENT_PLATFORM: 'MOBILE_DRIVER',
  buildBackendEndpointUrl: jest.fn(),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const { buildBackendEndpointUrl: mockBuildBackendEndpointUrl } =
  jest.requireMock('@/constants/AuthClient');

/**
 * Build a minimal assigned-orders payload for provider normalization tests.
 *
 * @returns {{driver: Record<string, unknown>, assigned_orders: Array<Record<string, unknown>>}}
 */
function buildAssignedOrdersPayload() {
  return {
    driver: {
      rut: '123456789',
    },
    assigned_orders: [
      {
        order_id: '550e8400-e29b-41d4-a716-446655440000',
        order_code: 'ORD-001',
        sequence: 1,
        status: 'CREADO',
        receiver_name: 'Cliente Demo',
        receiver_phone: '+56911111111',
        address: 'Av. Apoquindo 1234, Las Condes, RM',
        address_type: 'PICKUP',
        created_at: '2026-03-21T12:00:00.000Z',
      },
    ],
  };
}

describe('PackageContext', () => {
  /** @type {any} */
  let packageContextValue = null;
  const originalFetch = global.fetch;
  /** @type {jest.Mock} */
  let refreshAccessTokenMock = jest.fn();

  function PackageContextProbe() {
    packageContextValue = usePackages();
    return <Text testID="packages-count">{String(packageContextValue.packages.length)}</Text>;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    packageContextValue = null;
    mockBuildBackendEndpointUrl.mockClear();
    mockBuildBackendEndpointUrl.mockImplementation(function () {
      return `https://backend.test${String(arguments[0] ?? '')}`;
    });
    refreshAccessTokenMock = jest.fn().mockResolvedValue('fresh-driver-token');
    useAuth.mockReturnValue({
      accessToken: 'driver-token',
      isAuthenticated: true,
      requiresPasswordChange: false,
      refreshAccessToken: refreshAccessTokenMock,
    });
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('keeps existing packages when refresh request fails', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => buildAssignedOrdersPayload(),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ detail: 'Service unavailable' }),
      });

    const { getByTestId } = render(
      <PackageProvider>
        <PackageContextProbe />
      </PackageProvider>,
    );

    await waitFor(() => {
      expect(getByTestId('packages-count')).toHaveTextContent('1');
      expect(packageContextValue).not.toBeNull();
    });

    await act(async () => {
      await packageContextValue.fetchPackages();
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(getByTestId('packages-count')).toHaveTextContent('1');
    });
  });

  it('refreshes access token and retries assigned-orders request on 401', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Given token not valid for any token type' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => buildAssignedOrdersPayload(),
      });

    const { getByTestId } = render(
      <PackageProvider>
        <PackageContextProbe />
      </PackageProvider>,
    );

    await waitFor(() => {
      expect(getByTestId('packages-count')).toHaveTextContent('1');
    });

    expect(refreshAccessTokenMock).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(mockBuildBackendEndpointUrl).toHaveBeenCalledWith(
      '/api/shipments/routes/mobile/assigned-orders/',
    );
    expect(global.fetch.mock.calls[0][1].credentials).toBe('include');
    expect(global.fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer fresh-driver-token');
  });
});
