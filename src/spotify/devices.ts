import type { ApiDevice } from './api';

/**
 * Op welk apparaat hervatten we als er geen actief apparaat is? Alleen een apparaat van het
 * soort waar je nu bent (telefoon op je telefoon, computer op je computer): nooit vanzelf
 * een speaker of tv in een andere kamer laten afgaan.
 */
export function pickDevice(
  devices: ApiDevice[],
  opts: { preferTypes: string[]; lastDeviceId?: string | null; ownDeviceId?: string | null },
): ApiDevice | null {
  const usable = devices.filter((d) => d.id && !d.is_restricted);
  const ofType = usable.filter((d) => opts.preferTypes.includes(d.type));
  return (
    usable.find((d) => d.is_active) ??
    ofType.find((d) => d.id === opts.lastDeviceId) ??
    ofType.find((d) => d.id === opts.ownDeviceId) ??
    ofType[0] ??
    null
  );
}
