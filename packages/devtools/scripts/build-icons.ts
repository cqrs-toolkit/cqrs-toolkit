import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))

const src = resolve(__dirname, '../src/assets/icon.svg')
const out = resolve(__dirname, '../icons')

mkdirSync(out, { recursive: true })

const sizes = [16, 48, 128]

for (const size of sizes) {
  await sharp(src).resize(size, size).png().toFile(`${out}/icon-${size}.png`)
}
