export function parseClientResolutionCategories<Category extends string>(
  configured: string | undefined,
  validCategories: ReadonlySet<Category>,
) {
  const normalized = configured?.trim().toLowerCase()

  if (!normalized || normalized === 'off') {
    return new Set<Category>()
  }

  return new Set(
    normalized
      .split(',')
      .map((category) => category.trim())
      .filter((category): category is Category =>
        validCategories.has(category as Category),
      ),
  )
}
