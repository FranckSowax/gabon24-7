import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EditorialGenerator from '@/components/journalist/EditorialGenerator';
import { 
  PenTool, 
  FileText, 
  BarChart3, 
  Settings,
  User,
  Crown
} from 'lucide-react';

const JournalistPortal: React.FC = () => {
  const [journalistId] = useState('demo-journalist-001'); // En production, récupérer depuis l'auth

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-green-600 to-yellow-500 rounded-lg flex items-center justify-center">
                  <PenTool className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-gray-900">Portail Journaliste</h1>
              </div>
              <div className="flex items-center space-x-2 bg-yellow-100 px-3 py-1 rounded-full">
                <Crown className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">Compte Journaliste</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm">
                <User className="h-4 w-4 mr-2" />
                Mon Profil
              </Button>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Paramètres
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="generator" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="generator" className="flex items-center gap-2">
              <PenTool className="h-4 w-4" />
              Générateur IA
            </TabsTrigger>
            <TabsTrigger value="editorials" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Mes Éditoriaux
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Statistiques
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configuration
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generator">
            <EditorialGenerator journalistId={journalistId} />
          </TabsContent>

          <TabsContent value="editorials">
            <Card>
              <CardHeader>
                <CardTitle>📝 Mes Éditoriaux</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Historique des Éditoriaux
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Retrouvez ici tous vos éditoriaux créés et publiés
                  </p>
                  <Button>Voir tous mes éditoriaux</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Éditoriaux créés</p>
                      <p className="text-2xl font-bold text-gray-900">12</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <PenTool className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Publiés</p>
                      <p className="text-2xl font-bold text-gray-900">8</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <BarChart3 className="h-6 w-6 text-yellow-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Vues totales</p>
                      <p className="text-2xl font-bold text-gray-900">2.4k</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Crown className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Score qualité</p>
                      <p className="text-2xl font-bold text-gray-900">94%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>📊 Statistiques Détaillées</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Analytics Avancées
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Suivez les performances de vos éditoriaux et leur impact
                  </p>
                  <Button>Voir les détails</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>⚙️ Préférences IA</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Style d'écriture préféré
                    </label>
                    <select className="w-full p-2 border rounded-md">
                      <option>Journalistique classique</option>
                      <option>Analytique approfondi</option>
                      <option>Accessible et engageant</option>
                      <option>Formel et institutionnel</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Longueur d'article par défaut
                    </label>
                    <select className="w-full p-2 border rounded-md">
                      <option>Court (300-500 mots)</option>
                      <option>Moyen (500-800 mots)</option>
                      <option>Long (800-1200 mots)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Thèmes de spécialisation
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {['Politique', 'Économie', 'Société', 'Culture', 'Sport', 'Environnement'].map(theme => (
                        <Button key={theme} variant="outline" size="sm">
                          {theme}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>🔧 Configuration du Compte</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Nom d'affichage
                    </label>
                    <input 
                      type="text" 
                      className="w-full p-2 border rounded-md" 
                      placeholder="Votre nom professionnel"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Affiliation média
                    </label>
                    <input 
                      type="text" 
                      className="w-full p-2 border rounded-md" 
                      placeholder="Ex: L'Union, Gabon Matin..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Bio professionnelle
                    </label>
                    <textarea 
                      className="w-full p-2 border rounded-md" 
                      rows={3}
                      placeholder="Décrivez votre expérience journalistique..."
                    />
                  </div>
                  <Button className="w-full">
                    Sauvegarder les modifications
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default JournalistPortal;
