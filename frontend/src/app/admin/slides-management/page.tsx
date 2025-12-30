'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, Eye, EyeOff, Upload, Monitor, BarChart3, TrendingUp, Activity, MousePointer, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import ImageUploader from '@/components/ui/ImageUploader';

interface PromoSlide {
  id: string;
  title: string;
  description?: string;
  image_url: string;
  link_url?: string;
  cta_text: string;
  company_name: string;
  display_order: number;
  click_count: number;
  view_count: number;
  is_active: boolean;
  admin_approved: boolean;
  created_at: string;
  updated_at?: string;
  start_date?: string;
  end_date?: string;
  schedule_type?: 'always' | 'scheduled' | 'recurring';
  time_slots?: any[];
  days_of_week?: number[];
  image_url_banner?: string;
  image_url_mobile?: string;
}

export default function SlidesManagementPage() {
  const [user, setUser] = useState<any>(null);
  const [slides, setSlides] = useState<PromoSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSlide, setEditingSlide] = useState<PromoSlide | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image_url: '',
    link_url: '',
    cta_text: 'En savoir plus',
    company_name: '',
    display_order: 1,
    schedule_type: 'always' as 'always' | 'scheduled' | 'recurring',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    time_slots: [] as any[],
    days_of_week: [0, 1, 2, 3, 4, 5, 6],
    images: { banner: null as string | null, mobile: null as string | null }
  });
  const router = useRouter();

  // Vérifier l'authentification
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/signin');
        return;
      }
      setUser(user);
      await loadSlides();
    } catch (error) {
      console.error('Error checking auth:', error);
      router.push('/auth/signin');
    }
  };

  const loadSlides = async () => {
    try {
      setLoading(true);
      console.log('Loading slides from Supabase...');
      
      const { data, error } = await supabase
        .from('promotional_slides')
        .select('*')
        .order('display_order', { ascending: true });
      
      if (error) {
        console.error('Error loading slides:', error);
        throw error;
      }
      
      console.log(`Loaded ${data?.length || 0} slides`);
      setSlides(data || []);
      
    } catch (error) {
      console.error('Error loading slides:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const slideData = {
        ...formData,
        is_active: true,
        admin_approved: true,
        view_count: 0,
        click_count: 0,
        start_date: formData.schedule_type !== 'always' ? new Date(formData.start_date).toISOString() : null,
        end_date: formData.schedule_type !== 'always' ? new Date(formData.end_date).toISOString() : null,
        schedule_type: formData.schedule_type,
        days_of_week: formData.days_of_week,
        time_slots: formData.time_slots,
        image_url_banner: formData.images.banner,
        image_url_mobile: formData.images.mobile,
        // Backward compatibility
        image_url: formData.images.banner || formData.image_url
      };
      
      // Remove properties that are not database fields
      const { images, company_name, ...dbSlideData } = slideData;

      if (editingSlide) {
        // Update existing slide
        const { error } = await supabase
          .from('promotional_slides')
          .update(dbSlideData)
          .eq('id', editingSlide.id);
        
        if (error) throw error;
        console.log('Slide updated successfully');
      } else {
        // Create new slide
        const { error } = await supabase
          .from('promotional_slides')
          .insert([dbSlideData]);
        
        if (error) throw error;
        console.log('Slide created successfully');
      }

      // Reset form and reload slides
      setFormData({
        title: '',
        description: '',
        image_url: '',
        link_url: '',
        cta_text: 'En savoir plus',
        company_name: '',
        display_order: 1,
        schedule_type: 'always' as 'always' | 'scheduled' | 'recurring',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        time_slots: [],
        days_of_week: [0, 1, 2, 3, 4, 5, 6],
        images: { banner: null, mobile: null }
      });
      setEditingSlide(null);
      setShowModal(false);
      await loadSlides();
      
    } catch (error) {
      console.error('Error saving slide:', error);
      alert('Erreur lors de la sauvegarde du slide');
    }
  };

  const handleEdit = (slide: PromoSlide) => {
    setEditingSlide(slide);
    setFormData({
      title: slide.title,
      description: slide.description || '',
      image_url: slide.image_url,
      link_url: slide.link_url || '',
      cta_text: slide.cta_text,
      company_name: slide.company_name,
      display_order: slide.display_order,
      schedule_type: slide.schedule_type || 'always',
      start_date: slide.start_date ? slide.start_date.split('T')[0] : new Date().toISOString().split('T')[0],
      end_date: slide.end_date ? slide.end_date.split('T')[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      time_slots: slide.time_slots || [],
      days_of_week: slide.days_of_week || [0, 1, 2, 3, 4, 5, 6],
      images: { banner: slide.image_url_banner || null, mobile: slide.image_url_mobile || null }
    });
    setShowModal(true);
  };

  const handleDelete = async (slideId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce slide ?')) return;
    
    try {
      const { error } = await supabase
        .from('promotional_slides')
        .delete()
        .eq('id', slideId);
      
      if (error) throw error;
      
      console.log('Slide deleted successfully');
      await loadSlides();
    } catch (error) {
      console.error('Error deleting slide:', error);
      alert('Erreur lors de la suppression du slide');
    }
  };

  const handleToggleActive = async (slideId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('promotional_slides')
        .update({ is_active: !currentStatus })
        .eq('id', slideId);
      
      if (error) throw error;
      
      console.log('Slide status updated');
      await loadSlides();
    } catch (error) {
      console.error('Error updating slide status:', error);
      alert('Erreur lors de la mise à jour du statut');
    }
  };

  const openModal = () => {
    setEditingSlide(null);
    setFormData({
      title: '',
      description: '',
      image_url: '',
      link_url: '',
      cta_text: 'En savoir plus',
      company_name: '',
      display_order: slides.length + 1,
      schedule_type: 'always' as 'always' | 'scheduled' | 'recurring',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      time_slots: [],
      days_of_week: [0, 1, 2, 3, 4, 5, 6],
      images: { banner: null, mobile: null }
    });
    setShowModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement des slides...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Gestion des Slides Publicitaires</h1>
              <p className="mt-2 text-orange-100">Gérez vos campagnes et slides promotionnels</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={openModal}
              className="bg-white text-orange-600 px-6 py-3 rounded-lg font-semibold flex items-center gap-2 hover:bg-orange-50 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Nouveau Slide
            </motion.button>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Monitor className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Slides</p>
                <p className="text-2xl font-bold text-gray-900">{slides.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <Eye className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Slides Actifs</p>
                <p className="text-2xl font-bold text-gray-900">
                  {slides.filter(s => s.is_active).length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <BarChart3 className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Vues</p>
                <p className="text-2xl font-bold text-gray-900">
                  {slides.reduce((sum, slide) => sum + (slide.view_count || 0), 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-3 bg-orange-100 rounded-lg">
                <MousePointer className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Clics</p>
                <p className="text-2xl font-bold text-gray-900">
                  {slides.reduce((sum, slide) => sum + (slide.click_count || 0), 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Slides List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Liste des Slides</h2>
          </div>
          
          {slides.length === 0 ? (
            <div className="text-center py-16">
              <Monitor className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun slide publicitaire</h3>
              <p className="text-gray-500 mb-6">Créez votre premier slide pour commencer</p>
              <button
                onClick={openModal}
                className="bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors"
              >
                Créer un slide
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {slides.map((slide) => (
                <motion.div
                  key={slide.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {/* Image preview */}
                      <div className="w-20 h-12 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                        {slide.image_url && (
                          <img 
                            src={slide.image_url} 
                            alt={slide.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )}
                      </div>
                      
                      {/* Slide info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-gray-900">{slide.title}</h3>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            slide.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {slide.is_active ? 'Actif' : 'Inactif'}
                          </span>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-2">{slide.company_name}</p>
                        
                        {slide.description && (
                          <p className="text-sm text-gray-500 line-clamp-2 mb-2">{slide.description}</p>
                        )}
                        
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {(slide.view_count || 0).toLocaleString()} vues
                          </span>
                          <span className="flex items-center gap-1">
                            <MousePointer className="w-3 h-3" />
                            {(slide.click_count || 0).toLocaleString()} clics
                          </span>
                          <span>Ordre: {slide.display_order}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {slide.link_url && (
                        <a
                          href={slide.link_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Voir le lien"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      
                      <button
                        onClick={() => handleToggleActive(slide.id, slide.is_active)}
                        className={`p-2 transition-colors ${
                          slide.is_active 
                            ? 'text-gray-400 hover:text-yellow-600' 
                            : 'text-gray-400 hover:text-green-600'
                        }`}
                        title={slide.is_active ? 'Désactiver' : 'Activer'}
                      >
                        {slide.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      
                      <button
                        onClick={() => handleEdit(slide)}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={() => handleDelete(slide.id)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingSlide ? 'Modifier le Slide' : 'Nouveau Slide'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Titre *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Titre du slide"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Entreprise *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.company_name}
                    onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Nom de l'entreprise"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Description du slide"
                />
              </div>
              
              {/* Image Upload Section */}
              <div className="col-span-2">
                <ImageUploader
                  onImagesChange={(images) => setFormData({...formData, images})}
                  initialImages={{
                    banner: formData.images.banner || undefined,
                    mobile: formData.images.mobile || undefined
                  }}
                />
              </div>
              
              {/* Fallback URL (optional) */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL d'image alternative (optionnel)
                </label>
                <input
                  type="url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({...formData, image_url: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="https://example.com/image.jpg"
                />
                <p className="text-xs text-gray-500 mt-1">Utilisé comme fallback si les images uploadées ne sont pas disponibles</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lien de destination
                  </label>
                  <input
                    type="url"
                    value={formData.link_url}
                    onChange={(e) => setFormData({...formData, link_url: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="https://example.com"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Texte du bouton
                  </label>
                  <input
                    type="text"
                    value={formData.cta_text}
                    onChange={(e) => setFormData({...formData, cta_text: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="En savoir plus"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ordre d'affichage
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.display_order}
                  onChange={(e) => setFormData({...formData, display_order: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              
              {/* Section Planification */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Planification de diffusion</h3>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type de planification
                  </label>
                  <select
                    value={formData.schedule_type}
                    onChange={(e) => setFormData({...formData, schedule_type: e.target.value as 'always' | 'scheduled' | 'recurring'})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="always">Toujours actif</option>
                    <option value="scheduled">Planifié (dates fixes)</option>
                    <option value="recurring">Récurrent (jours de la semaine)</option>
                  </select>
                </div>
                
                {formData.schedule_type !== 'always' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Date de début
                        </label>
                        <input
                          type="date"
                          value={formData.start_date}
                          onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Date de fin
                        </label>
                        <input
                          type="date"
                          value={formData.end_date}
                          onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                      </div>
                    </div>
                    
                    {formData.schedule_type === 'recurring' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Jours de diffusion
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map((day, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => {
                                const newDays = formData.days_of_week.includes(index) 
                                  ? formData.days_of_week.filter(d => d !== index)
                                  : [...formData.days_of_week, index].sort();
                                setFormData({...formData, days_of_week: newDays});
                              }}
                              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                                formData.days_of_week.includes(index)
                                  ? 'bg-orange-500 text-white'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              
              <div className="flex justify-end gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                  {editingSlide ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
