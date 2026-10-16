const CLIENT_ID_PATTERN = /^[0-9a-z]{20,40}$/i;

/** Haalt een Client ID uit een uitnodigingslink (…?client=…) of uit een losse Client ID. */
export function parseInvite(text: string): string | null {
  const trimmed = text.trim();
  if (CLIENT_ID_PATTERN.test(trimmed)) return trimmed;
  const match = /[?&]client=([0-9a-z]{20,40})/i.exec(trimmed);
  return match ? match[1] : null;
}
