import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { fieldCraft } from 'field-craft'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { testEmailAdapter } from './helpers/testEmailAdapter.js'
import { seed } from './seed.js'
import { seoPlugin } from '@payloadcms/plugin-seo'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

if (!process.env.ROOT_DIR) {
  process.env.ROOT_DIR = dirname
}

const buildConfigWithMemoryDB = async () => {
  const useMemoryDB =
    process.env.NODE_ENV === 'test' ||
    (process.env.CI === 'true' && !process.env.DATABASE_URL)
  if (useMemoryDB) {
    const memoryDB = await MongoMemoryReplSet.create({
      replSet: {
        count: 3,
        dbName: 'payloadmemory',
      },
    })

    process.env.DATABASE_URL = `${memoryDB.getUri()}&retryWrites=true`
  }

  return buildConfig({
    admin: {
      importMap: {
        baseDir: path.resolve(dirname),
      },
      user: 'users',
    },
    collections: [
      {
        slug: 'users',
        auth: true,
        fields: [
          {
            name: 'roles',
            type: 'select',
            defaultValue: ['user'],
            hasMany: true,
            options: ['admin', 'user'],
            saveToJWT: true,
          },
        ],
      },
      {
        slug: 'posts',
        fields: [
          {
            name: 'title',
            type: 'text',
            required: true,
          },
          {
            name: 'excerpt',
            type: 'textarea',
          },
        ],
      },
      {
        slug: 'media',
        fields: [
          { name: 'title', type: 'text' },
          { name: 'alt', type: 'text' },
        ],
        upload: {
          staticDir: path.resolve(dirname, 'media'),
        },
      },
    ],
    db: mongooseAdapter({
      ensureIndexes: true,
      url: process.env.DATABASE_URL || '',
    }),
    editor: lexicalEditor(),
    email: testEmailAdapter,
    onInit: async (payload) => {
      await seed(payload)
    },
    plugins: [
      seoPlugin({
        collections: [
          'posts',
        ],
        generateDescription: ({ doc }) => doc.excerpt,
        generateTitle: ({ doc }) => `Website.com — ${doc.title}`,
        uploadsCollection: 'media'
      }),
      fieldCraft({
        mediaSuggestions: {
          collections: ['media'],
          enabled: true,
          populateFields: [
            { fieldType: 'text', path: 'title' },
            { fieldType: 'text', path: 'alt' },
          ],
        },
        seo: {
          collections: [
            {
              slug: 'posts',
              descriptionPath: 'meta.description',
              titlePath: 'meta.title',
            },
          ],
          contentPaths: {
            posts: [],
          },
          enabled: true,
        },
      }),
    ],
    secret: process.env.PAYLOAD_SECRET || 'test-secret_key',
    sharp,
    typescript: {
      outputFile: path.resolve(dirname, 'payload-types.ts'),
    },
  })
}

export default buildConfigWithMemoryDB()
