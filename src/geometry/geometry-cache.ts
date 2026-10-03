import type { MeshGeometryBuffer, CurveGeometryBuffer } from '../contracts/geometry';

type CachedGeometry = MeshGeometryBuffer | CurveGeometryBuffer;

/** Worker-owned bounded LRU. Messages clone buffers before transferring ownership. */
export class GeometryCache {
  private readonly entries = new Map<string, { buffer: CachedGeometry; bytes: number }>();
  private bytes = 0;

  constructor(private readonly maxBytes = 32 * 1024 * 1024, private readonly maxEntries = 8) {}

  get<T extends CachedGeometry>(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.buffer as T;
  }

  set(key: string, buffer: CachedGeometry): void {
    if (buffer.status !== 'success' && buffer.status !== 'no-geometry-detected') return;
    const bytes = buffer.positions.byteLength + ('indices' in buffer
      ? buffer.normals.byteLength + buffer.indices.byteLength + (buffer.guideCurvesPositions?.byteLength ?? 0)
      : buffer.tValues.byteLength + buffer.segmentBreaks.byteLength);
    if (bytes > this.maxBytes) return;
    const old = this.entries.get(key);
    if (old) { this.entries.delete(key); this.bytes -= old.bytes; }
    this.entries.set(key, { buffer, bytes });
    this.bytes += bytes;
    while (this.bytes > this.maxBytes || this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value!;
      this.bytes -= this.entries.get(oldest)!.bytes;
      this.entries.delete(oldest);
    }
  }
}
