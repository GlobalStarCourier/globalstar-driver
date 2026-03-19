import React, { createContext, useContext, useEffect, useState } from 'react';

import {
  AUTH_API_BASE_URL,
  MOBILE_CLIENT_PLATFORM_HEADER,
  MOBILE_DRIVER_CLIENT_PLATFORM,
  buildBackendEndpointUrl,
} from '@/constants/AuthClient';
import { useAuth } from '@/context/AuthContext';

const DRIVER_ASSIGNED_ORDERS_PATH = '/api/shipments/routes/mobile/assigned-orders/';

/**
 * @typedef {{
 *   id: string,
 *   orderId: string,
 *   customerName: string,
 *   address: string,
 *   phone: string,
 *   status: string,
 *   trackingNumber: string,
 *   pickupLocation: string,
 *   sequence: number,
 *   backendStatus: string,
 *   completedAt?: string
 * }} DriverPackage
 */

/**
 * @typedef {{
 *   packages: DriverPackage[],
 *   loading: boolean,
 *   fetchPackages: () => Promise<void>,
 *   updatePackageStatus: (id: string, status: string) => void,
 *   updatePackagePhotos: (id: string, photos: Record<string, unknown>) => void,
 *   addPackage: (newPackage: DriverPackage) => void
 * }} PackageContextValue
 */

const PackageContext = createContext(/** @type {PackageContextValue | null} */ (null));

/**
 * Access package context for driver-route screens.
 *
 * @returns {PackageContextValue} Package context value.
 */
export function usePackages() {
  const contextValue = useContext(PackageContext);
  if (!contextValue) {
    throw new Error('usePackages must be used inside PackageProvider.');
  }
  return contextValue;
}

/**
 * Provider that loads assigned driver orders from backend mobile endpoint.
 *
 * @param {{children: import('react').ReactNode}} props - Provider props.
 * @returns {import('react').ReactElement} Package context provider.
 */
export function PackageProvider({ children }) {
  const { accessToken, isAuthenticated, requiresPasswordChange } = useAuth();
  const [packages, setPackages] = useState(/** @type {DriverPackage[]} */ ([]));
  const [loading, setLoading] = useState(true);

  /**
   * Fetch latest mobile-driver assigned orders and normalize them for UI screens.
   */
  async function fetchPackages() {
    await loadAssignedPackages({
      accessToken,
      isAuthenticated,
      requiresPasswordChange,
      setPackages,
      setLoading,
    });
  }

  useEffect(() => {
    void loadAssignedPackages({
      accessToken,
      isAuthenticated,
      requiresPasswordChange,
      setPackages,
      setLoading,
    });
  }, [accessToken, isAuthenticated, requiresPasswordChange]);

  /**
   * Apply one local status transition for package UI interactions.
   *
   * @param {string} id - Package identifier.
   * @param {string} status - New local status code.
   */
  function updatePackageStatus(id, status) {
    setPackages((currentPackages) =>
      currentPackages.map((currentPackage) =>
        currentPackage.id === id
          ? {
              ...currentPackage,
              status,
              completedAt:
                status === 'recogido' ? new Date().toISOString() : currentPackage.completedAt,
            }
          : currentPackage,
      ),
    );
  }

  /**
   * Attach local photo metadata to one package row.
   *
   * @param {string} id - Package identifier.
   * @param {Record<string, unknown>} photos - Photo metadata map.
   */
  function updatePackagePhotos(id, photos) {
    setPackages((currentPackages) =>
      currentPackages.map((currentPackage) =>
        currentPackage.id === id ? { ...currentPackage, ...photos } : currentPackage,
      ),
    );
  }

  /**
   * Append one locally created package row.
   *
   * @param {DriverPackage} newPackage - Package row to append.
   */
  function addPackage(newPackage) {
    setPackages((currentPackages) => [...currentPackages, newPackage]);
  }

  /** @type {PackageContextValue} */
  const contextValue = {
    packages,
    loading,
    fetchPackages,
    updatePackageStatus,
    updatePackagePhotos,
    addPackage,
  };

  return <PackageContext.Provider value={contextValue}>{children}</PackageContext.Provider>;
}

/**
 * Load assigned packages into provider state according to auth/session flags.
 *
 * @param {{
 *   accessToken: string,
 *   isAuthenticated: boolean,
 *   requiresPasswordChange: boolean,
 *   setPackages: React.Dispatch<React.SetStateAction<DriverPackage[]>>,
 *   setLoading: React.Dispatch<React.SetStateAction<boolean>>
 * }} params - Provider-state setters and auth state.
 */
async function loadAssignedPackages({
  accessToken,
  isAuthenticated,
  requiresPasswordChange,
  setPackages,
  setLoading,
}) {
  if (!AUTH_API_BASE_URL || !isAuthenticated || !accessToken || requiresPasswordChange) {
    setPackages([]);
    setLoading(false);
    return;
  }

  setLoading(true);
  try {
    const assignedOrdersPayload = await requestDriverAssignedOrders({
      accessToken,
    });
    const normalizedPackages = mapAssignedOrdersToPackages(
      assignedOrdersPayload?.['assigned_orders'],
    );
    setPackages(normalizedPackages);
  } catch (_error) {
    setPackages([]);
  } finally {
    setLoading(false);
  }
}

