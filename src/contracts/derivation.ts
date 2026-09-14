/**
 * Educational derivation contracts for Intersect.
 *
 * Requirements:
 * - Initially collapsed in UI.
 * - Shows transformations actually executed by the symbolic solver.
 * - Educational explanations accompany each mathematical step.
 * - Clearly states validity conditions required by the step (e.g. division by non-zero, square root domain).
 */

export interface DerivationStep {
  /** 1-based sequential step index */
  readonly stepNumber: number;
  /** Short descriptive header, e.g. "Parameterize circular cross-section" */
  readonly title: string;
  /** Plain text mathematical representation */
  readonly formulaText: string;
  /** Optional LaTeX string for mathematical rendering */
  readonly formulaLatex?: string;
  /** Educational explanation of why and how this transformation is performed */
  readonly explanation: string;
  /** Specific mathematical conditions under which this step holds */
  readonly validityConditions?: readonly string[];
}

export interface DerivationRecord {
  /** Applied solving strategy, e.g. "Cylindrical Projection and Linear Substitution" */
  readonly strategyName: string;
  /** Ordered list of educational derivation steps */
  readonly steps: readonly DerivationStep[];
}
