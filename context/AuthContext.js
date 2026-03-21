import React, { createContext, useContext, useState } from 'react';
import {
  AUTH_API_BASE_URL,
  MOBILE_CLIENT_PLATFORM_HEADER,
  MOBILE_DRIVER_CLIENT_PLATFORM,
  buildBackendEndpointUrl,
} from '@/constants/AuthClient';

const DRIVER_ROLE = 'DRIVER';
const MISSING_AUTH_API_BASE_URL_ERROR_MESSAGE =
  'Configuración faltante: define EXPO_PUBLIC_AUTH_API_BASE_URL para usar esta app.';

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   email: string,
 *   role: string,
 *   passwordSetRequired: boolean
 * }} AuthUser
 */

/** @typedef {'unauthenticated' | 'authenticated'} AuthStatus */

/**
 * @typedef {{
 *   status: AuthStatus,
 *   accessToken: string,
 *   user: AuthUser | null,
 *   requiresPasswordChange: boolean
 * }} AuthState
 */

/**
 * @typedef {{
 *   user: AuthUser | null,
 *   accessToken: string,
 *   status: AuthStatus,
 *   isAuthenticated: boolean,
 *   requiresPasswordChange: boolean,
 *   isInitializing: boolean,
 *   isSubmitting: boolean,
 *   login: (credentials: {email: string, password: string}) => Promise<AuthUser>,
 *   refreshAccessToken: () => Promise<string>,
 *   changePassword: (payload: {
 *     currentPassword: string,
 *     newPassword: string,
 *     newPasswordConfirm: string
 *   }) => Promise<void>,
 *   logout: () => Promise<void>
 * }} AuthContextValue
 */

/** @type {AuthState} */
const defaultAuthState = {
  status: 'unauthenticated',
  accessToken: '',
  user: null,
  requiresPasswordChange: false,
};

const AuthContext = createContext(/** @type {AuthContextValue | null} */ (null));

/**
 * Provider that manages mobile authentication state for driver-only access.
 *
 * @param {{children: import('react').ReactNode}} props - Provider props.
 * @returns {import('react').ReactElement} Auth context provider.
 */
