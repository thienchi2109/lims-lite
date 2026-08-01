import { useState, useMemo, useEffect } from 'react'
import { fetchAssayDefinitionsClient, fetchMethodsClient } from '@/lib/api-client'
import type { AssayDefinitionWithMethods, SelectedTest, LabSpecialty } from '@/types'
import type { SortKey, SortConfig, GridRow } from '@/types/test-assignment'
import { SPECIALTY_BADGE_CLASSES } from '@/lib/specialty-badges'
import { getAssayDefinitionMethodName } from '@/lib/assay-method-name'

interface UseTestAssignmentGridProps {
    selected: SelectedTest[]
    onChange: (tests: SelectedTest[]) => void
    disabledAssayIds: string[]
    specialties: LabSpecialty[]
}

export function useTestAssignmentGrid({
    selected,
    onChange,
    disabledAssayIds,
    specialties
}: UseTestAssignmentGridProps) {
    // State
    const [availableAssays, setAvailableAssays] = useState<AssayDefinitionWithMethods[]>([])
    const [methods, setMethods] = useState<{ id: string, name: string }[]>([])
    const [selectedMethodId, setSelectedMethodId] = useState<string>('all')
    const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<string>('all')
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
    const [sortConfig, setSortConfig] = useState<SortConfig>(null)

    // Initial Load
    useEffect(() => {
        loadMethods()
    }, [])

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery)
        }, 300)

        return () => clearTimeout(timer)
    }, [searchQuery])

    // Load assays for the current criteria set
    useEffect(() => {
        const controller = new AbortController()
        const criteria = {
            pageSize: 2000,
            methodId: selectedMethodId,
            specialtyId: selectedSpecialtyId,
            search: debouncedSearchQuery,
        }

        const loadAssays = async () => {
            setIsLoading(true)
            try {
                const result = await fetchAssayDefinitionsClient(criteria, {
                    signal: controller.signal,
                })

                if (controller.signal.aborted) return

                if (result.data) {
                    setAvailableAssays(result.data as AssayDefinitionWithMethods[])
                } else {
                    setAvailableAssays([])
                }
            } catch (error) {
                if (controller.signal.aborted) return
                console.error('Failed to load assays', error)
                setAvailableAssays([])
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false)
                }
            }
        }

        loadAssays()

        return () => controller.abort()
    }, [debouncedSearchQuery, selectedMethodId, selectedSpecialtyId])

    const loadMethods = async () => {
        const result = await fetchMethodsClient()
        if (result.data) {
            setMethods(result.data)
        }
    }

    // Sorting Handler
    const requestSort = (key: SortKey) => {
        if (!sortConfig || sortConfig.key !== key) {
            setSortConfig({ key, direction: 'asc' })
            return
        }

        if (sortConfig.direction === 'asc') {
            setSortConfig({ key, direction: 'desc' })
            return
        }

        setSortConfig(null)
    }

    // Derived State
    const processedAssays = useMemo(() => {
        return [...availableAssays]
    }, [availableAssays])

    const disabledSet = useMemo(() => new Set(disabledAssayIds), [disabledAssayIds])
    const specialtiesMap = useMemo(() => {
        return new Map(specialties.map((s) => [s.id, s]))
    }, [specialties])
    const sortedSpecialties = useMemo(() => {
        return [...specialties].sort((a, b) => {
            if (a.display_order !== b.display_order) return a.display_order - b.display_order
            return a.name.localeCompare(b.name)
        })
    }, [specialties])

    const groupedRows = useMemo<GridRow[]>(() => {
        if (processedAssays.length === 0) return []

        const compareAssays = (a: AssayDefinitionWithMethods, b: AssayDefinitionWithMethods) => {
            if (!sortConfig) return 0

            const aValue = sortConfig.key === 'units' ? (a.units ?? '') : a.name
            const bValue = sortConfig.key === 'units' ? (b.units ?? '') : b.name

            const base = aValue.localeCompare(bValue)
            if (base !== 0) return sortConfig.direction === 'asc' ? base : -base

            return a.name.localeCompare(b.name)
        }

        const sortGroup = (assays: AssayDefinitionWithMethods[]) => {
            if (!sortConfig) return assays
            return [...assays].sort(compareAssays)
        }

        const rows: GridRow[] = []

        const pushGroup = (groupKey: string, label: string, badgeClass: string | undefined, assays: AssayDefinitionWithMethods[]) => {
            if (assays.length === 0) return
            const sortedAssays = sortGroup(assays)
            rows.push({
                type: 'group',
                key: groupKey,
                label,
                badgeClass,
                count: sortedAssays.length,
            })
            sortedAssays.forEach((assay) => {
                rows.push({ type: 'assay', key: assay.id, assay })
            })
        }

        if (selectedSpecialtyId !== 'all') {
            const specialty = specialtiesMap.get(selectedSpecialtyId)
            const badgeClass = specialty?.code && SPECIALTY_BADGE_CLASSES[specialty.code]
                ? SPECIALTY_BADGE_CLASSES[specialty.code]
                : undefined

            pushGroup(`group:${selectedSpecialtyId}`, specialty?.name ?? 'Chưa phân nhóm', badgeClass, processedAssays)
            return rows
        }

        const assaysBySpecialty = new Map<string, AssayDefinitionWithMethods[]>()
        const ungrouped: AssayDefinitionWithMethods[] = []

        processedAssays.forEach((assay) => {
            if (!assay.specialty_id) {
                ungrouped.push(assay)
                return
            }
            const existing = assaysBySpecialty.get(assay.specialty_id) ?? []
            existing.push(assay)
            assaysBySpecialty.set(assay.specialty_id, existing)
        })

        sortedSpecialties.forEach((specialty) => {
            const assays = assaysBySpecialty.get(specialty.id) ?? []
            const badgeClass = specialty.code && SPECIALTY_BADGE_CLASSES[specialty.code]
                ? SPECIALTY_BADGE_CLASSES[specialty.code]
                : undefined
            pushGroup(`group:${specialty.id}`, specialty.name, badgeClass, assays)
        })

        pushGroup('group:ungrouped', 'Chưa phân nhóm', undefined, ungrouped)

        return rows
    }, [processedAssays, sortConfig, sortedSpecialties, specialtiesMap, selectedSpecialtyId])

    // Handlers
    const toggleTestSelection = (assay: AssayDefinitionWithMethods) => {
        if (disabledSet.has(assay.id)) return

        const existingIndex = selected.findIndex(t => t.assayId === assay.id)

        if (existingIndex >= 0) {
            const newSelected = [...selected]
            newSelected.splice(existingIndex, 1)
            onChange(newSelected)
        } else {
            let methodToSelect = assay.methods.find(m => m.is_default) || assay.methods[0]

            if (selectedMethodId !== 'all') {
                const filteredMethod = assay.methods.find(m => m.method_id === selectedMethodId)
                if (filteredMethod) {
                    methodToSelect = filteredMethod
                }
            }

            onChange([...selected, {
                assayId: assay.id,
                methodId: methodToSelect?.method_id ?? null,
                assayName: assay.name,
                methodName: methodToSelect?.name || getAssayDefinitionMethodName(assay) || 'Không có',
                units: assay.units
            }])
        }
    }

    const handleMethodChange = (assayId: string, methodId: string) => {
        const newSelected = selected.map(t => {
            if (t.assayId === assayId) {
                const assay = availableAssays.find(a => a.id === assayId)
                const method = assay?.methods.find(m => m.method_id === methodId)
                if (method) {
                    return {
                        ...t,
                        methodId: method.method_id,
                        methodName: method.name
                    }
                }
            }
            return t
        })
        onChange(newSelected)
    }

    const handleRemove = (assayId: string) => {
        onChange(selected.filter(t => t.assayId !== assayId))
    }

    return {
        // State
        searchQuery,
        setSearchQuery,
        selectedMethodId,
        setSelectedMethodId,
        selectedSpecialtyId,
        setSelectedSpecialtyId,
        sortConfig,
        isLoading,

        // Data
        methods,
        processedAssays,
        groupedRows,
        disabledSet,
        specialtiesMap,

        // Handlers
        requestSort,
        toggleTestSelection,
        handleMethodChange,
        handleRemove,
    }
}
