/**
 * Resolve first readable error message from one API payload candidate.
 *
 * @param {any} payloadCandidate - Backend payload candidate.
 * @returns {string} First available API error message.
 */
export function extractFirstApiErrorMessage(payloadCandidate) {
  if (!payloadCandidate || typeof payloadCandidate !== 'object') {
    return '';
  }
  if (typeof payloadCandidate.detail === 'string' && payloadCandidate.detail.trim()) {
    return payloadCandidate.detail.trim();
  }

  for (const value of Object.values(payloadCandidate)) {
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
      const firstMessage = value[0].trim();
      if (firstMessage) {
        return firstMessage;
      }
    }
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}
