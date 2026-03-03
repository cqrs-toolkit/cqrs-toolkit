// Skip Husky install in production and CI
// SRC: https://typicode.github.io/husky/how-to.html
if (process.env.HUSKY === '0' || process.env.CI === 'true') {
  process.exit(0)
}
await import('husky')
