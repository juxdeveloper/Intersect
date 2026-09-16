/**
 * Arbitrary-precision exact rational number representations for Intersect.
 *
 * Prevents IEEE 754 binary floating-point drift (such as 0.1 becoming 0.100000000000000005551115123126).
 * All rational arithmetic and decimal conversion uses string-backed BigInt calculations.
 */

export interface ExactRational {
  readonly num: string;
  readonly den: string;
}

/**
 * Computes greatest common divisor using Euclidean algorithm on BigInts.
 */
export function bigIntGcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

/**
 * Simplifies a rational fraction (num / den) to lowest terms with positive denominator.
 */
export function simplifyFraction(numStr: string, denStr: string): ExactRational {
  let n = BigInt(numStr);
  let d = BigInt(denStr);

  if (d === 0n) {
    throw new Error('Division by zero in exact rational arithmetic.');
  }

  if (d < 0n) {
    n = -n;
    d = -d;
  }

  if (n === 0n) {
    return { num: '0', den: '1' };
  }

  const g = bigIntGcd(n, d);
  return {
    num: (n / g).toString(),
    den: (d / g).toString(),
  };
}