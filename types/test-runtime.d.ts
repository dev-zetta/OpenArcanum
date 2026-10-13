/** Engine logging installed by the client and headless bootstrap. */
declare function lll(...values: unknown[]): void

declare function lle(...values: unknown[]): void
declare var AGate: import("../@openarcanum/agate/dist-types/AGate").default

interface Math { randomFloat(min: number, max: number): number; randomInt(min: number, max: number): number }
