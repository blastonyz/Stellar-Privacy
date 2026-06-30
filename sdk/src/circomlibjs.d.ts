declare module "circomlibjs" {
  export interface BabyJub {
    F: {
      zero: unknown;
      one: unknown;
      e: (v: bigint) => unknown;
      neg: (v: unknown) => unknown;
      fromObject: (v: bigint) => unknown;
      toObject: (v: unknown) => bigint;
    };
    Base8: [unknown, unknown];
    subOrder: bigint;
    addPoint: (a: unknown, b: unknown) => [unknown, unknown];
    mulPointEscalar: (p: unknown, s: bigint) => [unknown, unknown];
    packPoint: (p: unknown) => unknown;
  }

  export interface Poseidon {
    F: { toString: (v: unknown) => string };
    (inputs: unknown[]): unknown;
  }

  export function buildBabyjub(): Promise<BabyJub>;
  export function buildPoseidon(): Promise<Poseidon>;
}
