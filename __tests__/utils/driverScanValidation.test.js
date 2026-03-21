import { ensureScanMatchesTargetOrder, resolveScannedOrderId } from '@/utils/driverScanValidation';

describe('driverScanValidation', () => {
  it('extracts scanned order id from scan payload', () => {
    expect(
      resolveScannedOrderId({
        order_id: '2f4ef2de-3bd0-4fd0-a0f7-64bcde0863f7',
      }),
    ).toBe('2f4ef2de-3bd0-4fd0-a0f7-64bcde0863f7');
  });

  it('returns empty order id when payload is malformed', () => {
    expect(resolveScannedOrderId(null)).toBe('');
    expect(resolveScannedOrderId({})).toBe('');
  });

  it('accepts scan payloads that match the selected order row', () => {
    expect(
      ensureScanMatchesTargetOrder({
        scanPayloadCandidate: {
          order_id: '2f4ef2de-3bd0-4fd0-a0f7-64bcde0863f7',
        },
        targetOrderId: '2f4ef2de-3bd0-4fd0-a0f7-64bcde0863f7',
      }),
    ).toBe('2f4ef2de-3bd0-4fd0-a0f7-64bcde0863f7');
  });

  it('rejects scan payloads when scanned order does not match selected row', () => {
    expect(() =>
      ensureScanMatchesTargetOrder({
        scanPayloadCandidate: {
          order_id: '2f4ef2de-3bd0-4fd0-a0f7-64bcde0863f7',
        },
        targetOrderId: '9b0bf776-6be8-4dbd-8fd5-32b09f84ae3e',
      }),
    ).toThrow('El QR escaneado no corresponde al bulto seleccionado.');
  });
});
