export type Mutable<T> = T extends readonly (infer U)[] ? { -readonly [K in keyof T]: T[K] } : T
