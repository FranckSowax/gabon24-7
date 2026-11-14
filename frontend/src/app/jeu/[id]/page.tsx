import GameInterface from '@/components/game/GameInterface'

// Next 16 : `params` est une promesse (l'accès synchrone a été retiré).
export default async function GameSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <GameInterface initialSessionId={id} />
}
