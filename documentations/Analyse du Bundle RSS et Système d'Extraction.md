# **Analyse du Bundle RSS et Système d'Extraction**

## **📊 Analyse de la Structure RSS**

Après analyse du bundle RSS, voici la structure identifiée :

\<rss version="2.0"\>  
  \<channel\>  
    \<item\>  
      \<title\>Titre de l'article\</title\>  
      \<link\>URL de l'article original\</link\>  
      \<description\>Description/résumé\</description\>  
      \<pubDate\>Date de publication\</pubDate\>  
      \<guid\>Identifiant unique\</guid\>  
      \<source url="URL\_SOURCE"\>Nom de la source\</source\>  
      \<\!-- Images potentielles dans plusieurs endroits \--\>  
      \<enclosure url="IMAGE\_URL" type="image/jpeg"/\>  
      \<media:content url="IMAGE\_URL"/\>  
      \<\!-- Ou dans le contenu CDATA \--\>  
      \<content:encoded\>\<\!\[CDATA\[...HTML avec images...\]\]\>\</content:encoded\>  
    \</item\>  
  \</channel\>  
\</rss\>

## **🔧 Système d'Extraction Complet**

// lib/rss/rssParser.ts  
import Parser from 'rss-parser';  
import \* as cheerio from 'cheerio';  
import { URL } from 'url';

interface ExtractedArticle {  
  title: string;  
  description: string;  
  link: string;  
  pubDate: Date;  
  guid: string;  
  source: {  
    name: string;  
    url: string;  
    domain: string;  
  };  
  images: {  
    featured?: string;  
    thumbnail?: string;  
    all: string\[\];  
  };  
  content?: string;  
  categories: string\[\];  
  author?: string;  
}

export class AdvancedRSSParser {  
  private parser: Parser;  
    
  constructor() {  
    // Configuration du parser avec namespaces personnalisés  
    this.parser \= new Parser({  
      customFields: {  
        item: \[  
          \['media:content', 'mediaContent', {keepArray: true}\],  
          \['media:thumbnail', 'mediaThumbnail'\],  
          \['content:encoded', 'contentEncoded'\],  
          \['dc:creator', 'creator'\],  
          \['source', 'source', {keepArray: false}\],  
          \['enclosure', 'enclosure'\],  
          \['image', 'image'\]  
        \]  
      },  
      headers: {  
        'User-Agent': 'Gabon24/7 RSS Aggregator/1.0'  
      }  
    });  
  }

  /\*\*  
   \* Parse un feed RSS et extrait toutes les informations  
   \*/  
  async parseFeed(feedUrl: string): Promise\<ExtractedArticle\[\]\> {  
    try {  
      const feed \= await this.parser.parseURL(feedUrl);  
      const articles: ExtractedArticle\[\] \= \[\];

      for (const item of feed.items) {  
        const article \= await this.extractArticleData(item, feedUrl);  
        articles.push(article);  
      }

      return articles;  
    } catch (error) {  
      console.error('Error parsing RSS feed:', error);  
      throw error;  
    }  
  }

  /\*\*  
   \* Extrait toutes les données d'un article  
   \*/  
  private async extractArticleData(item: any, feedUrl: string): Promise\<ExtractedArticle\> {  
    // 1\. Extraction de la source  
    const source \= this.extractSource(item, feedUrl);  
      
    // 2\. Extraction des images  
    const images \= await this.extractImages(item);  
      
    // 3\. Extraction du contenu et nettoyage  
    const content \= this.extractContent(item);  
      
    // 4\. Extraction des catégories  
    const categories \= this.extractCategories(item);

    return {  
      title: item.title || '',  
      description: this.cleanDescription(item.contentSnippet || item.description || ''),  
      link: item.link || '',  
      pubDate: new Date(item.pubDate || item.isoDate || Date.now()),  
      guid: item.guid || item.link || '',  
      source,  
      images,  
      content,  
      categories,  
      author: item.creator || item\['dc:creator'\] || item.author || null  
    };  
  }

