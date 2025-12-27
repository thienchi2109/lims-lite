import type { Config } from 'driver.js'

/**
 * Shared Driver.js configuration for all tours.
 * Uses Vietnamese labels and LIMS design system styling.
 */
export const driverConfig: Partial<Config> = {
    showProgress: true,
    animate: true,
    overlayColor: 'rgba(0, 0, 0, 0.6)',
    stagePadding: 8,
    stageRadius: 8,
    allowClose: true,
    allowKeyboardControl: true,

    // Vietnamese button labels
    nextBtnText: 'Tiếp theo',
    prevBtnText: 'Quay lại',
    doneBtnText: 'Hoàn tất',

    // Progress format
    progressText: '{{current}}/{{total}}',

    // Custom popover class for styling
    popoverClass: 'lims-tour-popover',
}
