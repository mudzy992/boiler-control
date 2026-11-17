const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** Normalize an entered code or extract the TV code from its QR deep link. */
export function parseTvPairingCode(raw: string): string | null {
  let candidate = raw.trim();

  if (/^boilercontrol:\/\/tv-pair(?:[/?#]|$)/i.test(candidate)) {
    const encodedCode = candidate.match(/[?&]code=([^&#]+)/i)?.[1];
    if (!encodedCode) return null;
    try {
      candidate = decodeURIComponent(encodedCode);
    } catch {
      return null;
    }
  }

  const code = candidate.replace(/[\s-]/g, '').toUpperCase();
  if (code.length !== 8) return null;
  return [...code].every((character) => CODE_ALPHABET.includes(character))
    ? code
    : null;
}
