export type Vec3 = [number, number, number];
export type ClothSettings = {
  gravity: number;
  wind: number;
  stiffness: number;
  damping: number;
  collisions: boolean;
};
export class SkirtCloth {
  readonly positions: Float32Array;
  readonly previous: Float32Array;
  readonly rest: Float32Array;
  readonly constraints: { a: number; b: number; length: number }[] = [];
  readonly columns: number;
  readonly rows: number;
  time = 0;
  constructor(
    public topRadius: number,
    public hemRadius: number,
    public length: number,
    public waistY: number,
    columns = 40,
    rows = 16,
  ) {
    this.columns = columns;
    this.rows = rows;
    this.positions = new Float32Array((columns + 1) * (rows + 1) * 3);
    for (let row = 0; row <= rows; row++)
      for (let col = 0; col <= columns; col++) {
        const t = row / rows,
          a = (col / columns) * Math.PI * 2,
          r =
            topRadius +
            (hemRadius - topRadius) * t +
            Math.sin(a * 8) * 1.5 * t * t;
        const i = this.index(row, col);
        this.positions[i] = Math.sin(a) * r;
        this.positions[i + 1] =
          waistY -
          t *
            Math.sqrt(
              Math.max(1, length * length - (hemRadius - topRadius) ** 2),
            );
        this.positions[i + 2] = Math.cos(a) * r;
      }
    this.previous = this.positions.slice();
    this.rest = this.positions.slice();
    const link = (r1: number, c1: number, r2: number, c2: number) => {
      const a = this.index(r1, c1),
        b = this.index(r2, c2);
      this.constraints.push({
        a,
        b,
        length: Math.hypot(
          ...[0, 1, 2].map((d) => this.rest[a + d] - this.rest[b + d]),
        ),
      });
    };
    for (let r = 0; r <= rows; r++)
      for (let c = 0; c < columns; c++) {
        link(r, c, r, c + 1);
        if (r < rows) {
          link(r, c, r + 1, c);
          link(r, c, r + 1, c + 1);
          link(r, c + 1, r + 1, c);
        }
      }
    for (let r = 0; r < rows; r++) link(r, columns, r + 1, columns);
  }
  index(row: number, column: number) {
    return (row * (this.columns + 1) + column) * 3;
  }
  reset() {
    this.positions.set(this.rest);
    this.previous.set(this.rest);
    this.time = 0;
  }
  step(
    dt: number,
    s: ClothSettings,
    bodyRadius: (y: number) => number = () => 0,
    weightGsm = 180,
    stretch = 0.03,
  ) {
    const step = Math.max(0.001, Math.min(dt, 0.025));
    this.time += step;
    for (let r = 1; r <= this.rows; r++)
      for (let c = 0; c <= this.columns; c++) {
        const i = this.index(r, c),
          wind =
            s.wind *
            90 *
            (180 / Math.max(20, weightGsm)) *
            (0.6 + 0.4 * Math.sin(this.time * 2 + r * 0.3));
        for (let d = 0; d < 3; d++) {
          const current = this.positions[i + d],
            v = (current - this.previous[i + d]) * s.damping;
          this.previous[i + d] = current;
          this.positions[i + d] =
            current +
            v +
            (d === 1 ? -s.gravity * 100 : d === 0 ? wind : wind * 0.25) *
              step *
              step;
        }
      }
    for (let iteration = 0; iteration < 5; iteration++) {
      for (const { a, b, length } of this.constraints) {
        const dx = this.positions[b] - this.positions[a],
          dy = this.positions[b + 1] - this.positions[a + 1],
          dz = this.positions[b + 2] - this.positions[a + 2],
          distance = Math.hypot(dx, dy, dz) || 1;
        const factor =
            ((distance - length) / distance) * s.stiffness * (1 - stretch),
          aPinned = a < this.index(1, 0),
          bPinned = b < this.index(1, 0),
          share = aPinned || bPinned ? 1 : 0.5;
        if (!aPinned) {
          this.positions[a] += dx * factor * share;
          this.positions[a + 1] += dy * factor * share;
          this.positions[a + 2] += dz * factor * share;
        }
        if (!bPinned) {
          this.positions[b] -= dx * factor * share;
          this.positions[b + 1] -= dy * factor * share;
          this.positions[b + 2] -= dz * factor * share;
        }
      }
      for (let c = 0; c <= this.columns; c++) {
        const i = this.index(0, c);
        for (let d = 0; d < 3; d++) this.positions[i + d] = this.rest[i + d];
      }
      for (let r = 1; r <= this.rows; r++) {
        for (let c = 0; c <= this.columns; c++) {
          const i = this.index(r, c);
          this.positions[i + 1] = Math.max(1, this.positions[i + 1]);
          if (s.collisions) {
            const body = bodyRadius(this.positions[i + 1]),
              x = this.positions[i] / 1.12,
              z = this.positions[i + 2] / 0.9,
              radius = Math.hypot(x, z);
            if (body > 0 && radius < body + 0.8) {
              const factor = (body + 0.8) / Math.max(radius, 0.01);
              this.positions[i] *= factor;
              this.positions[i + 2] *= factor;
            }
          }
        }
        const a = this.index(r, 0),
          b = this.index(r, this.columns);
        for (let d = 0; d < 3; d++) {
          const mid = (this.positions[a + d] + this.positions[b + d]) / 2;
          this.positions[a + d] = mid;
          this.positions[b + d] = mid;
        }
      }
    }
  }
}