/**
 * Request one backend endpoint that returns assigned mobile-driver orders.
 *
 * @param {{accessToken: string}} params - Auth request params.
 * @returns {Promise<any>} Backend response payload.
 */
async function requestDriverAssignedOrders({ accessToken }) {
  const response = await fetch(buildBackendEndpointUrl(DRIVER_ASSIGNED_ORDERS_PATH), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      [MOBILE_CLIENT_PLATFORM_HEADER]: MOBILE_DRIVER_CLIENT_PLATFORM,
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractFirstApiErrorMessage(payload) || 'No se pudo cargar la ruta asignada.');
  }

  return payload;
}

/**
 * Convert API assignments into the package rows expected by existing screens.
 *
 * @param {any} assignedOrdersCandidate - Raw assigned-orders payload.
 * @returns {DriverPackage[]} Normalized package list.
 */
/**
 * @typedef {{
 *   order_id?: unknown,
 *   receiver_name?: unknown,
 *   receiver_phone?: unknown,
 *   order_code?: unknown,
 *   address_type?: unknown,
 *   address?: unknown,
 *   status?: unknown,
 *   created_at?: unknown,
 *   requested_at?: unknown,
 *   sequence?: unknown
 * }} RawAssignedOrder
 */
function mapAssignedOrdersToPackages(assignedOrdersCandidate) {
  if (!Array.isArray(assignedOrdersCandidate)) {
    return [];
  }

  const mappedPackages = assignedOrdersCandidate.map((rawOrder, index) => {
    const safeRawOrder =
      rawOrder && typeof rawOrder === 'object' ? /** @type {RawAssignedOrder} */ (rawOrder) : {};
    const {
      status: backendStatusCandidate,
      created_at: createdAtRaw,
      requested_at: requestedAtRaw,
      order_id: orderIdRaw,
      receiver_name: receiverNameRaw,
      address: addressRaw,
      receiver_phone: receiverPhoneRaw,
      order_code: orderCodeRaw,
      address_type: addressTypeRaw,
      sequence: sequenceRaw,
    } = safeRawOrder;

    const mappedStatus = mapBackendStatusToPackageStatus(backendStatusCandidate);
    const completedAt =
      mappedStatus === 'recogido' || mappedStatus === 'entregado' || mappedStatus === 'rechazado'
        ? String(createdAtRaw ?? requestedAtRaw ?? new Date().toISOString())
        : undefined;

    return {
      id: String(orderIdRaw ?? `order-${index}`),
      orderId: String(orderIdRaw ?? ''),
      customerName: String(receiverNameRaw ?? 'Cliente'),
      address: String(addressRaw ?? 'Dirección no disponible'),
      phone: String(receiverPhoneRaw ?? ''),
      status: mappedStatus,
      trackingNumber: String(orderCodeRaw ?? `ORD-${index + 1}`),
      pickupLocation: String(addressTypeRaw ?? ''),
      sequence: Number(sequenceRaw ?? index + 1),
      backendStatus: String(backendStatusCandidate ?? ''),
      completedAt,
    };
  });

  return mappedPackages.sort((leftOrder, rightOrder) => leftOrder.sequence - rightOrder.sequence);
}

/**
 * Normalize backend shipment statuses into existing mobile status tabs.
 *
 * @param {unknown} backendStatusCandidate - Raw backend status code.
 * @returns {string} Mobile status code.
 */
function mapBackendStatusToPackageStatus(backendStatusCandidate) {
  const backendStatus = String(backendStatusCandidate ?? '')
    .trim()
    .toUpperCase();

  if (backendStatus === 'RETIRADO') {
    return 'recogido';
  }
  if (backendStatus === 'EN_BODEGA') {
    return 'distribucion';
  }
  if (backendStatus === 'EN_RUTA') {
    return 'ruta';
  }
  if (backendStatus === 'ENTREGADO') {
    return 'entregado';
  }
  if (backendStatus === 'INCIDENCIA' || backendStatus === 'CANCELADO') {
    return 'rechazado';
  }
  return 'pendiente';
}

/**
 * Extract one readable message from API payloads.
 *
 * @param {any} payloadCandidate - Raw backend payload.
 * @returns {string} First available API message.
 */
function extractFirstApiErrorMessage(payloadCandidate) {
  if (!payloadCandidate || typeof payloadCandidate !== 'object') {
    return '';
  }
  if (typeof payloadCandidate.detail === 'string' && payloadCandidate.detail.trim()) {
    return payloadCandidate.detail.trim();
  }

  for (const value of Object.values(payloadCandidate)) {
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
      return value[0].trim();
    }
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}
