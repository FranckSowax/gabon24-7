import Link from 'next/link'

export const metadata = { title: 'Hors-ligne' }

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <div className="text-5xl mb-3">📡</div>
        <h1 className="text-xl font-black text-slate-900">Vous êtes hors-ligne</h1>
        <p className="text-sm text-slate-600 mt-2">
          Pas de connexion pour le moment. Les pages et cours déjà visités restent
          disponibles, et votre progression sera synchronisée au retour du réseau.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Link href="/formations" className="w-full inline-flex items-center justify-center px-5 py-3 rounded-xl bg-[#697357] hover:bg-[#4d553e] text-white font-bold">
            Reprendre mes formations
          </Link>
          <a href="/formations/" className="text-sm text-slate-500 underline">Réessayer</a>
        </div>
      </div>
    </div>
  )
}
