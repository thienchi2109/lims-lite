type AssayMethodNameSource = {
  method_name?: string | null
  methods?: Array<{
    name: string
    is_default?: boolean | null
  }>
}

export function getAssayDefinitionMethodName(assay?: AssayMethodNameSource | null) {
  if (assay?.method_name?.trim()) {
    return assay.method_name.trim()
  }

  const defaultMethod = assay?.methods?.find((method) => method.is_default)
  return defaultMethod?.name || assay?.methods?.[0]?.name || ''
}
