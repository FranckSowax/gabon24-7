import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  Sparkles, 
  Clock, 
  TrendingUp, 
  Edit3, 
  Send,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface Article {
  id: string;
  title: string;
  summary: string;
  ai_summary?: string;
  category: string;
  published_at: string;
  rss_feeds?: {
    name: string;
  };
}

interface EditorialGeneratorProps {
  journalistId: string;
}

const EditorialGenerator: React.FC<EditorialGeneratorProps> = ({ journalistId }) => {
  const [selectedArticles, setSelectedArticles] = useState<Article[]>([]);
  const [availableArticles, setAvailableArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [theme, setTheme] = useState('');
  const [instructions, setInstructions] = useState('');
  const [title, setTitle] = useState('');
  const [activeTab, setActiveTab] = useState('matinale');

  useEffect(() => {
    fetchAvailableArticles();
  }, []);

  const fetchAvailableArticles = async () => {
    try {
      const response = await fetch('/api/v1/articles?limit=50&sort=published_at&order=desc');
      const data = await response.json();
      
      if (data.success) {
        setAvailableArticles(data.data);
      }
    } catch (error) {
      console.error('Erreur récupération articles:', error);
    }
  };

  const toggleArticleSelection = (article: Article) => {
    setSelectedArticles(prev => {
      const isSelected = prev.find(a => a.id === article.id);
      if (isSelected) {
        return prev.filter(a => a.id !== article.id);
      } else {
        return [...prev, article];
      }
    });
  };

  const generateEditorial = async (type: string) => {
    if (selectedArticles.length === 0) {
      alert('Veuillez sélectionner au moins un article');
      return;
    }

    setLoading(true);
    setGeneratedContent('');

    try {
      let endpoint = '';
      let payload: any = {
        selectedArticles,
        customPrompt: customPrompt || null,
        journalistId
      };

      switch (type) {
        case 'matinale':
          endpoint = '/api/v1/journalist/matinale';
          break;
        case 'analyse':
          if (!theme) {
            alert('Veuillez spécifier un thème pour l\'analyse');
            return;
          }
          endpoint = '/api/v1/journalist/analyse';
          payload.theme = theme;
          break;
        case 'revue-presse':
          endpoint = '/api/v1/journalist/revue-presse';
          break;
        case 'editorial':
          if (!instructions) {
            alert('Veuillez fournir des instructions pour l\'éditorial');
            return;
          }
          endpoint = '/api/v1/journalist/editorial';
          payload.instructions = instructions;
          payload.title = title;
          break;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.success) {
        setGeneratedContent(data.data.content);
        if (data.data.fallback) {
          alert('⚠️ Contenu généré en mode démonstration (OpenAI non configuré)');
        }
      } else {
        alert(`Erreur: ${data.message}`);
      }
    } catch (error) {
      console.error('Erreur génération éditorial:', error);
      alert('Erreur lors de la génération');
    } finally {
      setLoading(false);
    }
  };

  const publishEditorial = async () => {
    if (!generatedContent) {
      alert('Aucun contenu à publier');
      return;
    }

    try {
      // Pour cette démo, on simule la publication
      alert('Éditorial publié avec succès! 🎉');
      setGeneratedContent('');
      setSelectedArticles([]);
      setCustomPrompt('');
      setTheme('');
      setInstructions('');
      setTitle('');
    } catch (error) {
      console.error('Erreur publication:', error);
      alert('Erreur lors de la publication');
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-green-600 to-yellow-500 text-white p-6 rounded-lg">
        <h1 className="text-2xl font-bold mb-2">🖋️ Générateur d'Éditoriaux IA</h1>
        <p className="opacity-90">Créez des contenus journalistiques professionnels assistés par l'IA</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sélection d'articles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Articles Disponibles ({availableArticles.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {availableArticles.map(article => (
                <div
                  key={article.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-all ${
                    selectedArticles.find(a => a.id === article.id)
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => toggleArticleSelection(article)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-sm line-clamp-2">{article.title}</h4>
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {article.category}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                    {article.ai_summary || article.summary}
                  </p>
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span>{article.rss_feeds?.name || 'Source inconnue'}</span>
                    <span>{new Date(article.published_at).toLocaleDateString('fr-FR')}</span>
                  </div>
                </div>
              ))}
            </div>
            
            {selectedArticles.length > 0 && (
              <div className="mt-4 p-3 bg-green-50 rounded-lg">
                <p className="text-sm font-medium text-green-800">
                  ✓ {selectedArticles.length} article(s) sélectionné(s)
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Générateur d'éditoriaux */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Générateur d'Éditoriaux
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="matinale" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  Matinale
                </TabsTrigger>
                <TabsTrigger value="analyse" className="text-xs">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Analyse
                </TabsTrigger>
                <TabsTrigger value="revue-presse" className="text-xs">
                  <FileText className="h-3 w-3 mr-1" />
                  Revue
                </TabsTrigger>
                <TabsTrigger value="editorial" className="text-xs">
                  <Edit3 className="h-3 w-3 mr-1" />
                  Éditorial
                </TabsTrigger>
              </TabsList>

              <TabsContent value="matinale" className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Instructions personnalisées (optionnel)
                  </label>
                  <Textarea
                    placeholder="Ex: Mettez l'accent sur les actualités économiques..."
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    rows={3}
                  />
                </div>
                <Button 
                  onClick={() => generateEditorial('matinale')}
                  disabled={loading || selectedArticles.length === 0}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Génération...
                    </>
                  ) : (
                    <>
                      <Clock className="h-4 w-4 mr-2" />
                      Générer Matinale
                    </>
                  )}
                </Button>
              </TabsContent>

              <TabsContent value="analyse" className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Thème d'analyse *
                  </label>
                  <Input
                    placeholder="Ex: Économie gabonaise, Politique, Environnement..."
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Instructions personnalisées (optionnel)
                  </label>
                  <Textarea
                    placeholder="Ex: Focalisez sur les impacts à long terme..."
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    rows={3}
                  />
                </div>
                <Button 
                  onClick={() => generateEditorial('analyse')}
                  disabled={loading || selectedArticles.length === 0 || !theme}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Génération...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Générer Analyse
                    </>
                  )}
                </Button>
              </TabsContent>

              <TabsContent value="revue-presse" className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Instructions personnalisées (optionnel)
                  </label>
                  <Textarea
                    placeholder="Ex: Organisez par ordre d'importance..."
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    rows={3}
                  />
                </div>
                <Button 
                  onClick={() => generateEditorial('revue-presse')}
                  disabled={loading || selectedArticles.length === 0}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Génération...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Générer Revue de Presse
                    </>
                  )}
                </Button>
              </TabsContent>

              <TabsContent value="editorial" className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Titre de l'éditorial (optionnel)
                  </label>
                  <Input
                    placeholder="Ex: Réflexions sur l'avenir du Gabon"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Instructions spécifiques *
                  </label>
                  <Textarea
                    placeholder="Ex: Rédigez un éditorial sur l'importance de la diversification économique au Gabon..."
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    rows={4}
                  />
                </div>
                <Button 
                  onClick={() => generateEditorial('editorial')}
                  disabled={loading || selectedArticles.length === 0 || !instructions}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Génération...
                    </>
                  ) : (
                    <>
                      <Edit3 className="h-4 w-4 mr-2" />
                      Générer Éditorial
                    </>
                  )}
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Contenu généré */}
      {generatedContent && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Contenu Généré
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigator.clipboard.writeText(generatedContent)}
                >
                  Copier
                </Button>
                <Button
                  size="sm"
                  onClick={publishEditorial}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Publier
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 p-4 rounded-lg">
              <pre className="whitespace-pre-wrap text-sm font-mono">
                {generatedContent}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Aide */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900 mb-2">💡 Conseils d'utilisation</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <strong>Matinale</strong>: Idéale pour un résumé quotidien des actualités</li>
                <li>• <strong>Analyse thématique</strong>: Pour approfondir un sujet spécifique</li>
                <li>• <strong>Revue de presse</strong>: Pour une synthèse organisée par catégories</li>
                <li>• <strong>Éditorial personnalisé</strong>: Pour un contenu sur mesure selon vos instructions</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EditorialGenerator;
