import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

export interface SpecialtyWithQC {
  id: string
  name: string
  qc_count: number
}

interface SpecialtyFilterProps {
  specialties: SpecialtyWithQC[]
  activeSpecialty: string | null
}

/**
 * Horizontal pill filter for selecting QC specialty.
 * Server component using Link for navigation.
 */
export function SpecialtyFilter({
  specialties,
  activeSpecialty,
}: SpecialtyFilterProps) {
  const baseUrl = '/analyst/qc-entry'

  return (
    <nav
      className="flex gap-2 overflow-x-auto pb-1"
      aria-label="Lọc theo chuyên khoa"
    >
      {/* "Tất cả" (All) option */}
      <Badge
        asChild
        variant={activeSpecialty === null ? 'default' : 'outline'}
        className={cn(
          'cursor-pointer px-3 py-1.5 text-sm transition-colors',
          activeSpecialty === null
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : 'hover:bg-accent hover:text-accent-foreground'
        )}
      >
        <Link href={baseUrl}>Tất cả</Link>
      </Badge>

      {/* Specialty pills */}
      {specialties.map((specialty) => {
        const isActive = activeSpecialty === specialty.id

        return (
          <Badge
            key={specialty.id}
            asChild
            variant={isActive ? 'default' : 'outline'}
            className={cn(
              'cursor-pointer px-3 py-1.5 text-sm transition-colors whitespace-nowrap',
              isActive
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Link href={`${baseUrl}?specialty=${specialty.id}`}>
              {specialty.name} ({specialty.qc_count})
            </Link>
          </Badge>
        )
      })}
    </nav>
  )
}
