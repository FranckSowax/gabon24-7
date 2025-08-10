import React from 'react'

interface Article {
  id: string
  title: string
  summary: string
  source: string
  publishedAt: string
  category: string
  viewCount: string  // Remplace readTime - nombre de vues formaté
  view_count?: number  // Valeur brute pour les calculs
  trending?: boolean
  imageUrl?: string
  image_url?: string
  image_urls?: string[]  // Images extraites via web scraping
  author?: string
  url?: string
}

interface ArticleCardProps {
  article: Article
  variant?: 'featured' | 'list'
  onSave?: (articleId: string) => void
  onShare?: (article: Article) => void
  onClick?: (article: Article) => void
}

export default function ArticleCard({ 
  article, 
  variant = 'list', 
  onSave, 
  onShare,
  onClick
}: ArticleCardProps) {
  const handleSave = () => {
    if (onSave) {
      onSave(article.id)
    }
  }

  const handleShare = () => {
    if (onShare) {
      onShare(article)
    } else {
      // Partage WhatsApp par défaut
      const text = `${article.title}\n\n${article.summary}\n\nSource: ${article.source}\nVia GabonNews`
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`
      window.open(whatsappUrl, '_blank')
    }
  }

  if (variant === 'featured') {
    return (
      <div className="relative bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow cursor-pointer">
        {article.trending && (
          <div className="absolute top-2 sm:top-4 left-2 sm:left-4 z-10">
            <span className="bg-orange-500 text-white px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium flex items-center">
              🔥 <span className="hidden sm:inline ml-1">Tendance</span>
            </span>
          </div>
        )}
        
        <div className="h-40 sm:h-48 bg-gradient-to-br from-green-400 to-blue-500 relative">
          {(article.imageUrl || article.image_url || (article.image_urls && article.image_urls.length > 0)) ? (
            <img 
              src={article.image_url || article.imageUrl || (article.image_urls && article.image_urls[0])} 
              alt={article.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback si l'image ne charge pas
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="absolute inset-0 bg-black bg-opacity-30"></div>
          )}
          
          <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 right-2 sm:right-4 text-white">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-1 sm:space-x-2">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                  <span className="text-xs sm:text-sm">📰</span>
                </div>
                <span className="text-xs sm:text-sm opacity-90 font-medium truncate">{article.source}</span>
              </div>
              {article.author && (
                <span className="hidden sm:inline text-xs opacity-75 bg-black bg-opacity-30 px-2 py-1 rounded">
                  {article.author}
                </span>
              )}
            </div>
            <h3 
              className="text-base sm:text-xl font-bold mb-2 leading-tight line-clamp-2 hover:text-orange-300 cursor-pointer transition-colors"
              onClick={() => onClick ? onClick(article) : window.open(article.url, '_blank')}
            >
              {article.title}
            </h3>
          </div>
        </div>
        
        <div className="p-3 sm:p-4">
          <p className="text-gray-600 text-xs sm:text-sm mb-2 sm:mb-3">{article.summary}</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-4 text-xs sm:text-sm text-gray-500">
              <span className="truncate">{article.publishedAt}</span>
              <span className="hidden sm:inline">{article.viewCount}</span>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2">
              <button 
                onClick={handleSave}
                className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Sauvegarder"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </button>
              <button 
                onClick={handleShare}
                className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Partager"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white p-3 sm:p-4 lg:p-6 rounded-lg shadow hover:shadow-md transition-shadow">
      <div className="flex items-start space-x-3 sm:space-x-4">
        {/* Image principale de l'article */}
        <div className="flex-shrink-0">
          {(article.image_url || article.imageUrl || (article.image_urls && article.image_urls.length > 0)) ? (
            <img 
              src={article.image_url || article.imageUrl || (article.image_urls && article.image_urls[0])} 
              alt={article.title}
              className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg object-cover"
              onError={(e) => {
                // Fallback vers l'icône par défaut si l'image ne charge pas
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <div className={`w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-green-400 to-blue-500 rounded-lg flex items-center justify-center ${(article.image_url || article.imageUrl || (article.image_urls && article.image_urls.length > 0)) ? 'hidden' : ''}`}>
            <span className="text-sm sm:text-lg text-white">📰</span>
          </div>
        </div>
        
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-sm font-medium text-gray-900">{article.source}</span>
            <span className="text-gray-400">•</span>
            <span className="text-sm text-gray-500">{article.category}</span>
            {article.trending && (
              <>
                <span className="text-gray-400">•</span>
                <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full">
                  🔥 Tendance
                </span>
              </>
            )}
          </div>
          
          <h3 
            className="text-lg font-semibold text-gray-900 mb-2 hover:text-orange-600 cursor-pointer line-clamp-2 transition-colors"
            onClick={() => onClick ? onClick(article) : window.open(article.url, '_blank')}
          >
            {article.title}
          </h3>
          
          <p className="text-gray-600 text-sm mb-3 line-clamp-2">{article.summary}</p>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span>{article.publishedAt}</span>
              <span>{article.viewCount}</span>
              {article.author && (
                <>
                  <span className="text-gray-400">•</span>
                  <span className="font-medium text-gray-600">{article.author}</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex-shrink-0 flex flex-col space-y-2">
          <button
            onClick={handleSave}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Sauvegarder"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
          
          <button
            onClick={handleShare}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Partager sur WhatsApp"
          >
            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.700"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
