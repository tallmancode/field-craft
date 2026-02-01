---
title: Block Generation
description: Standardized pattern for creating new Payload CMS blocks based on template-block structure
tags: [payload, blocks, components, templates]
---

# Block Generation Rule

When asked to generate or create a new block, follow this standardized pattern based on the `template-block` structure. This ensures consistency across all blocks in the project.

## Overview

Blocks in this project consist of:
1. **Block Configuration** - Payload block definition (`src/blocks/`)
2. **Block Component** - React component for rendering (`src/components/blocks/`)
3. **Index Registration** - Export in `src/blocks/index.ts`
4. **RenderBlocks Configuration** - Component mapping in `src/components/blocks/RenderBlocks.tsx`

## File Structure

### 1. Block Configuration File

**Location**: `src/blocks/{block-name}-block/{BlockName}Block.ts`

**Pattern**:
- Folder name: `{block-name}-block` (kebab-case, lowercase, with "-block" suffix)
- File name: `{BlockName}Block.ts` (PascalCase)
- Export name: `{BlockName}Block` (PascalCase)
- Block slug: `{block-name}` (kebab-case, lowercase)

**Template Structure**:
```typescript
import type { Block } from 'payload'

export const {BlockName}Block: Block = {
  slug: "{block-name}",
  labels: {
    singular: "{Block Name}",
    plural: "{Block Names}",
  },
  fields: [
    // Block fields here
  ]
}
```

**Example** (for block name "testimonials"):
```typescript
import type { Block } from 'payload'

export const TestimonialsBlock: Block = {
  slug: "testimonials",
  labels: {
    singular: "Testimonial",
    plural: "Testimonials",
  },
  fields: [
    // Block fields here
  ]
}
```

### 2. Block Component File

**Location**: `src/components/blocks/{block-name}-block/{BlockName}BlockComponent.tsx`

**Pattern**:
- Folder name: `{block-name}-block` (kebab-case, lowercase, with "-block" suffix)
- File name: `{BlockName}BlockComponent.tsx` (PascalCase)
- Export name: `{BlockName}Block` (PascalCase, same as block config)
- Type import: `{BlockName}` from `@/payload-types` (PascalCase, singular)

**Template Structure**:
```typescript
import { {BlockName} } from '@/payload-types'
import React from 'react'

export const {BlockName}Block: React.FC<{BlockName}> = (props) => {
  const {content} = props

  return (
    <section>
      {/* Component JSX here */}
    </section>
  )
}
```

**Example** (for block name "testimonials"):
```typescript
import { Testimonial } from '@/payload-types'
import React from 'react'

export const TestimonialsBlock: React.FC<Testimonial> = (props) => {
  const {content} = props

  return (
    <section>
      {/* Component JSX here */}
    </section>
  )
}
```

### 3. Block Index Registration

**Location**: `src/blocks/index.ts`

**Required Updates**:
1. Add import at the top:
   ```typescript
   import { {BlockName}Block } from "./{block-name}-block/{BlockName}Block";
   ```

2. Add to Blocks array:
   ```typescript
   const Blocks = [SectionBlock, HeroBlock, {BlockName}Block];
   ```

**Example** (for block name "testimonials"):
```typescript
import { SectionBlock } from "./section-block/SectionBlock";
import { HeroBlock } from '@/blocks/hero-block/HeroBlock'
import { TestimonialsBlock } from "./testimonials-block/TestimonialsBlock";

const Blocks = [SectionBlock, HeroBlock, TestimonialsBlock];

export default Blocks;
```

### 4. RenderBlocks Configuration

**Location**: `src/components/blocks/RenderBlocks.tsx`

**Required Updates**:

1. **Add imports** at the top:
   ```typescript
   import { {BlockName}Block } from '@/components/blocks/{block-name}-block/{BlockName}BlockComponent'
   ```
   Also add `{BlockName}` to the existing payload-types import:
   ```typescript
   import { Section, Config, Hero, {BlockName} } from '@/payload-types'
   ```

2. **Add type to `BlockComponentMap`**:
   ```typescript
   type BlockComponentMap = {
     section: Section
     hero: Hero
     "{block-name}": {BlockName}
   };
   ```

