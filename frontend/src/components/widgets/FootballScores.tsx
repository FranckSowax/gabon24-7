'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, RefreshCw } from 'lucide-react';

export default function FootballScores({ className = '' }: { className?: string }) {
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const groupByLeague = (data: any[]) => {
    const byLeague: Record<string, { league: any; fixtures: any[] }> = {};
    for (const fixture of data) {
      const name = fixture.league?.name || 'Compétition';
      if (!byLeague[name]) {
        byLeague[name] = { league: fixture.league, fixtures: [] };
      }
      byLeague[name].fixtures.push(fixture);
    }
    return Object.values(byLeague);
  };

  const fetchFixtures = useCallback(async () => {
    setLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/football/fixtures`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      if (data.response && data.response.length > 0) {
        setFixtures(groupByLeague(data.response));
        setIsLive(!!data.live);
      } else {
        setFixtures([]);
      }
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Erreur football scores:', err);
      setFixtures([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFixtures();
    const interval = setInterval(fetchFixtures, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchFixtures]);

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  return (
    <div className={`bg-gradient-to-br from-orange-50 to-red-50 rounded-3xl shadow-2xl overflow-hidden flex flex-col ${className}`}>
      {/* Header */}
      <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-red-600 z-10 flex-shrink-0">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isLive && fixtures.length > 0 && (
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              )}
              <h3 className="text-white font-bold text-lg">
                {isLive && fixtures.length > 0 ? 'Matchs en Direct' : 'Matchs du Jour'}
              </h3>
            </div>
            <button
              onClick={fetchFixtures}
              disabled={loading}
              className="p-1.5 rounded-full hover:bg-white/20 transition-colors disabled:opacity-50"
              title="Rafraîchir"
            >
              <RefreshCw size={16} className={`text-white ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-white/90 text-xs mt-1">
            {isLive && fixtures.length > 0 ? 'Scores en temps réel' : 'Programme du jour'}
            {lastUpdate && (
              <span className="ml-2 opacity-75">
                • MàJ {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Contenu */}
      <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
          </div>
        )}

        {!loading && fixtures.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Calendar size={48} className="mx-auto mb-4 opacity-50" />
            <p className="font-medium">Aucun match programmé</p>
            <p className="text-sm mt-2">Les matchs s'afficheront dès qu'ils sont disponibles</p>
          </div>
        )}

        {!loading && fixtures.map((leagueData: any, leagueIndex: number) => (
          <div key={leagueIndex} className="mb-5 last:mb-0">
            {/* En-tête ligue */}
            <div className="flex items-center gap-2 mb-2">
              {leagueData.league?.logo && (
                <img
                  src={leagueData.league.logo}
                  alt={leagueData.league.name}
                  className="w-5 h-5 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <div>
                <h2 className="text-sm font-bold text-gray-800">{leagueData.league?.name}</h2>
                {leagueData.league?.round && (
                  <p className="text-[10px] text-gray-500">{leagueData.league.round}</p>
                )}
              </div>
            </div>

            {/* Matchs */}
            <div className="space-y-1.5">
              {leagueData.fixtures.map((fixture: any) => {
                const st = fixture.fixture?.status;
                const isMatchLive = st?.short === 'LIVE' || st?.short === '1H' || st?.short === '2H' || st?.short === 'HT';

                return (
                  <div
                    key={fixture.fixture?.id}
                    className={`bg-white rounded-lg p-2.5 border transition-all ${
                      isMatchLive ? 'border-red-200 shadow-sm' : 'border-transparent hover:border-orange-200'
                    }`}
                  >
                    {/* Domicile */}
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="font-medium text-gray-800 text-sm truncate">
                          {fixture.teams?.home?.name}
                        </span>
                        {fixture.teams?.home?.winner && (
                          <span className="text-green-500 text-xs font-bold flex-shrink-0">✓</span>
                        )}
                      </div>
                      <div className="text-lg font-bold min-w-[32px] text-right text-gray-900">
                        {fixture.goals?.home !== null ? fixture.goals.home : '-'}
                      </div>
                    </div>

                    {/* Extérieur */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="font-medium text-gray-800 text-sm truncate">
                          {fixture.teams?.away?.name}
                        </span>
                        {fixture.teams?.away?.winner && (
                          <span className="text-green-500 text-xs font-bold flex-shrink-0">✓</span>
                        )}
                      </div>
                      <div className="text-lg font-bold min-w-[32px] text-right text-gray-900">
                        {fixture.goals?.away !== null ? fixture.goals.away : '-'}
                      </div>
                    </div>

                    {/* Statut */}
                    <div className="mt-1.5 pt-1.5 border-t border-gray-100 text-xs">
                      <span className={isMatchLive ? 'text-red-500 font-semibold' : 'text-gray-500'}>
                        {st?.short === 'NS'
                          ? formatTime(fixture.fixture?.date)
                          : st?.short === 'FT'
                          ? 'Terminé'
                          : st?.short === 'HT'
                          ? 'Mi-temps'
                          : isMatchLive
                          ? `${st?.elapsed || '?'}'`
                          : st?.short === 'CANC'
                          ? 'Annulé'
                          : st?.long || formatTime(fixture.fixture?.date)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #fb923c; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #f97316; }
      `}</style>
    </div>
  );
}
