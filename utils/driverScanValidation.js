/**
 * Resolve one normalized order identifier from mobile scan API payload.
 *
 * @param {unknown} scanPayloadCandidate - Raw scan response payload.
 * @returns {string} Backend order id or empty string when unavailable.
 */
export function resolveScannedOrderId(scanPayloadCandidate) {
  if (!scanPayloadCandidate || typeof scanPayloadCandidate !== 'object') {
    return '';
  }
  return String(scanPayloadCandidate['order_id'] ?? '').trim();
}

/**
 * Ensure one scan response belongs to the selected order row.
 *
 * @param {{
 *   scanPayloadCandidate: unknown,
 *   targetOrderId: string
 * }} params - Target order and raw API payload.
 * @returns {string} Validated scanned order id.
 * @throws {Error} When payload order id is missing or does not match target order id.
 */
export function ensureScanMatchesTargetOrder({ scanPayloadCandidate, targetOrderId }) {
  const normalizedTargetOrderId = String(targetOrderId ?? '').trim();
  const scannedOrderId = resolveScannedOrderId(scanPayloadCandidate);

  if (!normalizedTargetOrderId) {
    throw new Error('No se pudo identificar el pedido del bulto seleccionado.');
  }
  if (!scannedOrderId) {
    throw new Error('La respuesta de escaneo no informó el pedido escaneado.');
  }
  if (scannedOrderId !== normalizedTargetOrderId) {
    throw new Error('El QR escaneado no corresponde al bulto seleccionado.');
  }

  return scannedOrderId;
}
