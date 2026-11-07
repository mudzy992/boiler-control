export interface HeatingStatusItem {
  deviceId?: number;
  isHeatingNow?: boolean;
}

/** DA-02: heating-status is an array; also tolerate a single object. */
export const resolveIsHeatingNow = (status: unknown): boolean => {
  if (Array.isArray(status)) {
    return status.some(
      (item: HeatingStatusItem) => Boolean(item?.isHeatingNow),
    );
  }
  if (status && typeof status === 'object' && 'isHeatingNow' in status) {
    return Boolean((status as HeatingStatusItem).isHeatingNow);
  }
  return false;
};
