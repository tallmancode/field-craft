# FieldCraft

A Payload CMS plugin that adds AI-powered **media suggestions** (title, alt text, credits for uploads) and **SEO generation** (meta title and description from content). Supports Ollama, Ollama Cloud, Google Gemini, and Claude.

## Features

- **Media Suggestions** – Generate title, alt text, and credits for images using vision models. Applies to upload collections.
- **SEO Generation** – Generate meta title and description from document content. Works with Lexical and block-based content.
- **Shared Provider Config** – One AI Provider Settings global for all features. Supports Ollama, Ollama Cloud, Google Gemini, and Claude.
- **Usage Dashboard** – Claude and Gemini usage widgets on the admin dashboard (when configured).
- **Configurable** – Choose which fields to populate, map to your schema, and customize content extraction.

## Installation

```bash
pnpm add field-craft
# or
npm install field-craft
# or
yarn add field-craft
```

**Peer dependency:** Payload `^3.37.0`

## Quick Start

```ts
import { buildConfig } from 'payload'
import { fieldCraft } from 'field-craft'

export default buildConfig({
  collections: [
    // Your collections, including at least one upload collection for media suggestions
  ],
  plugins: [
    fieldCraft({
      mediaSuggestions: {
        collections: ['media'],
      },
      seo: {
        collections: [
          {
            slug: 'pages',
            titlePath: 'meta.title',
            descriptionPath: 'meta.description',
          },
        ],
        contentPaths: { pages: ['content', 'section'] },
      },
    }),
  ],
  // ... rest of config
})
```

Then configure your AI provider in **Settings → AI Provider Settings**.

---

## Configuration Reference

### Top-Level Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `disabled` | `boolean` | `false` | Disable the entire plugin |
| `mediaSuggestions` | `MediaSuggestionsConfig` | `{}` | Media suggestions feature config |
| `seo` | `SEOConfig` | `{}` | SEO generation feature config |
| `providerSettingsSlug` | `string` | `'ai-provider-settings'` | Slug for the shared AI settings global |
| `brandVoice` | `string` | – | Override default brand voice instruction for AI prompts |
| `componentBasePath` | `string` | `'field-craft/components'` | Base path for resolving admin components |

### Media Suggestions Config

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable media suggestions |
| `collections` | `string[]` | All upload collections | Collection slugs to add AI suggestions to |
| `populateFields` | `('title' \| 'alt' \| 'credits')[]` | `['title','alt','credits']` | Which suggestion types to populate |
| `fieldMappings` | `object` | See below | Map suggestion types to your field names |
| `endpointPath` | `string` | `'/ai-suggestions'` | API path for the suggestions endpoint |
| `sidebarPosition` | `boolean` | `true` | Show the field in the sidebar |
| `ollamaConfig` | `object` | – | Fallback config when global settings aren't set |

**Default field mappings:**
```ts
{
  title: 'title',
  alt: 'alt',
  credits: 'creditText',
}
```

**Example – only populate alt for accessibility:**
```ts
mediaSuggestions: {
  collections: ['media'],
  populateFields: ['alt'],
  fieldMappings: { alt: 'altText' },
}
```

### SEO Config

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable SEO generation |
| `collections` | `SEOCollectionConfig[]` | `[]` | Collections to add the AI Generate button to |
| `endpointPath` | `string` | `'/ai-seo-generate'` | API path for the SEO endpoint |
| `contentPaths` | `Record<string, string[]>` | See below | Paths to content blocks per collection |
| `contentExtractor` | `(doc, slug) => string` | – | Custom function to extract text from documents |

**SEO collection config:**
```ts
{
  slug: 'pages',           // Collection slug
  titlePath: 'meta.title', // Path to meta title field
  descriptionPath: 'meta.description', // Path to meta description field
}
```

**Default content paths** (for block-based content):
```ts
{
  pages: ['content', 'section'],
  blog: ['content', 'section'],
  projects: ['content', 'section'],
  posts: ['content'],
}
```

**Example – custom content extraction:**
```ts
seo: {
  collections: [
    { slug: 'articles', titlePath: 'seo.title', descriptionPath: 'seo.description' },
  ],
  contentExtractor: (doc, slug) => {
    const parts = [doc.title, doc.summary]
    if (doc.blocks) {
      parts.push(extractFromBlocks(doc.blocks))
    }
    return parts.filter(Boolean).join('\n\n').slice(0, 2000)
  },
}
```

---

## Setup and Usage

### 1. AI Provider Settings

After installing, go to **Settings → AI Provider Settings** and configure:

