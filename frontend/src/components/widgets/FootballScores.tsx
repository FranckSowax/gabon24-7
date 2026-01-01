'use client'

import React, { useState, useEffect } from 'react';
import { Calendar, RefreshCw } from 'lucide-react';

export default function FootballScores() {
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true); // true = matchs en direct, false = matchs du jour
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const groupByLeague = (data: any[]) => {
    const fixturesByLeague: any = {};
    (data || []).forEach((fixture: any) => {
      const leagueName = fixture.league.name;
      if (!fixturesByLeague[leagueName]) {
        fixturesByLeague[leagueName] = {
          league: fixture.league,
          fixtures: []
        };
      }
      fixturesByLeague[leagueName].fixtures.push(fixture);
    });
    return Object.values(fixturesByLeague);
  };

  const fetchFixtures = async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. D'abord essayer les matchs en direct
      const liveResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/football/fixtures`);

      if (!liveResponse.ok) {
        throw new Error('Erreur lors de la récupération des données');
      }

      const liveData = await liveResponse.json();

      // Si on a des matchs en direct, les afficher
      if (liveData.response && liveData.response.length > 0) {
        setFixtures(groupByLeague(liveData.response));
        setIsLive(true);
        setLastUpdate(new Date());
        return;
      }

      // 2. Sinon, récupérer les matchs du jour
      const todayResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/football/fixtures/date`);

      if (todayResponse.ok) {
        const todayData = await todayResponse.json();
        if (todayData.response && todayData.response.length > 0) {
          setFixtures(groupByLeague(todayData.response));
          setIsLive(false);
          setLastUpdate(new Date());
          return;
        }
      }

      // 3. Aucun match trouvé
      setFixtures([]);
      setIsLive(false);
      setLastUpdate(new Date());

    } catch (err: any) {
      console.error('Erreur football scores:', err);
      setError(err.message);
      // Charger les données de démonstration en cas d'erreur
      loadDemoData();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFixtures();

    // Rafraîchir toutes les 2 minutes
    const interval = setInterval(fetchFixtures, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Fonction de démonstration avec données réalistes
  const loadDemoData = () => {
    const demoData = [
      {
        league: {
          id: 39,
          name: "Championnat d'Angleterre",
          logo: 'https://media.api-sports.io/football/leagues/39.png',
          round: '9e journée'
        },
        fixtures: [
          {
            fixture: {
              id: 1,
              date: new Date().toISOString(),
              status: { short: 'FT', long: 'Terminé', elapsed: 90 },
              venue: { name: 'Emirates Stadium' }
            },
            teams: {
              home: { 
                id: 42, 
                name: 'Arsenal', 
                logo: 'https://media.api-sports.io/football/teams/42.png',
                winner: true
              },
              away: { 
                id: 52, 
                name: 'Crystal Palace', 
                logo: 'https://media.api-sports.io/football/teams/52.png',
                winner: false
              }
            },
            goals: { home: 1, away: 0 }
          },
          {
            fixture: {
              id: 2,
              date: new Date().toISOString(),
              status: { short: 'FT', long: 'Terminé', elapsed: 90 },
              venue: { name: 'Villa Park' }
            },
            teams: {
              home: { 
                id: 66, 
                name: 'Aston Villa', 
                logo: 'https://media.api-sports.io/football/teams/66.png',
                winner: true
              },
              away: { 
                id: 50, 
                name: 'Manchester City', 
                logo: 'https://media.api-sports.io/football/teams/50.png',
                winner: false
              }
            },
            goals: { home: 1, away: 0 }
          }
        ]
      }
    ];
    setFixtures(demoData);
  };


  return (
    <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-3xl shadow-2xl overflow-hidden">
      {/* Header avec matchs en direct */}
      <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-red-600 z-10">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isLive && fixtures.length > 0 && (
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              )}
              <h3 className="text-white font-bold text-lg">
                ⚽ {isLive && fixtures.length > 0 ? 'Matchs en Direct' : 'Matchs du Jour'}
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
      <div className="p-4 max-h-[600px] overflow-y-auto custom-scrollbar">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          </div>
        )}

        {error && (
          <div className="bg-blue-50 border border-blue-300 rounded-lg p-3 mb-4">
            <p className="text-blue-800 text-sm font-medium">ℹ️ Mode Démonstration</p>
            <p className="text-blue-600 text-xs mt-1">Les scores en temps réel seront disponibles prochainement</p>
          </div>
        )}

        {!loading && fixtures.length === 0 && !error && (
          <div className="text-center py-12 text-gray-500">
            <Calendar size={48} className="mx-auto mb-4 opacity-50" />
            <p className="font-medium">Aucun match en direct</p>
            <p className="text-sm mt-2">Les matchs s'afficheront dès qu'ils commencent</p>
          </div>
        )}

        {!loading && fixtures.map((leagueData: any, leagueIndex: number) => (
          <div key={leagueIndex} className="mb-6">
            {/* En-tête de la ligue */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {leagueData.league.logo && (
                  <img 
                    src={leagueData.league.logo} 
                    alt={leagueData.league.name}
                    className="w-6 h-6 object-contain"
                  />
                )}
                <div>
                  <h2 className="text-base font-bold text-gray-800">{leagueData.league.name}</h2>
                  {leagueData.league.round && (
                    <p className="text-xs text-gray-500">{leagueData.league.round}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Liste des matchs */}
            <div className="space-y-2">
              {leagueData.fixtures.map((fixture: any) => (
                <div 
                  key={fixture.fixture.id}
                  className="bg-white rounded-lg p-3 hover:shadow-lg hover:border-orange-400 border-2 border-transparent transition-all"
                >
                  {/* Équipe domicile */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3 flex-1">
                      {fixture.teams.home.logo && (
                        <img 
                          src={fixture.teams.home.logo} 
                          alt={fixture.teams.home.name}
                          className="w-6 h-6 object-contain"
                        />
                      )}
                      <span className="font-medium text-gray-800 text-sm">{fixture.teams.home.name}</span>
                      {fixture.teams.home.winner && (
                        <span className="text-green-500 text-xs font-bold">✓</span>
                      )}
                    </div>
                    <div className="text-xl font-bold min-w-[40px] text-right text-gray-900">
                      {fixture.goals.home !== null ? fixture.goals.home : '-'}
                    </div>
                  </div>

                  {/* Équipe extérieur */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      {fixture.teams.away.logo && (
                        <img 
                          src={fixture.teams.away.logo} 
                          alt={fixture.teams.away.name}
                          className="w-6 h-6 object-contain"
                        />
                      )}
                      <span className="font-medium text-gray-800 text-sm">{fixture.teams.away.name}</span>
                      {fixture.teams.away.winner && (
                        <span className="text-green-500 text-xs font-bold">✓</span>
                      )}
                    </div>
                    <div className="text-xl font-bold min-w-[40px] text-right text-gray-900">
                      {fixture.goals.away !== null ? fixture.goals.away : '-'}
                    </div>
                  </div>

                  {/* Statut du match */}
                  <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between text-xs">
                    <span className={`${
                      fixture.fixture.status.short === 'LIVE' || fixture.fixture.status.short === '1H' || fixture.fixture.status.short === '2H'
                        ? 'text-red-500 font-semibold'
                        : 'text-gray-500'
                    }`}>
                      {fixture.fixture.status.short === 'NS' 
                        ? new Date(fixture.fixture.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                        : fixture.fixture.status.short === 'FT' 
                        ? 'Terminé'
                        : fixture.fixture.status.short === 'LIVE' || fixture.fixture.status.short === '1H' || fixture.fixture.status.short === '2H'
                        ? `${fixture.fixture.status.elapsed}'` 
                        : fixture.fixture.status.long
                      }
                    </span>
                    {fixture.fixture.venue?.name && (
                      <span className="text-gray-400 text-xs truncate ml-2">{fixture.fixture.venue.name}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #fb923c;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #f97316;
        }
      `}</style>
    </div>
  );
}
