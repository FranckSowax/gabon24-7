import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Filter, 
  Plus, 
  Edit, 
  Trash2, 
  TestTube, 
  Save,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Star
} from 'lucide-react';

interface FilterConfig {
  keywords: string[];
  categories: string[];
  sources: string[];
  excludeKeywords: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
  dateRange?: number; // jours
}

interface UserFilter {
  id: string;
  name: string;
  description?: string;
  filter_config: FilterConfig;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface FilterManagerProps {
  userId: string;
  isPremiumUser: boolean;
}

const FilterManager: React.FC<FilterManagerProps> = ({ userId, isPremiumUser }) => {
  const [filters, setFilters] = useState<UserFilter[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingFilter, setEditingFilter] = useState<UserFilter | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [testingFilter, setTestingFilter] = useState<string | null>(null);

  // Formulaire
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    keywords: '',
    categories: '',
    sources: '',
    excludeKeywords: '',
    sentiment: '',
    dateRange: 7,
    is_active: true
  });

  useEffect(() => {
    if (isPremiumUser) {
      fetchUserFilters();
    }
  }, [userId, isPremiumUser]);

  const fetchUserFilters = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/filters?user_id=${userId}`);
      const data = await response.json();
      
      if (data.success) {
        setFilters(data.data);
      }
    } catch (error) {
      console.error('Erreur récupération filtres:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      keywords: '',
      categories: '',
      sources: '',
      excludeKeywords: '',
      sentiment: '',
      dateRange: 7,
      is_active: true
    });
    setEditingFilter(null);
    setShowCreateForm(false);
  };

  const handleEdit = (filter: UserFilter) => {
    setEditingFilter(filter);
    setFormData({
      name: filter.name,
      description: filter.description || '',
      keywords: filter.filter_config.keywords.join(', '),
      categories: filter.filter_config.categories.join(', '),
      sources: filter.filter_config.sources.join(', '),
      excludeKeywords: filter.filter_config.excludeKeywords.join(', '),
      sentiment: filter.filter_config.sentiment || '',
      dateRange: filter.filter_config.dateRange || 7,
      is_active: filter.is_active
    });
    setShowCreateForm(true);
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      const filterConfig: FilterConfig = {
        keywords: formData.keywords.split(',').map(k => k.trim()).filter(k => k),
        categories: formData.categories.split(',').map(c => c.trim()).filter(c => c),
        sources: formData.sources.split(',').map(s => s.trim()).filter(s => s),
        excludeKeywords: formData.excludeKeywords.split(',').map(k => k.trim()).filter(k => k),
        sentiment: formData.sentiment as any || undefined,
        dateRange: formData.dateRange
      };

      const payload = {
        user_id: userId,
        name: formData.name,
        description: formData.description,
        filter_config: filterConfig,
        is_active: formData.is_active
      };

      let response;
      if (editingFilter) {
        response = await fetch(`/api/v1/filters/${editingFilter.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        response = await fetch('/api/v1/filters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const data = await response.json();

      if (data.success) {
        await fetchUserFilters();
        resetForm();
        alert(editingFilter ? 'Filtre mis à jour!' : 'Filtre créé!');
      } else {
        alert(`Erreur: ${data.message}`);
      }
    } catch (error) {
      console.error('Erreur sauvegarde filtre:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (filterId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce filtre?')) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/v1/filters/${filterId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        await fetchUserFilters();
        alert('Filtre supprimé!');
      } else {
        alert(`Erreur: ${data.message}`);
      }
    } catch (error) {
      console.error('Erreur suppression filtre:', error);
      alert('Erreur lors de la suppression');
    } finally {
      setLoading(false);
    }
  };

  const testFilter = async (filter: UserFilter) => {
    try {
      setTestingFilter(filter.id);
      setTestResults(null);

      const response = await fetch('/api/v1/filters/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filter_config: filter.filter_config })
      });

      const data = await response.json();

      if (data.success) {
        setTestResults(data.data);
      } else {
        alert(`Erreur test: ${data.message}`);
      }
    } catch (error) {
      console.error('Erreur test filtre:', error);
      alert('Erreur lors du test');
    } finally {
      setTestingFilter(null);
    }
  };

  const toggleFilterStatus = async (filter: UserFilter) => {
    try {
      const response = await fetch(`/api/v1/filters/${filter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !filter.is_active })
      });

      const data = await response.json();

      if (data.success) {
        await fetchUserFilters();
      } else {
        alert(`Erreur: ${data.message}`);
      }
    } catch (error) {
      console.error('Erreur toggle filtre:', error);
      alert('Erreur lors de la mise à jour');
    }
  };

  if (!isPremiumUser) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="pt-6">
          <div className="text-center">
            <Star className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-yellow-900 mb-2">
              Fonctionnalité Premium
            </h3>
            <p className="text-yellow-800 mb-4">
              Les filtres personnalisés sont réservés aux abonnés Premium et Journaliste.
            </p>
            <Button className="bg-yellow-600 hover:bg-yellow-700">
              Passer à Premium
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-500 text-white p-6 rounded-lg">
        <h1 className="text-2xl font-bold mb-2">🔍 Gestionnaire de Filtres Premium</h1>
        <p className="opacity-90">Créez des filtres personnalisés pour recevoir uniquement les actualités qui vous intéressent</p>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Mes Filtres ({filters.length})</h2>
          <p className="text-sm text-gray-600">Gérez vos filtres d'actualités personnalisés</p>
        </div>
        <Button 
          onClick={() => setShowCreateForm(true)}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nouveau Filtre
        </Button>
      </div>

      {/* Liste des filtres */}
      {loading && !showCreateForm ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filters.map(filter => (
            <Card key={filter.id} className={`${filter.is_active ? 'border-green-200' : 'border-gray-200'}`}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base">{filter.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={filter.is_active}
                      onCheckedChange={() => toggleFilterStatus(filter)}
                    />
                    <Badge variant={filter.is_active ? "default" : "secondary"}>
                      {filter.is_active ? 'Actif' : 'Inactif'}
                    </Badge>
                  </div>
                </div>
                {filter.description && (
                  <p className="text-sm text-gray-600">{filter.description}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Configuration du filtre */}
                <div className="space-y-2">
                  {filter.filter_config.keywords.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-700">Mots-clés:</p>
                      <div className="flex flex-wrap gap-1">
                        {filter.filter_config.keywords.slice(0, 3).map(keyword => (
                          <Badge key={keyword} variant="outline" className="text-xs">
                            {keyword}
                          </Badge>
                        ))}
                        {filter.filter_config.keywords.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{filter.filter_config.keywords.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {filter.filter_config.categories.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-700">Catégories:</p>
                      <div className="flex flex-wrap gap-1">
                        {filter.filter_config.categories.map(category => (
                          <Badge key={category} variant="secondary" className="text-xs">
                            {category}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {filter.filter_config.sentiment && (
                    <div>
                      <p className="text-xs font-medium text-gray-700">Sentiment:</p>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          filter.filter_config.sentiment === 'positive' ? 'text-green-600' :
                          filter.filter_config.sentiment === 'negative' ? 'text-red-600' :
                          'text-gray-600'
                        }`}
                      >
                        {filter.filter_config.sentiment}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex justify-between items-center pt-2 border-t">
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(filter)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testFilter(filter)}
                      disabled={testingFilter === filter.id}
                    >
                      {testingFilter === filter.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <TestTube className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(filter.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    {new Date(filter.updated_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Formulaire de création/édition */}
      {showCreateForm && (
        <Card className="border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{editingFilter ? 'Modifier le Filtre' : 'Nouveau Filtre'}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={resetForm}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Nom du filtre *</label>
                <Input
                  placeholder="Ex: Actualités Économiques"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <Input
                  placeholder="Description du filtre"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Mots-clés (séparés par des virgules)</label>
              <Input
                placeholder="Ex: économie, pétrole, investissement"
                value={formData.keywords}
                onChange={(e) => setFormData(prev => ({ ...prev, keywords: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Catégories</label>
                <Input
                  placeholder="Ex: Économie, Politique"
                  value={formData.categories}
                  onChange={(e) => setFormData(prev => ({ ...prev, categories: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Sources</label>
                <Input
                  placeholder="Ex: L'Union, Gabon Matin"
                  value={formData.sources}
                  onChange={(e) => setFormData(prev => ({ ...prev, sources: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Mots-clés à exclure</label>
              <Input
                placeholder="Ex: sport, divertissement"
                value={formData.excludeKeywords}
                onChange={(e) => setFormData(prev => ({ ...prev, excludeKeywords: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Sentiment</label>
                <select
                  className="w-full p-2 border rounded-md"
                  value={formData.sentiment}
                  onChange={(e) => setFormData(prev => ({ ...prev, sentiment: e.target.value }))}
                >
                  <option value="">Tous</option>
                  <option value="positive">Positif</option>
                  <option value="negative">Négatif</option>
                  <option value="neutral">Neutre</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Période (jours)</label>
                <Input
                  type="number"
                  min="1"
                  max="30"
                  value={formData.dateRange}
                  onChange={(e) => setFormData(prev => ({ ...prev, dateRange: parseInt(e.target.value) }))}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked: boolean) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
              <label className="text-sm font-medium">Activer ce filtre</label>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={resetForm}>
                Annuler
              </Button>
              <Button 
                onClick={handleSave}
                disabled={loading || !formData.name}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sauvegarde...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {editingFilter ? 'Mettre à jour' : 'Créer'}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Résultats de test */}
      {testResults && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <CheckCircle className="h-5 w-5" />
              Résultats du Test
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-blue-800">
                <strong>{testResults.matchingArticles || 0}</strong> articles correspondent à ce filtre
              </p>
              {testResults.sampleArticles && testResults.sampleArticles.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-blue-900 mb-2">Exemples d'articles:</p>
                  <div className="space-y-2">
                    {testResults.sampleArticles.slice(0, 3).map((article: any, index: number) => (
                      <div key={index} className="bg-white p-2 rounded border">
                        <p className="text-xs font-medium">{article.title}</p>
                        <p className="text-xs text-gray-600">{article.source}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Aide */}
      <Card className="border-gray-200 bg-gray-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-gray-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-gray-900 mb-2">💡 Conseils pour créer des filtres efficaces</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Utilisez des mots-clés spécifiques pour des résultats précis</li>
                <li>• Combinez plusieurs critères pour affiner vos filtres</li>
                <li>• Testez vos filtres avant de les activer</li>
                <li>• Utilisez les mots-clés à exclure pour éviter le contenu non désiré</li>
                <li>• Ajustez la période selon vos besoins (actualités récentes vs historique)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FilterManager;
