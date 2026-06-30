'use client'

import LevelCourse from '@/components/formations/LevelCourse'
import { LEVEL1_MODULES } from '@/lib/formations-content'

export default function Niveau1ApprendrePage() {
  return (
    <LevelCourse
      level={1}
      title="Niveau 1 — Fondamentaux"
      ceilingText="Jusqu'à 1 000 000 FCFA"
      modules={LEVEL1_MODULES}
      nextHref="/formations/niveau-2"
      nextLabel="Passer au Niveau 2"
    />
  )
}
