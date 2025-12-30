import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  MessageCircle, 
  Users, 
  Send, 
  Plus,
  Settings,
  BarChart3,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface WhatsAppChannel {
  id: string;
  name: string;
  description: string;
  is_premium: boolean;
  is_active: boolean;
  subscriber_count: number;
  created_at: string;
}

interface ChannelStats {
  totalChannels: number;
  activeChannels: number;
  totalSubscribers: number;
  scheduledBroadcasts: number;
  channelDetails: WhatsAppChannel[];
}

const WhatsAppChannelsPage: React.FC = () => {
  const [channels, setChannels] = useState<WhatsAppChannel[]>([]);
  const [stats, setStats] = useState<ChannelStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [showBroadcastForm, setShowBroadcastForm] = useState(false);
  const [broadcastData, setBroadcastData] = useState({
    channel_id: '',
    content: '',
    scheduled_at: ''
  });

  useEffect(() => {
    fetchChannelsAndStats();
  }, []);

  const fetchChannelsAndStats = async () => {
    try {
      setLoading(true);
      
      // Récupérer les canaux
      const channelsResponse = await fetch('/api/v1/channels');
      const channelsData = await channelsResponse.json();
      
      // Récupérer les statistiques
      const statsResponse = await fetch('/api/v1/channels/stats');
      const statsData = await statsResponse.json();
      
      if (channelsData.success) {
        setChannels(channelsData.data);
      }
      
      if (statsData.success) {
        setStats(statsData.data);
      }
    } catch (error) {
      console.error('Erreur récupération données:', error);
    } finally {
      setLoading(false);
    }
  };

  const scheduleBroadcast = async () => {
    if (!broadcastData.channel_id || !broadcastData.content) {
      alert('Veuillez remplir tous les champs requis');
      return;
    }

    try {
      setLoading(true);
      
      const response = await fetch('/api/v1/channels/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...broadcastData,
          scheduled_at: broadcastData.scheduled_at || new Date().toISOString()
        })
      });

      const data = await response.json();

      if (data.success) {
        alert('Diffusion programmée avec succès!');
        setBroadcastData({ channel_id: '', content: '', scheduled_at: '' });
        setShowBroadcastForm(false);
        await fetchChannelsAndStats();
      } else {
        alert(`Erreur: ${data.message}`);
      }
    } catch (error) {
      console.error('Erreur programmation diffusion:', error);
      alert('Erreur lors de la programmation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-green-600 to-blue-500 text-white p-6 rounded-lg">
        <h1 className="text-2xl font-bold mb-2">📱 Gestion des Canaux WhatsApp</h1>
        <p className="opacity-90">Gérez vos canaux de diffusion et programmez vos messages</p>
      </div>

      {/* Statistiques */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <MessageCircle className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Canaux</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalChannels}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Canaux Actifs</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.activeChannels}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Abonnés</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalSubscribers.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Diffusions Programmées</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.scheduledBroadcasts}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Canaux WhatsApp ({channels.length})</h2>
          <p className="text-sm text-gray-600">Gérez vos canaux de diffusion et leurs paramètres</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setShowBroadcastForm(true)}
            className="bg-green-600 hover:bg-green-700"
          >
            <Send className="h-4 w-4 mr-2" />
            Programmer Diffusion
          </Button>
          <Button variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Nouveau Canal
          </Button>
        </div>
      </div>

      {/* Liste des canaux */}
      {loading && !showBroadcastForm ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {channels.map(channel => (
            <Card key={channel.id} className={`${channel.is_active ? 'border-green-200' : 'border-gray-200'}`}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    {channel.name}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {channel.is_premium && (
                      <Badge variant="secondary" className="text-xs">
                        Premium
                      </Badge>
                    )}
                    <Badge variant={channel.is_active ? "default" : "secondary"}>
                      {channel.is_active ? 'Actif' : 'Inactif'}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-gray-600">{channel.description}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">
                      {channel.subscriber_count.toLocaleString()} abonnés
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline">
                      <BarChart3 className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline">
                      <Settings className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  Créé le {new Date(channel.created_at).toLocaleDateString('fr-FR')}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Formulaire de diffusion */}
      {showBroadcastForm && (
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Programmer une Diffusion
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBroadcastForm(false)}
              >
                ✕
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Canal de diffusion *</label>
              <select
                className="w-full p-2 border rounded-md"
                value={broadcastData.channel_id}
                onChange={(e) => setBroadcastData(prev => ({ ...prev, channel_id: e.target.value }))}
              >
                <option value="">Sélectionner un canal</option>
                {channels.filter(c => c.is_active).map(channel => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name} ({channel.subscriber_count} abonnés)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Contenu du message *</label>
              <Textarea
                placeholder="Rédigez votre message..."
                value={broadcastData.content}
                onChange={(e) => setBroadcastData(prev => ({ ...prev, content: e.target.value }))}
                rows={6}
              />
              <p className="text-xs text-gray-500 mt-1">
                {broadcastData.content.length}/1000 caractères
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Programmer pour (optionnel)</label>
              <Input
                type="datetime-local"
                value={broadcastData.scheduled_at}
                onChange={(e) => setBroadcastData(prev => ({ ...prev, scheduled_at: e.target.value }))}
              />
              <p className="text-xs text-gray-500 mt-1">
                Laisser vide pour envoyer immédiatement
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => setShowBroadcastForm(false)}
              >
                Annuler
              </Button>
              <Button 
                onClick={scheduleBroadcast}
                disabled={loading || !broadcastData.channel_id || !broadcastData.content}
                className="bg-green-600 hover:bg-green-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Programmation...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Programmer
                  </>
                )}
              </Button>
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
              <h4 className="font-medium text-blue-900 mb-2">💡 Conseils pour les diffusions WhatsApp</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Gardez vos messages concis et informatifs</li>
                <li>• Utilisez des emojis pour rendre le contenu plus engageant</li>
                <li>• Programmez vos diffusions aux heures de forte audience</li>
                <li>• Testez vos messages sur un petit groupe avant diffusion massive</li>
                <li>• Respectez la fréquence d'envoi pour éviter le spam</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppChannelsPage;
