import React, { createContext, useContext, useMemo, useState } from 'react';

const DRIVER_ROLE = 'DRIVER';
const DEFAULT_DEMO_EMAIL = 'conductor@globalstar.cl';
const DEFAULT_DEMO_PASSWORD = '123456';
const AUTH_API_BASE_URL = String(process.env.EXPO_PUBLIC_AUTH_API_BASE_URL ?? '').trim();

const defaultAuthState = {
  status: 'unauthenticated',
  accessToken: '',
  user: null,
};

const AuthContext = createContext(null);

/**
 * Provider that manages mobile authentication state for driver-only access.
 *
 * @param {{children: import('react').ReactNode}} props - Provider props.
 * @returns {import('react').JSX.Element} Auth context provider.
 */
export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState(defaultAuthState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Authenticate the current driver session.
   *
   * @param {{email: string, password: string}} credentials - Driver credentials.
   * @returns {Promise<Record<string, unknown>>} Authenticated user payload.
   */
  async function login(credentials) {
    const normalizedEmail = String(credentials?.email ?? '')
      .trim()
      .toLowerCase();
    const normalizedPassword = String(credentials?.password ?? '').trim();

    if (!normalizedEmail || !normalizedPassword) {
      throw new Error('Debes ingresar correo y contraseña.');
    }

    setIsSubmitting(true);
    try {
      const payload = AUTH_API_BASE_URL
        ? await loginWithApi({ email: normalizedEmail, password: normalizedPassword })
        : await loginWithDemoCredentials({
            email: normalizedEmail,
            password: normalizedPassword,
          });

      setAuthState({
        status: 'authenticated',
        accessToken: payload.accessToken,
        user: payload.user,
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

  const contextValue = useMemo(
    () => ({
      user: authState.user,
      accessToken: authState.accessToken,
      status: authState.status,
      isAuthenticated: authState.status === 'authenticated' && Boolean(authState.user),
      isInitializing: false,
      isSubmitting,
      login,
      logout,
    }),
    [authState, isSubmitting],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

/**
 * Access current authentication context.
 *
 * @returns {{
 *   user: Record<string, unknown> | null,
 *   accessToken: string,
 *   status: string,
 *   isAuthenticated: boolean,
 *   isInitializing: boolean,
 *   isSubmitting: boolean,
 *   login: (credentials: {email: string, password: string}) => Promise<Record<string, unknown>>,
 *   logout: () => Promise<void>
 * }} Auth context value.
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
 * @returns {Promise<{accessToken: string, user: Record<string, unknown>}>} Session payload.
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
 * Authenticate using local demo credentials when backend URL is not configured.
 *
 * @param {{email: string, password: string}} params - Driver credentials.
 * @returns {Promise<{accessToken: string, user: Record<string, unknown>}>} Session payload.
 */
async function loginWithDemoCredentials({ email, password }) {
  const demoEmail = String(process.env.EXPO_PUBLIC_DRIVER_DEMO_EMAIL ?? DEFAULT_DEMO_EMAIL)
    .trim()
    .toLowerCase();
  const demoPassword = String(
    process.env.EXPO_PUBLIC_DRIVER_DEMO_PASSWORD ?? DEFAULT_DEMO_PASSWORD,
  ).trim();

  if (email !== demoEmail || password !== demoPassword) {
    throw new Error('Credenciales inválidas. Revisa el correo y la contraseña.');
  }

  return {
    accessToken: 'demo-driver-session-token',
    user: normalizeUserPayload(
      {
        id: 'demo-driver',
        name: 'Conductor Demo',
        email: demoEmail,
        role: DRIVER_ROLE,
      },
      demoEmail,
    ),
  };
}

/**
 * Request one auth endpoint and normalize server-side error messages.
 *
 * @param {{
 *   path: string,
 *   method: 'GET' | 'POST',
 *   body?: Record<string, unknown>,
 *   accessToken?: string,
 *   fallbackErrorMessage: string
 * }} params - HTTP request config.
 * @returns {Promise<any>} Parsed JSON payload.
 */
async function requestAuthApi({ path, method, body, accessToken, fallbackErrorMessage }) {
  const endpoint = buildAuthEndpointUrl(path);
  const headers = {
    Accept: 'application/json',
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
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      resolveApiErrorMessage({
        statusCode: response.status,
        fallbackErrorMessage,
      }),
    );
  }

  return payload;
}

/**
 * Build absolute auth endpoint URL from environment base URL.
 *
 * @param {string} path - API path with leading slash.
 * @returns {string} Full URL to backend endpoint.
 */
function buildAuthEndpointUrl(path) {
  const normalizedBaseUrl = AUTH_API_BASE_URL.replace(/\/+$/, '');
  return `${normalizedBaseUrl}${path}`;
}

/**
 * Resolve user-friendly auth error message by HTTP status.
 *
 * @param {{statusCode: number, fallbackErrorMessage: string}} params - Error context.
 * @returns {string} User-facing error text.
 */
function resolveApiErrorMessage({ statusCode, fallbackErrorMessage }) {
  if (statusCode === 401) {
    return 'Correo o contraseña incorrectos.';
  }
  if (statusCode === 403) {
    return 'Tu cuenta no tiene acceso a esta aplicación.';
  }
  return fallbackErrorMessage;
}

/**
 * Normalize raw user payload into a safe driver session object.
 *
 * @param {any} userCandidate - Raw backend or demo user object.
 * @param {string} fallbackEmail - Fallback email used when payload is incomplete.
 * @returns {{id: string, name: string, email: string, role: string}} Normalized user.
 */
function normalizeUserPayload(userCandidate, fallbackEmail) {
  const normalizedRole = normalizeRole(userCandidate?.role);

  return {
    id: String(userCandidate?.id ?? userCandidate?.uuid ?? 'driver'),
    name: String(userCandidate?.name ?? userCandidate?.full_name ?? 'Conductor'),
    email: String(userCandidate?.email ?? fallbackEmail ?? '')
      .trim()
      .toLowerCase(),
    role: normalizedRole,
  };
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