  /\*\*  
   \* Extraction intelligente de la source  
   \*/  
  private extractSource(item: any, feedUrl: string): ExtractedArticle\['source'\] {  
    let sourceName \= '';  
    let sourceUrl \= '';  
    let domain \= '';

    // Méthode 1: Balise \<source\>  
    if (item.source) {  
      if (typeof item.source \=== 'object') {  
        sourceName \= item.source.\_ || item.source.title || '';  
        sourceUrl \= item.source.$.url || item.source.url || '';  
      } else if (typeof item.source \=== 'string') {  
        sourceName \= item.source;  
      }  
    }

    // Méthode 2: Extraire du lien de l'article  
    if (\!sourceName && item.link) {  
      try {  
        const url \= new URL(item.link);  
        domain \= url.hostname.replace('www.', '');  
        sourceName \= this.formatDomainAsName(domain);  
        sourceUrl \= \`${url.protocol}//${url.hostname}\`;  
      } catch (e) {  
        console.error('Invalid URL:', item.link);  
      }  
    }

    // Méthode 3: Parser le feedUrl lui-même  
    if (\!sourceName && feedUrl) {  
      try {  
        const url \= new URL(feedUrl);  
        domain \= url.hostname.replace('www.', '').replace('rss.', '');  
        sourceName \= this.formatDomainAsName(domain);  
      } catch (e) {  
        console.error('Invalid feed URL:', feedUrl);  
      }  
    }

    // Méthode 4: Mapping personnalisé pour sources connues  
    sourceName \= this.mapKnownSources(domain) || sourceName;

    return {  
      name: sourceName || 'Source inconnue',  
      url: sourceUrl || item.link || '',  
      domain: domain || 'unknown'  
    };  
  }

  /\*\*  
   \* Extraction complète des images  
   \*/  
  private async extractImages(item: any): Promise\<ExtractedArticle\['images'\]\> {  
    const images: string\[\] \= \[\];  
    let featured: string | undefined;  
    let thumbnail: string | undefined;

    // 1\. Enclosure (souvent utilisé pour l'image principale)  
    if (item.enclosure && item.enclosure.url) {  
      if (this.isImageUrl(item.enclosure.url) || item.enclosure.type?.startsWith('image')) {  
        featured \= item.enclosure.url;  
        images.push(item.enclosure.url);  
      }  
    }

    // 2\. Media:content (standard pour médias)  
    if (item.mediaContent && Array.isArray(item.mediaContent)) {  
      for (const media of item.mediaContent) {  
        if (media.$ && media.$.url && media.$.medium \=== 'image') {  
          images.push(media.$.url);  
          if (\!featured) featured \= media.$.url;  
        }  
      }  
    }

    // 3\. Media:thumbnail  
    if (item.mediaThumbnail && item.mediaThumbnail.url) {  
      thumbnail \= item.mediaThumbnail.url;  
      images.push(item.mediaThumbnail.url);  
    }

    // 4\. Image directe  
    if (item.image) {  
      const imageUrl \= typeof item.image \=== 'string' ? item.image : item.image.url;  
      if (imageUrl) {  
        images.push(imageUrl);  
        if (\!featured) featured \= imageUrl;  
      }  
    }

    // 5\. Extraction depuis content:encoded (HTML)  
    if (item.contentEncoded) {  
      const contentImages \= this.extractImagesFromHTML(item.contentEncoded);  
      images.push(...contentImages);  
      if (\!featured && contentImages.length \> 0\) {  
        featured \= contentImages\[0\];  
      }  
    }

    // 6\. Extraction depuis la description  
    if (item.description && \!featured) {  
      const descImages \= this.extractImagesFromHTML(item.description);  
      images.push(...descImages);  
      if (descImages.length \> 0\) {  
        featured \= descImages\[0\];  
      }  
    }

    // 7\. Fallback: chercher l'image Open Graph si on peut accéder à l'article  
    if (\!featured && item.link) {  
      // Option: faire un fetch de la page pour récupérer og:image  
      // featured \= await this.fetchOpenGraphImage(item.link);  
    }

    return {  
      featured: featured || undefined,  
      thumbnail: thumbnail || featured || undefined,  
      all: \[...new Set(images)\] // Dédupliquer  
    };  
  }

  /\*\*  
   \* Extraction d'images depuis du HTML  
   \*/  
  private extractImagesFromHTML(html: string): string\[\] {  
    const images: string\[\] \= \[\];  
    const $ \= cheerio.load(html);  
      
    // Extraire toutes les images  
    $('img').each((\_, elem) \=\> {  
      const src \= $(elem).attr('src') || $(elem).attr('data-src');  
      if (src && this.isValidImageUrl(src)) {  
        images.push(this.normalizeImageUrl(src));  
      }  
    });

    // Chercher aussi dans les balises figure  
    $('figure img').each((\_, elem) \=\> {  
      const src \= $(elem).attr('src');  
      if (src && this.isValidImageUrl(src)) {  
        images.unshift(this.normalizeImageUrl(src)); // Priorité aux images dans figure  
      }  
    });

    return images;  
  }

  /\*\*  
   \* Extraction et nettoyage du contenu  
   \*/  
  private extractContent(item: any): string {  
    let content \= '';

    // Priorité au content:encoded  
    if (item.contentEncoded) {  
      content \= item.contentEncoded;  
    } else if (item.content) {  
      content \= item.content;  
    } else if (item.description) {  
      content \= item.description;  
    }

    // Nettoyer le HTML  
    if (content) {  
      const $ \= cheerio.load(content);  
        
      // Supprimer les scripts et styles  
      $('script, style').remove();  
        
      // Conserver le texte et structure basique  
      content \= $.text().trim();  
        
      // Limiter la longueur pour le stockage  
      if (content.length \> 5000\) {  
        content \= content.substring(0, 5000\) \+ '...';  
      }  
    }

    return content;  
  }

  /\*\*  
   \* Extraction des catégories  
   \*/  
  private extractCategories(item: any): string\[\] {  
    const categories: string\[\] \= \[\];

    if (item.categories && Array.isArray(item.categories)) {  
      categories.push(...item.categories);  
    } else if (item.category) {  
      if (typeof item.category \=== 'string') {  
        categories.push(item.category);  
      } else if (Array.isArray(item.category)) {  
        categories.push(...item.category);  
      }  
    }

    return \[...new Set(categories)\]; // Dédupliquer  
  }

  /\*\*  
   \* Helpers  
   \*/  
  private formatDomainAsName(domain: string): string {  
    // Enlever les extensions communes  
    let name \= domain.replace(/\\.(com|net|org|ga|fr|cm|cd|ci)$/i, '');  
      
    // Capitaliser  
    name \= name.split('.').pop() || name;  
    name \= name.replace(/-/g, ' ');  
    name \= name.charAt(0).toUpperCase() \+ name.slice(1);  
      
    return name;  
  }

  private mapKnownSources(domain: string): string | null {  
    const sourceMap: Record\<string, string\> \= {  
      'gabonreview.com': 'Gabon Review',  
      'lalibreville.com': 'La Libreville',  
      'gabonactu.com': 'Gabon Actu',  
      'union.sonapresse.com': "L'Union",  
      'gabonmediatime.com': 'Gabon Media Time',  
      'alibreville.com': 'Alibreville',  
      'lenouveaugabon.com': 'Le Nouveau Gabon',  
      'gabonnews.com': 'Gabon News',  
      'bwitibusiness.com': 'Bwiti Business',  
      // Ajouter d'autres mappings  
    };

    return sourceMap\[domain\] || null;  
  }

  private isImageUrl(url: string): boolean {  
    return /\\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);  
  }

  private isValidImageUrl(url: string): boolean {  
    if (\!url) return false;  
      
    // Filtrer les trackers et pixels  
    const blacklist \= \['pixel', 'tracking', 'analytics', '1x1', 'spacer'\];  
    const lowerUrl \= url.toLowerCase();  
      
    return \!blacklist.some(term \=\> lowerUrl.includes(term));  
  }

  private normalizeImageUrl(url: string): string {  
    // Si l'URL est relative, on ne peut pas la normaliser sans contexte  
    if (\!url.startsWith('http')) {  
      return url;  
    }  
      
    // Nettoyer les paramètres inutiles  
    try {  
      const urlObj \= new URL(url);  
      // Garder seulement certains paramètres  
      const keepParams \= \['width', 'height', 'quality', 'format'\];  
      const searchParams \= new URLSearchParams();  
        
      urlObj.searchParams.forEach((value, key) \=\> {  
        if (keepParams.includes(key.toLowerCase())) {  
          searchParams.append(key, value);  
        }  
      });  
        
      urlObj.search \= searchParams.toString();  
      return urlObj.toString();  
    } catch {  
      return url;  
    }  
  }

  private cleanDescription(text: string): string {  
    // Supprimer HTML si présent  
    const $ \= cheerio.load(text);  
    let clean \= $.text().trim();  
      
    // Limiter la longueur  
    if (clean.length \> 500\) {  
      clean \= clean.substring(0, 497\) \+ '...';  
    }  
      
    return clean;  
  }

  /\*\*  
   \* Fetch Open Graph image (optionnel, nécessite un fetch HTTP)  
   \*/  
  async fetchOpenGraphImage(articleUrl: string): Promise\<string | null\> {  
    try {  
      const response \= await fetch(articleUrl);  
      const html \= await response.text();  
      const $ \= cheerio.load(html);  
        
      // Chercher og:image  
      const ogImage \= $('meta\[property="og:image"\]').attr('content') ||  
                      $('meta\[name="twitter:image"\]').attr('content');  
        
      return ogImage || null;  
    } catch (error) {  
      console.error('Error fetching OG image:', error);  
      return null;  
    }  
  }  
}

## **🔄 Intégration avec Supabase**

// lib/rss/rssFeedManager.ts  
import { AdvancedRSSParser } from './rssParser';  
import { createClient } from '@supabase/supabase-js';

const supabase \= createClient(  
  process.env.SUPABASE\_URL\!,  
  process.env.SUPABASE\_SERVICE\_KEY\!  
);

export class RSSFeedManager {  
  private parser: AdvancedRSSParser;  
    
  constructor() {  
    this.parser \= new AdvancedRSSParser();  
  }

  /\*\*  
   \* Traite un bundle RSS et sauvegarde en base  
   \*/  
  async processFeedBundle(bundleUrl: string): Promise\<void\> {  
    console.log(\`Processing RSS bundle: ${bundleUrl}\`);  
      
    try {  
      // 1\. Parser le feed  
      const articles \= await this.parser.parseFeed(bundleUrl);  
      console.log(\`Found ${articles.length} articles\`);

      // 2\. Traiter chaque article  
      for (const article of articles) {  
        await this.saveArticle(article);  
      }

      // 3\. Mettre à jour les statistiques  
      await this.updateFeedStats(bundleUrl, articles.length);  
        
    } catch (error) {  
      console.error('Error processing feed bundle:', error);  
      throw error;  
    }  
  }

  /\*\*  
   \* Sauvegarde un article en base avec déduplication  
   \*/  
  private async saveArticle(article: any): Promise\<void\> {  
    // Créer un hash unique pour éviter les doublons  
    const contentHash \= this.generateHash(article.link \+ article.title);

    // Vérifier si la source existe, sinon la créer  
    const sourceId \= await this.ensureSourceExists(article.source);

    // Préparer les données pour Supabase  
    const articleData \= {  
      title: article.title,  
      description: article.description,  
      content: article.content,  
      url: article.link,  
      guid: article.guid,  
      pub\_date: article.pubDate,  
      source\_id: sourceId,  
      source\_name: article.source.name,  
      source\_domain: article.source.domain,  
      author: article.author,  
      categories: article.categories,  
      content\_hash: contentHash,  
        
      // Images  
      featured\_image: article.images.featured,  
      thumbnail\_image: article.images.thumbnail,  
      images: article.images.all,  
        
      // Métadonnées  
      metadata: {  
        original\_source: article.source,  
        extraction\_date: new Date().toISOString(),  
        has\_images: article.images.all.length \> 0  
      }  
    };

    // Insérer avec gestion des doublons  
    const { data, error } \= await supabase  
      .from('feed\_items')  
      .upsert(articleData, {  
        onConflict: 'content\_hash',  
        ignoreDuplicates: true  
      });

    if (error && \!error.message.includes('duplicate')) {  
      console.error('Error saving article:', error);  
    } else if (data) {  
      console.log(\`Saved article: ${article.title}\`);  
    }  
  }

  /\*\*  
   \* Assure qu'une source existe en base  
   \*/  
  private async ensureSourceExists(source: any): Promise\<string\> {  
    // Vérifier si la source existe  
    const { data: existing } \= await supabase  
      .from('sources')  
      .select('id')  
      .eq('domain', source.domain)  
      .single();

    if (existing) {  
      return existing.id;  
    }

    // Créer la source  
    const { data: newSource, error } \= await supabase  
      .from('sources')  
      .insert({  
        name: source.name,  
        url: source.url,  
        domain: source.domain,  
        source\_type: 'rss',  
        is\_active: true  
      })  
      .select('id')  
      .single();

    if (error) {  
      console.error('Error creating source:', error);  
      throw error;  
    }

    return newSource.id;  
  }

  /\*\*  
   \* Génère un hash unique pour le contenu  
   \*/  
  private generateHash(text: string): string {  
    const crypto \= require('crypto');  
    return crypto.createHash('md5').update(text).digest('hex');  
  }

  /\*\*  
   \* Met à jour les statistiques du feed  
   \*/  
  private async updateFeedStats(feedUrl: string, articleCount: number): Promise\<void\> {  
    await supabase  
      .from('feed\_stats')  
      .upsert({  
        feed\_url: feedUrl,  
        last\_fetch: new Date().toISOString(),  
        article\_count: articleCount,  
        success: true  
      });  
  }  
}

## **🎨 Composant d'Affichage avec Images**

// components/feed/ArticleCard.tsx  
import { useState } from 'react';  
import Image from 'next/image';  
import { ExternalLink, Clock, User, Tag } from 'lucide-react';

interface ArticleCardProps {  
  article: {  
    title: string;  
    description: string;  
    url: string;  
    pub\_date: string;  
    source\_name: string;  
    source\_domain: string;  
    featured\_image?: string;  
    thumbnail\_image?: string;  
    author?: string;  
    categories: string\[\];  
  };  
}

export default function ArticleCard({ article }: ArticleCardProps) {  
  const \[imageError, setImageError\] \= useState(false);  
  const displayImage \= article.featured\_image || article.thumbnail\_image;

  return (  
    \<article className="bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-750 transition-colors"\>  
      {/\* Image \*/}  
      {displayImage && \!imageError && (  
        \<div className="relative h-48 bg-gray-900"\>  
          \<Image  
            src={displayImage}  
            alt={article.title}  
            fill  
            className="object-cover"  
            onError={() \=\> setImageError(true)}  
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"  
          /\>  
            
          {/\* Badge source sur l'image \*/}  
          \<div className="absolute top-2 left-2"\>  
            \<span className="px-2 py-1 bg-black/70 backdrop-blur-sm text-white text-xs rounded"\>  
              {article.source\_name}  
            \</span\>  
          \</div\>  
        \</div\>  
      )}

      {/\* Contenu \*/}  
      \<div className="p-4"\>  
        {/\* Source (si pas d'image) \*/}  
        {(\!displayImage || imageError) && (  
          \<div className="flex items-center gap-2 mb-2"\>  
            \<div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-600 rounded flex items-center justify-center"\>  
              \<span className="text-white text-xs font-bold"\>  
                {article.source\_name.charAt(0)}  
              \</span\>  
            \</div\>  
            \<div\>  
              \<p className="text-sm font-medium text-orange-500"\>  
                {article.source\_name}  
              \</p\>  
              \<p className="text-xs text-gray-500"\>  
                {article.source\_domain}  
              \</p\>  
            \</div\>  
          \</div\>  
        )}

        {/\* Titre \*/}  
        \<h3 className="font-semibold text-lg mb-2 line-clamp-2"\>  
          {article.title}  
        \</h3\>

        {/\* Description \*/}  
        \<p className="text-gray-400 text-sm mb-3 line-clamp-3"\>  
          {article.description}  
        \</p\>

        {/\* Métadonnées \*/}  
        \<div className="flex items-center gap-4 text-xs text-gray-500"\>  
          \<span className="flex items-center gap-1"\>  
            \<Clock className="w-3 h-3" /\>  
            {new Date(article.pub\_date).toLocaleDateString('fr-FR')}  
          \</span\>  
            
          {article.author && (  
            \<span className="flex items-center gap-1"\>  
              \<User className="w-3 h-3" /\>  
              {article.author}  
            \</span\>  
          )}  
        \</div\>

        {/\* Catégories \*/}  
        {article.categories.length \> 0 && (  
          \<div className="flex flex-wrap gap-1 mt-3"\>  
            {article.categories.slice(0, 3).map(cat \=\> (  
              \<span key={cat} className="px-2 py-1 bg-gray-700 text-xs rounded"\>  
                {cat}  
              \</span\>  
            ))}  
          \</div\>  
        )}

        {/\* Action \*/}  
          
          href={article.url}  
          target="\_blank"  
          rel="noopener noreferrer"  
          className="inline-flex items-center gap-1 mt-3 text-orange-500 hover:text-orange-400 text-sm"  
        \>  
          Lire l'article  
          \<ExternalLink className="w-3 h-3" /\>  
        \</a\>  
      \</div\>  
    \</article\>  
  );  
}

## **🔄 Mise à jour du Schéma Supabase**

\-- Mise à jour de la table feed\_items pour les images et sources  
ALTER TABLE feed\_items   
ADD COLUMN IF NOT EXISTS featured\_image text,  
ADD COLUMN IF NOT EXISTS thumbnail\_image text,  
ADD COLUMN IF NOT EXISTS images jsonb DEFAULT '\[\]',  
ADD COLUMN IF NOT EXISTS source\_name text,  
ADD COLUMN IF NOT EXISTS source\_domain text,  
ADD COLUMN IF NOT EXISTS author text,  
ADD COLUMN IF NOT EXISTS categories text\[\] DEFAULT '{}';

\-- Index pour recherche par source  
CREATE INDEX IF NOT EXISTS idx\_feed\_items\_source   
ON feed\_items(source\_name, source\_domain);

\-- Table des sources uniques  
CREATE TABLE IF NOT EXISTS sources (  
    id uuid PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
    name text NOT NULL,  
    domain text UNIQUE NOT NULL,  
    url text,  
    logo\_url text,  
    source\_type text DEFAULT 'rss',  
    is\_active boolean DEFAULT true,  
    metadata jsonb DEFAULT '{}',  
    created\_at timestamptz DEFAULT now(),  
    updated\_at timestamptz DEFAULT now()  
);

\-- Vue pour articles avec images  
CREATE OR REPLACE VIEW articles\_with\_images AS  
SELECT   
    fi.\*,  
    s.name as source\_display\_name,  
    s.logo\_url as source\_logo,  
    COALESCE(fi.featured\_image, fi.thumbnail\_image, (fi.images-\>0)::text) as primary\_image  
FROM feed\_items fi  
LEFT JOIN sources s ON fi.source\_domain \= s.domain  
WHERE fi.featured\_image IS NOT NULL   
   OR fi.thumbnail\_image IS NOT NULL   
   OR jsonb\_array\_length(fi.images) \> 0;

Ce système complet permet :

1. **Extraction intelligente** de la source finale depuis plusieurs endroits  
2. **Récupération multi-niveaux** des images (enclosure, media, HTML, etc.)  
3. **Déduplication** automatique des articles  
4. **Mapping personnalisé** des sources connues  
5. **Fallback gracieux** si certaines données manquent  
6. **Optimisation** des images et URLs  
7. **Stockage structuré** dans Supabase

Le système est robuste et gère les différents formats RSS/Atom ainsi que les extensions courantes (media, content, dc, etc.).

# **Mise à jour du Système d'Extraction RSS avec Sources Gabonaises**

## **📋 Mapping Complet des Sources Médias Gabonaises**

// lib/rss/sourceMapping.ts

export const GABON\_MEDIA\_SOURCES: Record\<string, {  
  name: string;  
  domain: string;  
  type: 'media' | 'government' | 'social' | 'sport';  
  logo?: string;  
  priority: number;  
}\> \= {  
  // MÉDIAS PRINCIPAUX  
  'echosdeleco.com': {  
    name: "Les Échos de l'Éco",  
    domain: 'echosdeleco.com',  
    type: 'media',  
    priority: 1  
  },  
  'gabonactu.com': {  
    name: 'Gabon Actu',  
    domain: 'gabonactu.com',  
    type: 'media',  
    priority: 1  
  },  
  'agpgabon.ga': {  
    name: 'AGP \- Agence Gabonaise de Presse',  
    domain: 'agpgabon.ga',  
    type: 'media',  
    priority: 1  
  },  
  'gabonallsport.com': {  
    name: 'Gabon All Sport',  
    domain: 'gabonallsport.com',  
    type: 'sport',  
    priority: 2  
  },  
  'gaboneco.com': {  
    name: 'GabonEco',  
    domain: 'gaboneco.com',  
    type: 'media',  
    priority: 1  
  },  
  'mediapostegabon.com': {  
    name: 'MEDIAPOSTEGABON',  
    domain: 'mediapostegabon.com',  
    type: 'media',  
    priority: 1  
  },  
  'union.sonapresse.com': {  
    name: "L'Union",  
    domain: 'union.sonapresse.com',  
    type: 'media',  
    priority: 1  
  },  
  'lenouveaugabon.com': {  
    name: 'Le Nouveau Gabon',  
    domain: 'lenouveaugabon.com',  
    type: 'media',  
    priority: 1  
  },  
  '7joursinfo.com': {  
    name: '7 Jours Info',  
    domain: '7joursinfo.com',  
    type: 'media',  
    priority: 2  
  },  
  'g9infos.com': {  
    name: 'G9 INFOS',  
    domain: 'g9infos.com',  
    type: 'media',  
    priority: 2  
  },  
  'leconfidentiel.net': {  
    name: 'Le Confidentiel du Gabon',  
    domain: 'leconfidentiel.net',  
    type: 'media',  
    priority: 2  
  },  
  'gabonmediatime.com': {  
    name: 'Gabon Media Time',  
    domain: 'gabonmediatime.com',  
    type: 'media',  
    priority: 1  
  },  
  'agenceequateur.com': {  
    name: 'Agence Equateur',  
    domain: 'agenceequateur.com',  
    type: 'media',  
    priority: 2  
  },  
  'courrierdesjournalistes.net': {  
    name: 'Courrier des Journalistes',  
    domain: 'courrierdesjournalistes.net',  
    type: 'media',  
    priority: 2  
  },  
  'directinfosgabon.com': {  
    name: 'Direct Infos Gabon',  
    domain: 'directinfosgabon.com',  
    type: 'media',  
    priority: 1  
  },  
  'focusgroupemedia.com': {  
    name: 'Focus Groupe Media',  
    domain: 'focusgroupemedia.com',  
    type: 'media',  
    priority: 2  
  },  
  'gaboma.info': {  
    name: 'GabomaInfo',  
    domain: 'gaboma.info',  
    type: 'media',  
    priority: 2  
  },  
  'afrique.latribune.fr': {  
    name: 'La Tribune Afrique \- Gabon',  
    domain: 'afrique.latribune.fr',  
    type: 'media',  
    priority: 2  
  },  
  'rfi.fr': {  
    name: 'RFI Gabon',  
    domain: 'rfi.fr',  
    type: 'media',  
    priority: 2  
  },  
  'gabon-info.com': {  
    name: 'Gabon Info',  
    domain: 'gabon-info.com',  
    type: 'media',  
    priority: 2  
  },  
  'gabonmailinfos.com': {  
    name: 'Gabon Mail Infos',  
    domain: 'gabonmailinfos.com',  
    type: 'media',  
    priority: 2  
  },  
  'gabon-newsroom.com': {  
    name: 'Gabon Newsroom',  
    domain: 'gabon-newsroom.com',  
    type: 'media',  
    priority: 2  
  },  
  'gabonclic.info': {  
    name: 'Gabonclic.info',  
    domain: 'gabonclic.info',  
    type: 'media',  
    priority: 2  
  },  
  'gabonews.com': {  
    name: 'Gabonews',  
    domain: 'gabonews.com',  
    type: 'media',  
    priority: 1  
  },  
  'depeches241.com': {  
    name: 'Groupe Dépêches 241',  
    domain: 'depeches241.com',  
    type: 'media',  
    priority: 1  
  },  
  'fr.infosgabon.com': {  
    name: 'INFOS GABON',  
    domain: 'fr.infosgabon.com',  
    type: 'media',  
    priority: 2  
  },  
  'insidenews241.com': {  
    name: 'Insidenews 241',  
    domain: 'insidenews241.com',  
    type: 'media',  
    priority: 2  
  },  
  'journaldugabon.com': {  
    name: 'Journal du Gabon',  
    domain: 'journaldugabon.com',  
    type: 'media',  
    priority: 1  
  },  
  'kongossanews.info': {  
    name: 'Kongossa News',  
    domain: 'kongossanews.info',  
    type: 'media',  
    priority: 2  
  },  
  'letouracovert.com': {  
    name: 'Le Touraco Vert',  
    domain: 'letouracovert.com',  
    type: 'media',  
    priority: 2  
  },  
  'peupleinfos.com': {  
    name: 'Peuple Infos',  
    domain: 'peupleinfos.com',  
    type: 'media',  
    priority: 2  
  },  
  'relaisinfosgabon.com': {  
    name: 'Relais Infos Gabon',  
    domain: 'relaisinfosgabon.com',  
    type: 'media',  
    priority: 2  
  },  
  'sport241.com': {  
    name: 'Sport241.com',  
    domain: 'sport241.com',  
    type: 'sport',  
    priority: 2  
  },  
  'vxp241.com': {  
    name: 'Vox Populi 241',  
    domain: 'vxp241.com',  
    type: 'media',  
    priority: 2  
  },

  // SOURCES GOUVERNEMENTALES  
  'presidence.ga': {  
    name: 'Présidence de la République Gabonaise',  
    domain: 'presidence.ga',  
    type: 'government',  
    priority: 1  
  },  
    
  // RÉSEAUX SOCIAUX (Facebook/Twitter)  
  'facebook.com/CommunicationGOUVGA': {  
    name: 'Communication Gouvernementale',  
    domain: 'facebook.com',  
    type: 'government',  
    priority: 2  
  },  
  'facebook.com/tvgabon24': {  
    name: 'Gabon 24 TV',  
    domain: 'facebook.com',  
    type: 'social',  
    priority: 3  
  },  
  'x.com/oliguinguema': {  
    name: 'Brice Clotaire Oligui Nguema',  
    domain: 'x.com',  
    type: 'government',  
    priority: 1  
  }  
};

// Ministères sur Facebook  
export const GABON\_MINISTRIES \= \[  
  'MINISTÈRE DE L\\'AGRICULTURE',  
  'Ministère de l\\'Economie Numérique',  
  'Ministère de l\\'Education Nationale',  
  'MINISTÈRE DE L\\'ENSEIGNEMENT SUPERIEUR',  
  'Ministère de l\\'Industrie et de la Transformation Locale',  
  'MINISTÈRE DE L\\'INTERIEUR',  
  'MINISTÈRE DE LA COMMUNICATION ET DES MEDIAS',  
  'MINISTÈRE DE LA JUSTICE',  
  'MINISTÈRE DES MINES ET DES RESSOURCES GEOLOGIQUES',  
  'MINISTÈRE DES TRANSPORTS',  
  'Ministère des Travaux Publics',  
  'Ministère du Commerce, des PME et PMI',  
  'Ministère du Pétrole et du Gaz',  
  'MINISTÈRE DU TOURISME DURABLE',  
  'Ministère du Travail, du Plein Emploi',  
  'Ministère l\\'Energie et des Ressources Hydrauliques',  
  'MINISTRE DU LOGEMENT, DE L\\'HABITAT'  
\];

## **🔧 Classe d'Extraction Améliorée**

// lib/rss/advancedRSSParser.ts  
import { GABON\_MEDIA\_SOURCES, GABON\_MINISTRIES } from './sourceMapping';

export class AdvancedRSSParser {  
  // ... code précédent ...

  /\*\*  
   \* Extraction intelligente de la source avec mapping Gabon  
   \*/  
  private extractSource(item: any, feedUrl: string): ExtractedArticle\['source'\] {  
    let sourceName \= '';  
    let sourceUrl \= '';  
    let domain \= '';  
    let sourceType: 'media' | 'government' | 'social' | 'sport' \= 'media';

    // 1\. Extraire le domaine depuis l'URL de l'article  
    if (item.link) {  
      try {  
        const url \= new URL(item.link);  
        domain \= this.extractCleanDomain(url.hostname);  
        sourceUrl \= \`${url.protocol}//${url.hostname}\`;  
          
        // Vérifier dans notre mapping  
        const mappedSource \= this.findSourceInMapping(domain, url.pathname);  
          
        if (mappedSource) {  
          sourceName \= mappedSource.name;  
          sourceType \= mappedSource.type;  
        }  
      } catch (e) {  
        console.error('Invalid URL:', item.link);  
      }  
    }

    // 2\. Si pas trouvé via l'URL, chercher dans les balises source  
    if (\!sourceName && item.source) {  
      sourceName \= this.extractSourceFromTag(item.source);  
    }

    // 3\. Détecter les ministères dans le titre ou la description  
    if (\!sourceName) {  
      sourceName \= this.detectMinistry(item.title, item.description);  
      if (sourceName) {  
        sourceType \= 'government';  
      }  
    }

    // 4\. Fallback sur le domaine formaté  
    if (\!sourceName && domain) {  
      sourceName \= this.formatDomainAsName(domain);  
    }

    return {  
      name: sourceName || 'Source inconnue',  
      url: sourceUrl || item.link || '',  
      domain: domain || 'unknown',  
      type: sourceType  
    };  
  }

  /\*\*  
   \* Trouve la source dans notre mapping  
   \*/  
  private findSourceInMapping(domain: string, pathname?: string): any {  
    // Recherche directe par domaine  
    const directMatch \= GABON\_MEDIA\_SOURCES\[domain\];  
    if (directMatch) {  
      return directMatch;  
    }

    // Recherche avec www  
    const wwwMatch \= GABON\_MEDIA\_SOURCES\[\`www.${domain}\`\];  
    if (wwwMatch) {  
      return wwwMatch;  
    }

    // Recherche sans www  
    const withoutWww \= domain.replace('www.', '');  
    const withoutWwwMatch \= GABON\_MEDIA\_SOURCES\[withoutWww\];  
    if (withoutWwwMatch) {  
      return withoutWwwMatch;  
    }

    // Cas spéciaux pour Facebook  
    if (domain.includes('facebook.com') && pathname) {  
      // Extraire le nom de la page Facebook  
      const pageName \= this.extractFacebookPageName(pathname);  
      if (pageName) {  
        const fbKey \= \`facebook.com/${pageName}\`;  
        if (GABON\_MEDIA\_SOURCES\[fbKey\]) {  
          return GABON\_MEDIA\_SOURCES\[fbKey\];  
        }  
          
        // Vérifier si c'est un ministère  
        const ministry \= this.detectMinistryFromFacebookPage(pageName);  
        if (ministry) {  
          return {  
            name: ministry,  
            type: 'government'  
          };  
        }  
      }  
    }

    // Cas spécial pour Twitter/X  
    if (domain.includes('x.com') || domain.includes('twitter.com')) {  
      const username \= this.extractTwitterUsername(pathname);  
      if (username) {  
        const twitterKey \= \`x.com/${username}\`;  
        if (GABON\_MEDIA\_SOURCES\[twitterKey\]) {  
          return GABON\_MEDIA\_SOURCES\[twitterKey\];  
        }  
      }  
    }

    return null;  
  }

  /\*\*  
   \* Nettoie le domaine  
   \*/  
  private extractCleanDomain(hostname: string): string {  
    return hostname  
      .replace(/^www\\./, '')  
      .replace(/^m\\./, '')  
      .replace(/^mobile\\./, '')  
      .replace(/^amp\\./, '');  
  }

  /\*\*  
   \* Extrait le nom de page Facebook  
   \*/  
  private extractFacebookPageName(pathname: string): string | null {  
    const match \= pathname.match(/^\\/(\[^\\/\\?\]+)/);  
    return match ? match\[1\] : null;  
  }

  /\*\*  
   \* Extrait le username Twitter  
   \*/  
  private extractTwitterUsername(pathname?: string): string | null {  
    if (\!pathname) return null;  
    const match \= pathname.match(/^\\/(@?\[^\\/\\?\]+)/);  
    return match ? match\[1\].replace('@', '') : null;  
  }

  /\*\*  
   \* Détecte un ministère depuis une page Facebook  
   \*/  
  private detectMinistryFromFacebookPage(pageName: string): string | null {  
    const lowerPageName \= pageName.toLowerCase();  
      
    // Patterns pour détecter les ministères  
    const ministryPatterns \= \[  
      'agriculturegouvga',  
      'numeriquegouvga',  
      'educationgouvga',  
      'esupgouvga',  
      'ministereindustriegabon',  
      'interieurgouvga',  
      'communicationengouvga',  
      'justicegouvga',  
      'minesgouvga',  
      'transportsgouvga',  
      'equipementgouvga',  
      'commercepmepmigouvga',  
      'petrolegouvga',  
      'tourismegouvga',  
      'eaugouvga',  
      'habitatgouvga'  
    \];

    for (const pattern of ministryPatterns) {  
      if (lowerPageName.includes(pattern)) {  
        // Trouver le ministère correspondant  
        const ministry \= GABON\_MINISTRIES.find(m \=\>   
          m.toLowerCase().includes(pattern.replace('gouvga', '').replace('ministere', ''))  
        );  
        return ministry || \`Ministère (${pageName})\`;  
      }  
    }

    return null;  
  }

  /\*\*  
   \* Détecte un ministère dans le contenu  
   \*/  
  private detectMinistry(title?: string, description?: string): string | null {  
    if (\!title && \!description) return null;  
      
    const content \= \`${title || ''} ${description || ''}\`.toLowerCase();  
      
    for (const ministry of GABON\_MINISTRIES) {  
      if (content.includes(ministry.toLowerCase())) {  
        return ministry;  
      }  
    }  
      
    return null;  
  }

  /\*\*  
   \* Extrait la source depuis la balise source  
   \*/  
  private extractSourceFromTag(source: any): string {  
    if (typeof source \=== 'string') {  
      return source;  
    }  
      
    if (typeof source \=== 'object') {  
      return source.\_ || source.title || source.name || '';  
    }  
      
    return '';  
  }

  /\*\*  
   \* Formate le domaine en nom lisible  
   \*/  
  private formatDomainAsName(domain: string): string {  
    // Vérifier d'abord dans notre mapping  
    const mapped \= GABON\_MEDIA\_SOURCES\[domain\];  
    if (mapped) {  
      return mapped.name;  
    }

    // Formatage par défaut  
    let name \= domain  
      .replace(/\\.(com|net|org|ga|fr|info|cm)$/i, '')  
      .replace(/-/g, ' ')  
      .replace(/\_/g, ' ');  
      
    // Capitaliser chaque mot  
    name \= name.split(' ')  
      .map(word \=\> word.charAt(0).toUpperCase() \+ word.slice(1))  
      .join(' ');  
      
    return name;  
  }

  // ... reste du code ...  
}

## **🎯 Fonction de Test et Validation**

// lib/rss/testSourceExtraction.ts

export async function testSourceExtraction(rssUrl: string) {  
  const parser \= new AdvancedRSSParser();  
  const articles \= await parser.parseFeed(rssUrl);  
    
  // Analyser les sources extraites  
  const sourceStats \= new Map\<string, number\>();  
  const sourceExamples \= new Map\<string, any\[\]\>();  
    
  for (const article of articles) {  
    const sourceName \= article.source.name;  
      
    // Compter les occurrences  
    sourceStats.set(sourceName, (sourceStats.get(sourceName) || 0\) \+ 1);  
      
    // Garder des exemples  
    if (\!sourceExamples.has(sourceName)) {  
      sourceExamples.set(sourceName, \[\]);  
    }  
      
    const examples \= sourceExamples.get(sourceName)\!;  
    if (examples.length \< 3\) {  
      examples.push({  
        title: article.title,  
        url: article.link,  
        domain: article.source.domain  
      });  
    }  
  }  
    
  // Rapport  
  console.log('\\n=== RAPPORT D\\'EXTRACTION DES SOURCES \===\\n');  
  console.log(\`Total d'articles: ${articles.length}\`);  
  console.log(\`Sources uniques: ${sourceStats.size}\\n\`);  
    
  // Trier par nombre d'articles  
  const sorted \= Array.from(sourceStats.entries())  
    .sort((a, b) \=\> b\[1\] \- a\[1\]);  
    
  for (const \[source, count\] of sorted) {  
    console.log(\`\\n📰 ${source} (${count} articles)\`);  
      
    const examples \= sourceExamples.get(source);  
    if (examples) {  
      console.log('  Exemples:');  
      examples.forEach(ex \=\> {  
        console.log(\`    \- ${ex.title.substring(0, 60)}...\`);  
        console.log(\`      URL: ${ex.url}\`);  
      });  
    }  
  }  
    
  // Identifier les sources non mappées  
  const unknownSources \= Array.from(sourceStats.keys())  
    .filter(name \=\> name \=== 'Source inconnue' || \!name);  
    
  if (unknownSources.length \> 0\) {  
    console.log('\\n⚠️  SOURCES NON IDENTIFIÉES:');  
    unknownSources.forEach(source \=\> {  
      console.log(\`  \- ${source}\`);  
    });  
  }  
    
  return {  
    totalArticles: articles.length,  
    uniqueSources: sourceStats.size,  
    sourceDistribution: Object.fromEntries(sourceStats),  
    articles  
  };  
}

Ce système amélioré permet :

1. **Identification précise** des 40+ sources médias gabonaises  
2. **Détection automatique** des ministères et sources gouvernementales  
3. **Gestion des réseaux sociaux** (Facebook, Twitter/X)  
4. **Prioritisation des sources** selon leur importance  
5. **Typage des sources** (media, government, social, sport)  
6. **Fallback intelligent** si source non reconnue  
7. **Tests et validation** pour vérifier l'extraction

Le mapping est facilement extensible pour ajouter de nouvelles sources au fur et à mesure.

