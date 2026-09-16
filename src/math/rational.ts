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

/**
 * Converts any finite decimal string or integer literal (with optional scientific notation)
 * into an exact rational number without binary float rounding.
 *
 * Examples:
 *  "0.1" -> { num: "1", den: "10" }
 *  "-0.25" -> { num: "-1", den: "4" }
 *  "42" -> { num: "42", den: "1" }
 *  "1.25e2" -> { num: "125", den: "1" }
 *  "1.5e-3" -> { num: "3", den: "2000" }
 */
export function parseExactDecimalToRational(decimalText: string): ExactRational {
  const cleaned = decimalText.trim();
  if (!cleaned) {
    return { num: '0', den: '1' };
  }

  // Handle scientific notation e.g. 1.5e-3 or -2e4
  const eIndex = cleaned.toLowerCase().indexOf('e');
  if (eIndex !== -1) {
    const mantissaStr = cleaned.slice(0, eIndex);
    const expStr = cleaned.slice(eIndex + 1);
    const exp = parseInt(expStr, 10);
    if (isNaN(exp)) {
      throw new Error(`Malformed scientific notation: ${decimalText}`);
    }

    const mantissaRational = parseExactDecimalToRational(mantissaStr);
    let n = BigInt(mantissaRational.num);
    let d = BigInt(mantissaRational.den);

    if (exp >= 0) {
      n *= 10n ** BigInt(exp);
    } else {
      d *= 10n ** BigInt(-exp);
    }

    return simplifyFraction(n.toString(), d.toString());
  }

  const isNegative = cleaned.startsWith('-');
  const unsigned = cleaned.startsWith('-') || cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;

  const dotIndex = unsigned.indexOf('.');
  if (dotIndex === -1) {
    // Pure integer
    const n = BigInt(unsigned);
    return {
      num: (isNegative ? -n : n).toString(),
      den: '1',
    };
  }

  const integerPart = unsigned.slice(0, dotIndex);
  const fractionalPart = unsigned.slice(dotIndex + 1);
  const numDecimals = fractionalPart.length;

  const wholeStr = (integerPart === '' ? '0' : integerPart) + fractionalPart;
  const num = BigInt(wholeStr);
  const den = 10n ** BigInt(numDecimals);

  const signedNum = isNegative ? -num : num;
  return simplifyFraction(signedNum.toString(), den.toString());
}
