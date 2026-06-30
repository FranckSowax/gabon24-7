'use client'

import LevelCourse from '@/components/formations/LevelCourse'
import { LEVEL2_MODULES } from '@/lib/formations-content'

export default function Niveau2Page() {
  return (
    <LevelCourse
      level={2}
      title="Niveau 2 — Développement"
      ceilingText="Jusqu'à 5 000 000 FCFA"
      modules={LEVEL2_MODULES}
      nextHref="/formations/niveau-3"
      nextLabel="Passer au Niveau 3"
    />
  )
}
