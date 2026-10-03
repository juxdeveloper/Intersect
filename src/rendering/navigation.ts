/** Keep a useful overview at any aspect ratio, without shrinking the graph to a dot. */
export function navigationDistances(aspect: number, verticalFov: number, referenceRadius = 15) {
  const tangent = Math.tan(verticalFov * Math.PI / 360) * Math.min(1, Math.max(0.1, aspect));
  const framing = referenceRadius * 1.15 / tangent;
  return { framing, min: Math.max(0.4, referenceRadius * 0.025), max: framing * 1.4 };
}
