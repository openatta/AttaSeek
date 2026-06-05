/**
 * ID generation — BASE58-encoded UUID v4 (22 chars, URL-safe).
 * Uses crypto.getRandomValues directly, no hex round-trip.
 */

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return base58Encode(bytes)
}

function base58Encode(bytes: Uint8Array): string {
  const digits = [0]
  for (const byte of bytes) {
    let carry = byte
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] * 256
      digits[i] = carry % 58
      carry = (carry / 58) | 0
    }
    while (carry > 0) {
      digits.push(carry % 58)
      carry = (carry / 58) | 0
    }
  }
  let leading = 0
  while (leading < bytes.length && bytes[leading] === 0) {
    digits.push(0); leading++
  }
  return digits.reverse().map((d) => ALPHABET[d]).join('')
}
