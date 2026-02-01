import path from 'path'
import { loadEnv } from 'payload/node'
import { fileURLToPath } from 'url'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default defineConfig(() => {
  loadEnv(path.resolve(dirname, './dev'))

  return {
    plugins: [
      tsconfigPaths({
        ignoreConfigErrors: true,
      }),
    ],
    resolve: {
      alias: {
        '@payload-config': path.resolve(dirname, 'dev/payload.config.ts'),
      },
    },
    test: {
      environment: 'node',
      include: ['dev/int.spec.ts', 'src/**/*.spec.ts'],
      hookTimeout: 90_000,
      testTimeout: 30_000,
    },
  }
})