- **Provider** – Ollama (local), Ollama Cloud, Google Gemini, or Claude API
- **Model** – Use "Refetch models" to load available models, then select one
- **API URL** – For Ollama: `http://localhost:11434` (local) or `https://ollama.com` (cloud)
- **API Key** – Required for Ollama Cloud, Gemini, and Claude

**Environment variables** (optional fallbacks for Ollama):

| Variable | Description |
|----------|-------------|
| `OLLAMA_API_URL` | Default: `http://localhost:11434` |
| `OLLAMA_MODEL` | Default: `llava:latest` |
| `OLLAMA_API_KEY` | For Ollama Cloud |
| `ANTHROPIC_ADMIN_API_KEY` | For Claude usage dashboard widget |

### 2. Media Suggestions (Upload Collections)

When media suggestions are enabled, the **AI Suggestions** field appears on upload (media) documents:

1. Upload an image or open an existing media document.
2. Click **Generate AI Suggestions**.
3. Title, alt text, and credits are filled from the AI response.

You can restrict which fields are populated with `populateFields`, and map to different field names with `fieldMappings`.

### 3. SEO Generation (Content Collections)

When SEO is enabled and collections are configured, an **AI Generate SEO** button appears in the SEO/meta tab:

1. Create or edit a document (e.g. page, post).
2. Add some content.
3. Open the SEO tab and click **AI Generate SEO**.
4. The prompt is pre-filled from your content. Edit if needed, then click **Generate Title & Description**.
5. Meta title and description are applied to the configured fields.

For **AI Generate Excerpt** (excerpt-only mode), add the field manually with `target: 'excerpt'` in `clientProps` if using the component directly.

### 4. Content Paths for SEO

The plugin extracts text from your documents to build the SEO prompt. Use `contentPaths` to tell it where your content lives:

```ts
contentPaths: {
  pages: ['content', 'section'],  // doc.content.section (array of blocks)
  blog: ['body', 'blocks'],       // doc.body.blocks
  posts: [],                      // Only title + excerpt
}
```

An empty array `[]` means only `title` and `excerpt` (if present) are used.

---

## Complete Example

```ts
import { buildConfig } from 'payload'
import { fieldCraft } from 'field-craft'

export default buildConfig({
  collections: [
    { slug: 'users', auth: true, fields: [] },
    {
      slug: 'media',
      upload: { staticDir: 'media' },
      fields: [
        { name: 'title', type: 'text' },
        { name: 'alt', type: 'text' },
        { name: 'creditText', type: 'text' },
      ],
    },
    {
      slug: 'pages',
      fields: [
        { name: 'title', type: 'text' },
        {
          name: 'content',
          type: 'group',
          fields: [
            {
              name: 'section',
              type: 'blocks',
              blocks: [/* your blocks */],
            },
          ],
        },
        {
          name: 'meta',
          type: 'group',
          fields: [
            { name: 'title', type: 'text' },
            { name: 'description', type: 'textarea' },
          ],
        },
      ],
    },
  ],
  plugins: [
    fieldCraft({
      mediaSuggestions: {
        collections: ['media'],
        populateFields: ['title', 'alt', 'credits'],
        fieldMappings: {
          title: 'title',
          alt: 'alt',
          credits: 'creditText',
        },
      },
      seo: {
        collections: [
          {
            slug: 'pages',
            titlePath: 'meta.title',
            descriptionPath: 'meta.description',
          },
        ],
        contentPaths: {
          pages: ['content', 'section'],
        },
      },
      brandVoice: 'Write in a professional, clear tone.',
    }),
  ],
  // ...
})
```

---

## Development

For contributors developing the plugin:

### Prerequisites

- Node 18+ 
- pnpm 9+

### Setup

```bash
pnpm install
cp dev/.env.example dev/.env
# Edit dev/.env with DATABASE_URL and PAYLOAD_SECRET
```

### Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start the dev Payload project |
| `pnpm generate:types` | Regenerate Payload types |
| `pnpm generate:importmap` | Regenerate admin import map (after component changes) |
| `pnpm test:int` | Run integration tests |
| `pnpm build` | Build the plugin |

### Project Structure

```
src/
├── index.ts              # Plugin entry, config merging
├── types.ts              # TypeScript types
├── collections/          # ai-models, ai-usage-logs
├── globals/              # AI Provider Settings
├── endpoints/            # API endpoints
├── components/           # Admin UI components
├── utils/                # AI providers, extraction, etc.
└── exports/              # Client exports
```

---

## License

MIT
