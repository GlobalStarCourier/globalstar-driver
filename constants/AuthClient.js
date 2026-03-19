const AUTH_API_BASE_URL = String(process.env.EXPO_PUBLIC_AUTH_API_BASE_URL ?? '').trim();
const MOBILE_CLIENT_PLATFORM_HEADER = 'X-Client-Platform';
const MOBILE_DRIVER_CLIENT_PLATFORM = 'MOBILE_DRIVER';

/**
 * Build one absolute backend URL from API base + path.
 *
 * @param {string} path - API path with leading slash.
 * @returns {string} Absolute endpoint URL.
 */
function buildBackendEndpointUrl(path) {
  const normalizedBaseUrl = AUTH_API_BASE_URL.replace(/\/+$/, '');
  return `${normalizedBaseUrl}${path}`;
}

export {
  AUTH_API_BASE_URL,
  MOBILE_CLIENT_PLATFORM_HEADER,
  MOBILE_DRIVER_CLIENT_PLATFORM,
  buildBackendEndpointUrl,
};