export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState(defaultAuthState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Authenticate the current driver session.
   *
   * @param {{email: string, password: string}} credentials - Driver credentials.
   * @returns {Promise<AuthUser>} Authenticated user payload.
   */
  async function login(credentials) {
    const normalizedEmail = String(credentials?.email ?? '')
      .trim()
      .toLowerCase();
    const normalizedPassword = String(credentials?.password ?? '').trim();

    if (!normalizedEmail || !normalizedPassword) {
      throw new Error('Debes ingresar correo y contraseña.');
    }
    assertAuthApiBaseUrlConfigured();

    setIsSubmitting(true);
    try {
      const payload = await loginWithApi({
        email: normalizedEmail,
        password: normalizedPassword,
      });

      setAuthState({
        status: 'authenticated',
        accessToken: payload.accessToken,
        user: payload.user,
        requiresPasswordChange: Boolean(payload.user?.passwordSetRequired),
      });

      return payload.user;
    } catch (error) {
      setAuthState(defaultAuthState);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }

  /**
   * Clear the authenticated session and return to login flow.
   */
  async function logout() {
    setAuthState(defaultAuthState);
  }

  /**
   * Renew short-lived access token from refresh-cookie session.
   *
   * @returns {Promise<string>} Fresh access token.
   */
  async function refreshAccessToken() {
    if (!authState.user || authState.status !== 'authenticated') {
      throw new Error('No hay una sesión activa para renovar.');
    }

    assertAuthApiBaseUrlConfigured();

    /** @type {any} */
    let refreshPayload;
    try {
      refreshPayload = await requestAuthApi({
        path: '/api/auth/refresh/',
        method: 'POST',
        unauthorizedErrorMessage: 'Tu sesión expiró. Inicia sesión nuevamente.',
        fallbackErrorMessage: 'No se pudo renovar la sesión.',
      });
    } catch (error) {
      setAuthState(defaultAuthState);
      throw error;
    }

    const nextAccessToken = String(refreshPayload?.['access_token'] ?? '').trim();
    if (!nextAccessToken) {
      setAuthState(defaultAuthState);
      throw new Error('No se pudo renovar la sesión.');
    }

    setAuthState((currentAuthState) => {
      if (currentAuthState.status !== 'authenticated' || !currentAuthState.user) {
        return currentAuthState;
      }
      return {
        ...currentAuthState,
        accessToken: nextAccessToken,
      };
    });

    return nextAccessToken;
  }

  /**
   * Rotate password for an authenticated driver who must update credentials.
   *
   * @param {{
   *   currentPassword: string,
   *   newPassword: string,
   *   newPasswordConfirm: string
   * }} payload - Password change form fields.
   */
  async function changePassword(payload) {
    const currentPassword = String(payload?.currentPassword ?? '').trim();
    const newPassword = String(payload?.newPassword ?? '').trim();
    const newPasswordConfirm = String(payload?.newPasswordConfirm ?? '').trim();

    if (!authState.accessToken || !authState.user) {
      throw new Error('Debes iniciar sesión antes de actualizar tu contraseña.');
    }
    if (!currentPassword || !newPassword || !newPasswordConfirm) {
      throw new Error('Debes completar todos los campos de contraseña.');
    }
    assertAuthApiBaseUrlConfigured();

    setIsSubmitting(true);
    try {
      await changePasswordWithApi({
        accessToken: authState.accessToken,
        currentPassword,
        newPassword,
        newPasswordConfirm,
      });

      setAuthState(
        /**
         * @param {AuthState} currentAuthState
         * @returns {AuthState}
         */
        (currentAuthState) => {
          /** @type {AuthUser | null} */
          let nextUser = null;
          if (currentAuthState.user) {
            nextUser = {
              id: currentAuthState.user.id,
              name: currentAuthState.user.name,
              email: currentAuthState.user.email,
              role: currentAuthState.user.role,
              passwordSetRequired: false,
            };
          }

          return {
            status: currentAuthState.status,
            accessToken: currentAuthState.accessToken,
            user: nextUser,
            requiresPasswordChange: false,
          };
        },
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  /** @type {AuthContextValue} */
  const contextValue = {
    user: authState.user,
    accessToken: authState.accessToken,
    status: authState.status,
    isAuthenticated: authState.status === 'authenticated' && Boolean(authState.user),
    requiresPasswordChange: authState.requiresPasswordChange,
    isInitializing: false,
    isSubmitting,
    login,
    refreshAccessToken,
    changePassword,
    logout,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

/**
 * Access current authentication context.
 *
 * @returns {AuthContextValue} Auth context value.
 */
export function useAuth() {
  const contextValue = useContext(AuthContext);
  if (!contextValue) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return contextValue;
}

/**
 * Authenticate against backend auth endpoints.
 *
 * @param {{email: string, password: string}} params - Driver credentials.
 * @returns {Promise<{accessToken: string, user: AuthUser}>} Session payload.
 */
async function loginWithApi({ email, password }) {
  const loginPayload = await requestAuthApi({
    path: '/api/auth/login/',
    method: 'POST',
    body: {
      email,
      password,
    },
    fallbackErrorMessage: 'No se pudo iniciar sesión.',
  });

  const accessToken = String(loginPayload?.['access_token'] ?? '').trim();
  if (!accessToken) {
    throw new Error('No pudimos iniciar sesión. Intenta nuevamente.');
  }

  const validationPayload = await requestAuthApi({
    path: '/api/auth/validate/',
    method: 'GET',
    accessToken,
    fallbackErrorMessage: 'No se pudo validar la sesión.',
  });

  const user = normalizeUserPayload(validationPayload?.['user'], email);
  if (user.role !== DRIVER_ROLE) {
    throw new Error('Esta app móvil solo permite cuentas de conductor.');
  }

  return {
    accessToken,
    user,
  };
}

/**
 * Rotate one authenticated driver password through auth API.
 *
 * @param {{
 *   accessToken: string,
 *   currentPassword: string,
 *   newPassword: string,
 *   newPasswordConfirm: string
 * }} params - Password change payload.
 */
async function changePasswordWithApi({
  accessToken,
  currentPassword,
  newPassword,
  newPasswordConfirm,
}) {
  await requestAuthApi({
    path: '/api/auth/password/change/',
    method: 'POST',
    accessToken,
    body: {
      current_password: currentPassword,
      new_password: newPassword,
      new_password_confirm: newPasswordConfirm,
    },
    unauthorizedErrorMessage: 'Tu sesión expiró. Inicia sesión nuevamente.',
    fallbackErrorMessage: 'No se pudo actualizar la contraseña.',
  });
}

/**
 * Request one auth endpoint and normalize server-side error messages.
 *
 * @param {{
 *   path: string,
 *   method: 'GET' | 'POST',
 *   body?: Record<string, unknown>,
 *   accessToken?: string,
 *   unauthorizedErrorMessage?: string,
 *   fallbackErrorMessage: string
 * }} params - HTTP request config.
 * @returns {Promise<any>} Parsed JSON payload.
 */
async function requestAuthApi({
  path,
  method,
  body,
  accessToken,
  unauthorizedErrorMessage,
  fallbackErrorMessage,
}) {
  assertAuthApiBaseUrlConfigured();
  const endpoint = buildBackendEndpointUrl(path);
  const headers = {
    Accept: 'application/json',
    [MOBILE_CLIENT_PLATFORM_HEADER]: MOBILE_DRIVER_CLIENT_PLATFORM,
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(endpoint, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      resolveApiErrorMessage({
        statusCode: response.status,
        payload,
        unauthorizedErrorMessage,
        fallbackErrorMessage,
      }),
    );
  }

  return payload;
}

/**
 * Enforce backend auth base URL presence before issuing auth requests.
 *
 * @throws {Error} When auth API base URL is missing.
 */
function assertAuthApiBaseUrlConfigured() {
  if (!AUTH_API_BASE_URL) {
    throw new Error(MISSING_AUTH_API_BASE_URL_ERROR_MESSAGE);
  }
}

/**
 * Resolve user-friendly auth error message by HTTP status.
 *
 * @param {{
 *   statusCode: number,
 *   payload: any,
 *   unauthorizedErrorMessage?: string,
 *   fallbackErrorMessage: string
 * }} params - Error context.
 * @returns {string} User-facing error text.
 */
function resolveApiErrorMessage({
  statusCode,
  payload,
  unauthorizedErrorMessage,
  fallbackErrorMessage,
}) {
  const apiMessage = extractFirstApiErrorMessage(payload);
  if (statusCode === 400 && apiMessage) {
    return apiMessage;
  }
  if (statusCode === 401) {
    return unauthorizedErrorMessage || 'Correo o contraseña incorrectos.';
  }
  if (statusCode === 403) {
    return 'Tu cuenta no tiene acceso a esta aplicación.';
  }
  if (apiMessage) {
    return apiMessage;
  }
  return fallbackErrorMessage;
}

/**
 * Normalize raw user payload into a safe driver session object.
 *
 * @param {any} userCandidate - Raw backend or demo user object.
 * @param {string} fallbackEmail - Fallback email used when payload is incomplete.
 * @returns {AuthUser} Normalized user.
 */
function normalizeUserPayload(userCandidate, fallbackEmail) {
  const normalizedRole = normalizeRole(userCandidate?.role);

  return {
    id: String(userCandidate?.id ?? userCandidate?.uuid ?? 'driver'),
    name: String(userCandidate?.name ?? userCandidate?.['full_name'] ?? 'Conductor'),
    email: String(userCandidate?.email ?? fallbackEmail ?? '')
      .trim()
      .toLowerCase(),
    role: normalizedRole,
    passwordSetRequired: normalizeBoolean(
      userCandidate?.['password_set_required'] ?? userCandidate?.passwordSetRequired,
    ),
  };
}

/**
 * Extract one readable error message from API validation payloads.
 *
 * @param {any} payloadCandidate - Raw response payload.
 * @returns {string} First available error message.
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
      const message = value[0].trim();
      if (message) {
        return message;
      }
    }
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

/**
 * Normalize unknown role into application-supported values.
 *
 * @param {unknown} roleCandidate - Raw role value.
 * @returns {string} Normalized role or empty string.
 */
function normalizeRole(roleCandidate) {
  const normalizedRole = String(roleCandidate ?? '')
    .trim()
    .toUpperCase();
  return normalizedRole === DRIVER_ROLE ? normalizedRole : '';
}

/**
 * Convert unknown boolean-like values into strict booleans.
 *
 * @param {unknown} value - Raw boolean candidate.
 * @returns {boolean} Normalized boolean value.
 */
function normalizeBoolean(value) {
  return Boolean(value);
}
