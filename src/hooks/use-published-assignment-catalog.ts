'use client'

import { useCallback, useEffect, useState } from 'react'
import { getPublishedAssaySampleTypeCatalogClient } from '@/lib/api-client'
import type { PublishedAssaySampleTypeCatalog } from '@/types'

const LOAD_ERROR =
  'Không thể tải catalog tương thích. Vui lòng tải lại trước khi chỉ định.'

export function usePublishedAssignmentCatalog() {
  const [catalog, setCatalog] =
    useState<PublishedAssaySampleTypeCatalog | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const reload = useCallback(() => {
    setReloadKey((current) => current + 1)
  }, [])

  useEffect(() => {
    let active = true

    async function loadCatalog() {
      setIsLoading(true)
      setError(null)

      try {
        const result = await getPublishedAssaySampleTypeCatalogClient()
        if (!active) return

        if (result.error || !result.data?.revisionNumber) {
          setCatalog(null)
          setError(LOAD_ERROR)
          return
        }

        setCatalog(result.data)
      } catch {
        if (!active) return
        setCatalog(null)
        setError(LOAD_ERROR)
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void loadCatalog()
    return () => {
      active = false
    }
  }, [reloadKey])

  return {
    catalog,
    error,
    isLoading,
    reload,
  }
}
