export function isAccessor<T>(
  fn: T | (() => T | undefined) | undefined,
): fn is () => T | undefined {
  return typeof fn === 'function'
}
