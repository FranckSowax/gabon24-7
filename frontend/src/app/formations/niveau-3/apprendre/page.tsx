'use client'

import LevelCourse from '@/components/formations/LevelCourse'
import { LEVEL3_MODULES } from '@/lib/formations-content'

export default function Niveau3ApprendrePage() {
  return (
    <LevelCourse
      level={3}
      title="Niveau 3 — Croissance"
      ceilingText="Au-delà de 5 000 000 FCFA"
      modules={LEVEL3_MODULES}
      nextHref="/business/mes-projets"
      nextLabel="Préparer ma demande de financement"
    />
  )
}
