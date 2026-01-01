'use client'

import { motion } from 'framer-motion'
import { 
  ExternalLink, 
  Clock, 
  Tag,
  TrendingUp,
  AlertCircle,
  Flame,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Bookmark,
  Share2,
  Eye
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

interface MatchedArticle {
  match_id: string;
  alert_name: string;
  article_title: string;
  article_url: string;
  matched_keywords: string[];
  confidence_score: number;
  created_at: string;
  article_id?: string;
  ai_category?: string | null;
  ai_sentiment?: number | null;
  ai_importance?: number | null;
  ai_is_breaking?: boolean | null;
  published_at?: string | null;
}

interface MatchedArticleCardProps {
  article: MatchedArticle;
  onView?: (article: MatchedArticle) => void;
  onBookmark?: (article: MatchedArticle) => void;
  onShare?: (article: MatchedArticle) => void;
}

export default function MatchedArticleCard({
  article,
  onView,
  onBookmark,
  onShare
}: MatchedArticleCardProps) {
  // Le backend renvoie déjà un score entre 0-100, pas besoin de multiplier
  // Si le score est > 1, c'est déjà en pourcentage; sinon on multiplie par 100
  const rawScore = article.confidence_score || 0;
  const confidencePercent = rawScore > 1 ? Math.round(rawScore) : Math.round(rawScore * 100);
  const normalizedScore = rawScore > 1 ? rawScore / 100 : rawScore;
  const isHighConfidence = normalizedScore >= 0.8;
  const isMediumConfidence = normalizedScore >= 0.5;

  const getSentimentIcon = () => {
    if (!article.ai_sentiment) return <Minus className="w-4 h-4" />;
    if (article.ai_sentiment > 0.2) return <ThumbsUp className="w-4 h-4" />;
    if (article.ai_sentiment < -0.2) return <ThumbsDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const getSentimentColor = () => {
    if (!article.ai_sentiment) return 'text-gray-500 bg-gray-100';
    if (article.ai_sentiment > 0.2) return 'text-green-600 bg-green-100';
    if (article.ai_sentiment < -0.2) return 'text-red-600 bg-red-100';
    return 'text-gray-600 bg-gray-100';
  };

  const getConfidenceColor = () => {
    if (isHighConfidence) return 'from-green-500 to-emerald-600';
    if (isMediumConfidence) return 'from-yellow-500 to-orange-600';
    return 'from-gray-400 to-gray-500';
  };

  const getImportanceLevel = () => {
    if (!article.ai_importance) return null;
    const importance = article.ai_importance * 100;
    if (importance >= 80) return { label: 'Très important', color: 'text-red-600 bg-red-100' };
    if (importance >= 60) return { label: 'Important', color: 'text-orange-600 bg-orange-100' };
    if (importance >= 40) return { label: 'Modéré', color: 'text-yellow-600 bg-yellow-100' };
    return null;
  };

  const importanceLevel = getImportanceLevel();

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
      className="bg-white rounded-2xl border-2 border-gray-200 hover:border-orange-300 transition-all overflow-hidden group"
    >
      {/* Header avec alerte et score */}
      <div className="p-4 bg-gradient-to-r from-gray-50 to-orange-50 border-b border-gray-200">
        <div className="flex items-start justify-between gap-3">
          {/* Alerte source */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0" />
              <span className="text-sm font-semibold text-orange-700 truncate">
                {article.alert_name}
              </span>
            </div>
            {article.published_at && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="w-3 h-3" />
                <span>
                  {formatDistanceToNow(new Date(article.published_at), {
                    addSuffix: true,
                    locale: fr
                  })}
                </span>
              </div>
            )}
          </div>

          {/* Score de confiance */}
          <div className="flex flex-col items-end gap-1">
            <div className={`px-3 py-1 rounded-full bg-gradient-to-r ${getConfidenceColor()} text-white text-xs font-bold shadow-lg`}>
              {confidencePercent}%
            </div>
            {article.ai_is_breaking && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                <Flame className="w-3 h-3" />
                <span>Breaking</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="p-4">
        {/* Titre */}
        <h3 className="text-lg font-bold text-gray-900 mb-3 line-clamp-2 group-hover:text-orange-600 transition-colors">
          {article.article_title}
        </h3>

        {/* Métadonnées IA */}
        <div className="flex flex-wrap gap-2 mb-3">
          {/* Catégorie */}
          {article.ai_category && (
            <span className="px-2.5 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-lg flex items-center gap-1">
              <Tag className="w-3 h-3" />
              {article.ai_category}
            </span>
          )}

          {/* Sentiment */}
          <span className={`px-2.5 py-1 text-xs font-medium rounded-lg flex items-center gap-1 ${getSentimentColor()}`}>
            {getSentimentIcon()}
            <span>Sentiment</span>
          </span>

          {/* Importance */}
          {importanceLevel && (
            <span className={`px-2.5 py-1 text-xs font-medium rounded-lg flex items-center gap-1 ${importanceLevel.color}`}>
              <TrendingUp className="w-3 h-3" />
              {importanceLevel.label}
            </span>
          )}
        </div>

        {/* Mots-clés matchés */}
        {article.matched_keywords && article.matched_keywords.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-2 font-medium">Mots-clés détectés :</p>
            <div className="flex flex-wrap gap-1.5">
              {article.matched_keywords.map((keyword, idx) => (
                <motion.span
                  key={idx}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="px-2.5 py-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs font-semibold rounded-full shadow-sm"
                >
                  {keyword}
                </motion.span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-200">
          <div className="flex gap-2">
            <button
              onClick={() => onBookmark?.(article)}
              className="p-2 hover:bg-yellow-50 text-yellow-600 rounded-lg transition-colors"
              title="Sauvegarder"
            >
              <Bookmark className="w-4 h-4" />
            </button>
            <button
              onClick={() => onShare?.(article)}
              className="p-2 hover:bg-orange-50 text-orange-600 rounded-lg transition-colors"
              title="Partager"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onView?.(article)}
              className="p-2 hover:bg-purple-50 text-purple-600 rounded-lg transition-colors"
              title="Voir les détails"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>

          <a
            href={article.article_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg transition-all shadow-md hover:shadow-lg font-medium text-sm"
          >
            <span>Lire l'article</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Barre de progression confiance */}
      <div className="h-1 bg-gray-100">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${confidencePercent}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full bg-gradient-to-r ${getConfidenceColor()}`}
        />
      </div>
    </motion.article>
  )
}
