import GameInterface from '@/components/game/GameInterface'

export default function GameSessionPage({ params }: { params: { id: string } }) {
  return <GameInterface initialSessionId={params.id} />
}
