'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { DialogContent } from './dialog'

const FORM_DIALOG_CONTENT_CLASS_NAME =
  'sm:max-w-[700px] max-h-[90vh] overflow-y-auto'

function FormDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  return (
    <DialogContent
      className={cn(FORM_DIALOG_CONTENT_CLASS_NAME, className)}
      {...props}
    />
  )
}

export { FormDialogContent }