3. **Add component to `blockComponents` object**:
   ```typescript
   const blockComponents: {
     [K in keyof BlockComponentMap]: React.ComponentType<WithMeta<BlockComponentMap[K]>>
   } = {
     section: SectionBlock,
     hero: HeroBlock,
     "{block-name}": {BlockName}Block
   } as const;
   ```

**Example** (for block name "testimonials"):
```typescript
import { TestimonialsBlock } from '@/components/blocks/testimonials-block/TestimonialsBlockComponent'
import { Section, Config, Hero, Testimonial } from '@/payload-types'

type BlockComponentMap = {
  section: Section
  hero: Hero
  testimonials: Testimonial
};

const blockComponents: {
  [K in keyof BlockComponentMap]: React.ComponentType<WithMeta<BlockComponentMap[K]>>
} = {
  section: SectionBlock,
  hero: HeroBlock,
  testimonials: TestimonialsBlock
} as const;
```

## Naming Conventions

When a user provides a block name (e.g., "testimonials", "hero", "section"):

- **Block slug**: Convert to kebab-case, lowercase (e.g., "testimonials", "hero")
- **Folder names**: `{block-name}-block` (kebab-case, lowercase, with "-block" suffix)
- **File names**: `{BlockName}Block.ts` and `{BlockName}BlockComponent.tsx` (PascalCase)
- **Export names**: `{BlockName}Block` (PascalCase)
- **Type names**: `{BlockName}` (PascalCase, singular, from payload-types)
- **Labels**: 
  - Singular: Capitalize first letter, handle pluralization (e.g., "Testimonial")
  - Plural: Add "s" or appropriate plural form (e.g., "Testimonials")

## Workflow

When asked to create a new block:

1. **If block name not provided**: Ask user for the block name before proceeding
2. **Create block config**: 
   - Create folder: `src/blocks/{block-name}-block/`
   - Create file: `{BlockName}Block.ts`
   - Copy structure from `src/blocks/template-block/TemplateBlock.ts`
   - Replace all instances of "template"/"Template" with the provided block name
3. **Create block component**: 
   - Create folder: `src/components/blocks/{block-name}-block/`
   - Create file: `{BlockName}BlockComponent.tsx`
   - Copy structure from `src/components/blocks/template-block/TemplateBlockComponent.tsx`
   - Replace all instances of "template"/"Template" with the provided block name
4. **Update index.ts**: 
   - Add import statement
   - Add block to Blocks array in `src/blocks/index.ts`
5. **Update RenderBlocks.tsx**: 
   - Add component import statement
   - Add type import to payload-types import (add `{BlockName}` to the import)
   - Add type to `BlockComponentMap`
   - Add component to `blockComponents` object
6. **Replace all instances**: Replace "template"/"Template" with the provided block name in all created files

## Complete Example

If user requests a block named "testimonials":

**Files Created**:
- `src/blocks/testimonials-block/TestimonialsBlock.ts`
- `src/components/blocks/testimonials-block/TestimonialsBlockComponent.tsx`

**Files Modified**:
- `src/blocks/index.ts` - Added import and export
- `src/components/blocks/RenderBlocks.tsx` - Added type mapping and component registration

**Naming**:
- Block slug: `"testimonials"`
- Type: `Testimonial` (from payload-types, singular)
- Export: `TestimonialsBlock`
- Folders: `testimonials-block`

## Important Notes

- The `template-block` files serve as the reference pattern - use them as templates
- All "template"/"Template" references should be replaced with the user-provided block name
- Maintain consistent naming across all files (kebab-case for slugs/folders, PascalCase for types/exports)
- After creating files, the user will need to run `generate:types` to update `payload-types.ts` with the new block type
- The block name provided by the user should be used exactly as given for the slug (converted to kebab-case if needed)
- Component export name should match the Block config export name (both `{BlockName}Block`)

## Reference Files

- Block Config Template: `src/blocks/template-block/TemplateBlock.ts`
- Component Template: `src/components/blocks/template-block/TemplateBlockComponent.tsx`
- Index File: `src/blocks/index.ts`
- RenderBlocks File: `src/components/blocks/RenderBlocks.tsx`
