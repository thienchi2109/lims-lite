/**
 * Utility functions for CDC-LIMS
 */

/**
 * Generates a unique sample ID in the format: CDC-XN-ddmmyyyy-000x
 * @param existingCount - Number of samples already created today
 * @returns Generated sample ID
 */
export function generateSampleId(existingCount: number): string {
    const now = new Date()

    // Format date as ddmmyyyy
    const day = String(now.getDate()).padStart(2, '0')
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const year = String(now.getFullYear())
    const dateStr = `${day}${month}${year}`

    // Increment count and pad to 4 digits
    const sequence = String(existingCount + 1).padStart(4, '0')

    return `CDC-XN-${dateStr}-${sequence}`
}

/**
 * Formats a date string to a readable format
 * @param dateString - ISO date string
 * @returns Formatted date string
 */
export function formatDate(dateString: string): string {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date)
}

/**
 * Gets the start and end of today in ISO format
 * @returns Object with startOfDay and endOfDay
 */
export function getTodayRange(): { startOfDay: string; endOfDay: string } {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

    return {
        startOfDay: startOfDay.toISOString(),
        endOfDay: endOfDay.toISOString(),
    }
}

/**
 * Debounce function for delayed execution
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null

    return function executedFunction(...args: Parameters<T>) {
        const later = () => {
            timeout = null
            func(...args)
        }

        if (timeout) {
            clearTimeout(timeout)
        }
        timeout = setTimeout(later, wait)
    }
}
