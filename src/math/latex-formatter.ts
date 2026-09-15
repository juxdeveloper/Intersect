/**
 * Math expression to LaTeX formatting utility for Intersect.
 *
 * Converts internal SymPy / algebraic expressions into clean,
 * publication-grade LaTeX formulas for MathLive display.
 */

export function pythonExprToLatex(expr: string): string {
  if (!expr || typeof expr !== 'string') return '';

  let s = expr.trim();

  // Basic function replacements
  s = s.replace(/\bcos\b/g, '\\cos');
  s = s.replace(/\bsin\b/g, '\\sin');
  s = s.replace(/\btan\b/g, '\\tan');
  s = s.replace(/\bexp\b/g, '\\exp');
  s = s.replace(/\bln\b/g, '\\ln');
  s = s.replace(/\blog\b/g, '\\ln');
  s = s.replace(/\bsqrt\((.*?)\)/g, '\\sqrt{$1}');
  s = s.replace(/\bpi\b/g, '\\pi');

  // Powers: x**2 -> x^2, x**(2/3) -> x^{2/3}
  s = s.replace(/\*\*([0-9a-zA-Z]+)/g, '^{$1}');
  s = s.replace(/\*\*\((.*?)\)/g, '^{$1}');

  // Multiplications: 2*cos(t) -> 2\cos(t), 2*t -> 2t, a*b -> a \cdot b
  s = s.replace(/(\d+)\s*\*\s*([\\a-zA-Z])/g, '$1 $2');
  s = s.replace(/([\\a-zA-Z0-9\)\}])\s*\*\s*([\\a-zA-Z0-9\(\{])/g, '$1 \\cdot $2');

  // Fractions: a/b -> \frac{a}{b} if simple
  s = s.replace(/([0-9a-zA-Z\\]+)\/([0-9a-zA-Z\\]+)/g, '\\frac{$1}{$2}');

  return s;
}

export function formatIntervalToLatex(domain: any, paramSymbol = 't'): string {
  if (!domain) return '';

  const minStr = domain.minInclusive !== undefined
    ? String(domain.minInclusive)
    : domain.minExclusive !== undefined
      ? String(domain.minExclusive)
      : '';

  const maxStr = domain.maxInclusive !== undefined
    ? String(domain.maxInclusive)
    : domain.maxExclusive !== undefined
      ? String(domain.maxExclusive)
      : '';

  const minLatex = pythonExprToLatex(minStr);
  const maxLatex = pythonExprToLatex(maxStr);

  const leftOp = domain.minInclusive !== undefined ? '\\le' : '<';
  const rightOp = domain.maxInclusive !== undefined ? '\\le' : '<';

  if (minStr && maxStr) {
    return `${minLatex} ${leftOp} ${paramSymbol} ${rightOp} ${maxLatex}`;
  } else if (minStr) {
    return `${paramSymbol} \\ge ${minLatex}`;
  } else if (maxStr) {
    return `${paramSymbol} \\le ${maxLatex}`;
  }
  return `${paramSymbol} \\in \\mathbb{R}`;
}
