/**
 * Extracts plain text from document content for use as AI prompt context.
 * Configurable content paths and generic block traversal.
 * Truncates to ~2000 chars for token limits.
 */

const MAX_CONTENT_LENGTH = 2000

/** Extract text from Lexical editor JSON (root.children structure) */
function extractLexicalText(node: Record<string, unknown>): string {
  const parts: string[] = []

  function traverse(n: Record<string, unknown>): void {
    if (typeof n.text === 'string') {
      parts.push(n.text)
    }
    const children = n.children
    if (Array.isArray(children)) {
      for (const child of children) {
        if (child && typeof child === 'object') {
          traverse(child as Record<string, unknown>)
        }
      }
    }
  }

  traverse(node)
  return parts.join(' ')
}

/** Recursively extract text from a block - generic fallback for unknown block types */
function extractFromBlock(block: Record<string, unknown>): string {
  const parts: string[] = []

  // Common text field names
  const textFields = [
    'heading',
    'mainHeading',
    'subHeading',
    'title',
    'description',
    'text',
    'content',
    'alt',
    'subtitle',
    'exampleText',
    'code',
  ]

  for (const key of textFields) {
    const val = block[key]
    if (typeof val === 'string' && val.trim()) {
      parts.push(val.trim())
    }
  }

  // Lexical rich text (content.root or text.root)
  const content = block.content || block.text
  if (content && typeof content === 'object' && content !== null) {
    const root = (content as Record<string, unknown>).root
    if (root && typeof root === 'object') {
      parts.push(extractLexicalText(root as Record<string, unknown>))
    }
  }

  // Nested blocks (e.g. content array)
  const contentArr = block.content
  if (Array.isArray(contentArr)) {
    for (const item of contentArr) {
      if (item && typeof item === 'object') {
        parts.push(extractFromBlock(item as Record<string, unknown>))
      }
    }
  }

  // Definitions array (e.g. hero block)
  const defs = block.definitions
  if (Array.isArray(defs)) {
    for (const d of defs) {
      if (d && typeof d === 'object' && typeof (d as Record<string, unknown>).text === 'string') {
        parts.push((d as Record<string, unknown>).text as string)
      }
    }
  }

  // dictionaryHeroContent, searchHeroContent (tallmancode-specific but harmless)
  const dict = block.dictionaryHeroContent as Record<string, unknown> | undefined
  if (dict) {
    if (typeof dict.mainHeading === 'string') {parts.push(dict.mainHeading)}
    if (typeof dict.subHeading === 'string') {parts.push(dict.subHeading)}
    if (typeof dict.exampleText === 'string') {parts.push(dict.exampleText)}
  }
  const search = block.searchHeroContent as Record<string, unknown> | undefined
  if (search) {
    if (typeof search.mainHeading === 'string') {parts.push(search.mainHeading)}
    if (typeof search.subtitle === 'string') {parts.push(search.subtitle)}
    if (typeof search.description === 'string') {parts.push(search.description)}
  }

  // marqueeImages
  const images = block.marqueeImages as Array<{ title?: string }> | undefined
  if (Array.isArray(images)) {
    parts.push(...images.map((i) => i?.title).filter(Boolean) as string[])
  }

  return parts.filter(Boolean).join(' ')
}

/** Extract text from blocks array (e.g. content.section) */
function extractBlocks(blocks: unknown[]): string {
  const parts: string[] = []
  for (const block of blocks) {
    if (block && typeof block === 'object') {
      const text = extractFromBlock(block as Record<string, unknown>)
      if (text) {parts.push(text)}
    }
  }
  return parts.join('\n')
}

/** Get value at path like ['content', 'section'] from doc */
function getAtPath(doc: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = doc
  for (const key of path) {
    if (current && typeof current === 'object' && key in (current)) {
      current = (current as Record<string, unknown>)[key]
    } else {
      return undefined
    }
  }
  return current
}

export interface ExtractContentOptions {
  /** Content paths per collection: e.g. { pages: ['content','section'], blog: ['content','section'] } */
  contentPaths?: Record<string, string[]>
}

const DEFAULT_CONTENT_PATHS: Record<string, string[]> = {
  blog: ['content', 'section'],
  pages: ['content', 'section'],
  posts: ['content'],
  projects: ['content', 'section'],
}

/**
 * Extract plain text from a document for use as AI prompt context.
 *
 * @param doc - The document data (partial/unsaved is ok)
 * @param collectionSlug - Collection slug
 * @param options - Optional content paths override
 * @returns Concatenated plain text, truncated to MAX_CONTENT_LENGTH
 */
export function extractContentFromDoc(
  doc: Record<string, unknown>,
  collectionSlug: string,
  options?: ExtractContentOptions,
): string {
  const contentPaths = options?.contentPaths ?? DEFAULT_CONTENT_PATHS
  const path = contentPaths[collectionSlug]
  const parts: string[] = []

  // Title
  if (typeof doc.title === 'string' && doc.title.trim()) {
    parts.push(doc.title.trim())
  }

  // Excerpt
  if (typeof doc.excerpt === 'string' && doc.excerpt.trim()) {
    parts.push(doc.excerpt.trim())
  }

  // Content blocks via configured path
  if (path && path.length > 0) {
    const current = getAtPath(doc, path)
    if (Array.isArray(current) && current.length > 0) {
      parts.push(extractBlocks(current))
    } else if (current && typeof current === 'object') {
      // Single object with nested content (e.g. { section: [...] })
      const section = (current as Record<string, unknown>).section
      if (Array.isArray(section)) {
        parts.push(extractBlocks(section))
      }
    }
  }

  const combined = parts.filter(Boolean).join('\n\n').trim()
  if (!combined) {return ''}
  if (combined.length <= MAX_CONTENT_LENGTH) {return combined}
  return combined.slice(0, MAX_CONTENT_LENGTH) + '...'
}
