# **Système de Bandeau d'Information en Temps Réel pour Gabon 24/7**

## **📋 Architecture du Système**

Le système comprend :

1. **Collecteur de titres** : Récupère les articles des 3 dernières heures  
2. **Service de reformulation IA** : Résume/reformule via OpenAI  
3. **Gestionnaire de bandeau** : Interface d'administration  
4. **Widget d'affichage** : Bandeau défilant sur la page d'accueil  
5. **Système d'urgence** : Messages prioritaires manuels

## **🚀 Prompt Windsurf Cascade pour Développement**

\# Développement du Système de Bandeau d'Information pour Gabon 24/7

\#\# Contexte du Projet

Tu es un développeur full-stack expert chargé de créer un système complet de bandeau d'information défilant pour Gabon 24/7. Ce bandeau affiche les titres d'articles reformulés par IA, provenant des 3 dernières heures d'actualités. Le système doit permettre la gestion manuelle des messages, l'édition, et la diffusion d'urgences.

\#\# Objectifs Techniques

\#\#\# Stack Technique  
\- \*\*Frontend\*\* : Next.js 14 avec TypeScript  
\- \*\*Animation\*\* : Framer Motion \+ CSS animations  
\- \*\*Backend\*\* : Netlify Functions  
\- \*\*Base de données\*\* : Supabase  
\- \*\*IA\*\* : OpenAI GPT-4o-mini pour reformulation  
\- \*\*Cache\*\* : Redis/Upstash pour optimisation  
\- \*\*Temps réel\*\* : Supabase Realtime

\#\# Structure du Projet

/app /admin /ticker /page.tsx \# Interface de gestion du bandeau /api /ticker /route.ts \# API endpoints /components /ticker /NewsTicker.tsx \# Widget bandeau principal /TickerManager.tsx \# Interface admin /TickerMessage.tsx \# Message individuel /TickerControls.tsx \# Contrôles pause/play /netlify/functions /process-ticker-news.ts \# Collecte et reformulation /update-ticker-message.ts \# Mise à jour manuelle /send-urgent-message.ts \# Messages urgents /lib /ticker /tickerService.ts \# Service principal /reformulator.ts \# Reformulation IA /messageQueue.ts \# Gestion file de messages /supabase /migrations /create\_ticker\_tables.sql

\#\# 1\. Schéma Base de Données

Crée ces tables dans Supabase :

\`\`\`sql  
\-- Table des messages du bandeau  
CREATE TABLE ticker\_messages (  
    id uuid PRIMARY KEY DEFAULT gen\_random\_uuid(),  
      
    \-- Contenu  
    original\_title text NOT NULL,  
    reformulated\_title text NOT NULL,  
    message\_type text CHECK (message\_type IN ('auto', 'manual', 'urgent')) DEFAULT 'auto',  
      
    \-- Source  
    article\_id uuid REFERENCES feed\_items(id),  
    article\_url text,  
    source\_name text,  
    source\_logo text,  
      
    \-- Configuration  
    is\_active boolean DEFAULT true,  
    is\_urgent boolean DEFAULT false,  
    priority integer DEFAULT 0, \-- Plus élevé \= plus prioritaire  
      
    \-- Timing  
    display\_start timestamptz DEFAULT now(),  
    display\_end timestamptz DEFAULT (now() \+ interval '3 hours'),  
    created\_at timestamptz DEFAULT now(),  
    updated\_at timestamptz DEFAULT now(),  
      
    \-- Métadonnées  
    click\_count integer DEFAULT 0,  
    last\_displayed\_at timestamptz,  
    edited\_by uuid REFERENCES auth.users(id),  
    ai\_tokens\_used integer DEFAULT 0  
);

\-- Table de configuration du bandeau  
CREATE TABLE ticker\_config (  
    id uuid PRIMARY KEY DEFAULT gen\_random\_uuid(),  
      
    \-- Paramètres d'affichage  
    is\_enabled boolean DEFAULT true,  
    speed integer DEFAULT 50, \-- pixels par seconde  
    pause\_on\_hover boolean DEFAULT true,  
      
    \-- Paramètres de contenu  
    max\_messages integer DEFAULT 20,  
    refresh\_interval integer DEFAULT 300, \-- secondes  
    message\_duration integer DEFAULT 10800, \-- 3 heures en secondes  
      
    \-- Style  
    background\_color text DEFAULT '\#1f2937',  
    text\_color text DEFAULT '\#ffffff',  
    urgent\_color text DEFAULT '\#ef4444',  
    height integer DEFAULT 40, \-- pixels  
    font\_size integer DEFAULT 14,  
      
    \-- Filtres  
    excluded\_sources text\[\] DEFAULT '{}',  
    included\_categories text\[\] DEFAULT '{}',  
    min\_article\_age\_minutes integer DEFAULT 0,  
    max\_article\_age\_minutes integer DEFAULT 180,  
      
    updated\_at timestamptz DEFAULT now(),  
    updated\_by uuid REFERENCES auth.users(id)  
);

\-- Table de logs pour tracking  
CREATE TABLE ticker\_logs (  
    id uuid PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    message\_id uuid REFERENCES ticker\_messages(id),  
    event\_type text CHECK (event\_type IN ('displayed', 'clicked', 'edited', 'created', 'deleted')),  
    user\_id uuid REFERENCES auth.users(id),  
    metadata jsonb DEFAULT '{}',  
    created\_at timestamptz DEFAULT now()  
);

\-- Indexes pour performance  
CREATE INDEX idx\_ticker\_messages\_active ON ticker\_messages(is\_active, display\_start, display\_end);  
CREATE INDEX idx\_ticker\_messages\_priority ON ticker\_messages(priority DESC, created\_at DESC);  
CREATE INDEX idx\_ticker\_messages\_urgent ON ticker\_messages(is\_urgent) WHERE is\_urgent \= true;  
CREATE INDEX idx\_ticker\_logs\_message ON ticker\_logs(message\_id, created\_at DESC);

\-- Fonction pour nettoyer les vieux messages  
CREATE OR REPLACE FUNCTION cleanup\_old\_ticker\_messages()  
RETURNS void AS $$  
BEGIN  
    UPDATE ticker\_messages   
    SET is\_active \= false   
    WHERE display\_end \< now()   
    AND message\_type \= 'auto';  
      
    DELETE FROM ticker\_messages   
    WHERE created\_at \< now() \- interval '7 days'   
    AND message\_type \= 'auto';  
END;  
$$ LANGUAGE plpgsql;

\-- Scheduler pour nettoyage automatique (pg\_cron)  
SELECT cron.schedule('cleanup-ticker', '0 \* \* \* \*', 'SELECT cleanup\_old\_ticker\_messages();');

## **2\. Service de Collecte et Reformulation**

// netlify/functions/process-ticker-news.ts  
import { Handler } from '@netlify/functions';  
import OpenAI from 'openai';  
import { createClient } from '@supabase/supabase-js';

const openai \= new OpenAI({  
  apiKey: process.env.OPENAI\_API\_KEY,  
});

const supabase \= createClient(  
  process.env.SUPABASE\_URL\!,  
  process.env.SUPABASE\_SERVICE\_KEY\!  
);

export const handler: Handler \= async (event, context) \=\> {  
  try {  
    // 1\. Récupérer la configuration  
    const { data: config } \= await supabase  
      .from('ticker\_config')  
      .select('\*')  
      .single();

    if (\!config?.is\_enabled) {  
      return { statusCode: 200, body: 'Ticker disabled' };  
    }

    // 2\. Récupérer les derniers articles (3 dernières heures)  
    const threeHoursAgo \= new Date(Date.now() \- 3 \* 60 \* 60 \* 1000);  
      
    const { data: articles } \= await supabase  
      .from('feed\_items')  
      .select('id, title, url, source\_name, pub\_date')  
      .gte('pub\_date', threeHoursAgo.toISOString())  
      .order('pub\_date', { ascending: false })  
      .limit(30);

    if (\!articles || articles.length \=== 0\) {  
      return { statusCode: 200, body: 'No new articles' };  
    }

    // 3\. Filtrer les articles déjà traités  
    const { data: existingMessages } \= await supabase  
      .from('ticker\_messages')  
      .select('article\_id')  
      .in('article\_id', articles.map(a \=\> a.id));

    const processedIds \= new Set(existingMessages?.map(m \=\> m.article\_id) || \[\]);  
    const newArticles \= articles.filter(a \=\> \!processedIds.has(a.id));

    if (newArticles.length \=== 0\) {  
      return { statusCode: 200, body: 'No new articles to process' };  
    }

    // 4\. Reformuler les titres avec OpenAI  
    const reformulatedMessages \= await reformulateTitles(newArticles);

    // 5\. Sauvegarder les messages reformulés  
    const messagesToInsert \= reformulatedMessages.map(msg \=\> ({  
      original\_title: msg.original,  
      reformulated\_title: msg.reformulated,  
      article\_id: msg.article\_id,  
      article\_url: msg.url,  
      source\_name: msg.source,  
      message\_type: 'auto',  
      display\_end: new Date(Date.now() \+ config.message\_duration \* 1000).toISOString(),  
      ai\_tokens\_used: msg.tokens\_used  
    }));

    const { error } \= await supabase  
      .from('ticker\_messages')  
      .insert(messagesToInsert);

    if (error) throw error;

    return {  
      statusCode: 200,  
      body: JSON.stringify({  
        processed: messagesToInsert.length,  
        messages: reformulatedMessages  
      })  
    };

  } catch (error) {  
    console.error('Error processing ticker news:', error);  
    return {  
      statusCode: 500,  
      body: JSON.stringify({ error: 'Processing failed' })  
    };  
  }  
};

async function reformulateTitles(articles: any\[\]): Promise\<any\[\]\> {  
  const prompt \= \`  
Tu es un rédacteur expert pour un bandeau d'information gabonais.  
Reformule ces titres d'articles pour qu'ils soient :  
1\. Courts et percutants (max 100 caractères)  
2\. Clairs et factuels  
3\. Adaptés à un défilement rapide  
4\. En français correct

Articles à reformuler :  
${articles.map((a, i) \=\> \`${i \+ 1}. \[${a.source\_name}\] ${a.title}\`).join('\\n')}

Format de réponse JSON :  
{  
  "titles": \[  
    {  
      "index": 1,  
      "reformulated": "Titre reformulé court et clair"  
    }  
  \]  
}

Règles importantes :  
\- Ne pas déformer l'information  
\- Garder les noms propres  
\- Privilégier la voix active  
\- Éviter les acronymes non connus  
\`;

  const completion \= await openai.chat.completions.create({  
    model: "gpt-4o-mini",  
    messages: \[  
      { role: "system", content: "Tu es un expert en rédaction de titres d'actualité concis." },  
      { role: "user", content: prompt }  
    \],  
    temperature: 0.3,  
    max\_tokens: 1000,  
    response\_format: { type: "json\_object" }  
  });

  const result \= JSON.parse(completion.choices\[0\].message.content || '{}');  
  const usage \= completion.usage;

  return articles.map((article, index) \=\> {  
    const reformulated \= result.titles?.find((t: any) \=\> t.index \=== index \+ 1);  
    return {  
      article\_id: article.id,  
      original: article.title,  
      reformulated: reformulated?.reformulated || article.title.substring(0, 100),  
      source: article.source\_name,  
      url: article.url,  
      tokens\_used: Math.floor((usage?.total\_tokens || 0\) / articles.length)  
    };  
  });  
}

## **3\. Widget Bandeau Défilant**

// components/ticker/NewsTicker.tsx  
'use client';

import { useState, useEffect, useRef } from 'react';  
import { motion, AnimatePresence } from 'framer-motion';  
import { Pause, Play, AlertTriangle, Radio, X } from 'lucide-react';  
import { supabase } from '@/lib/supabase/client';  
import Link from 'next/link';

interface TickerMessage {  
  id: string;  
  reformulated\_title: string;  
  article\_url: string;  
  source\_name: string;  
  is\_urgent: boolean;  
  priority: number;  
}

export default function NewsTicker() {  
  const \[messages, setMessages\] \= useState\<TickerMessage\[\]\>(\[\]);  
  const \[isPaused, setIsPaused\] \= useState(false);  
  const \[speed, setSpeed\] \= useState(50); // pixels per second  
  const \[currentSource, setCurrentSource\] \= useState\<string\>('');  
  const \[isVisible, setIsVisible\] \= useState(true);  
  const tickerRef \= useRef\<HTMLDivElement\>(null);  
  const animationRef \= useRef\<any\>(null);

  useEffect(() \=\> {  
    fetchMessages();  
    const interval \= setInterval(fetchMessages, 60000); // Refresh every minute

    // Subscribe to real-time updates  
    const subscription \= supabase  
      .channel('ticker\_updates')  
      .on(  
        'postgres\_changes',  
        {  
          event: '\*',  
          schema: 'public',  
          table: 'ticker\_messages'  
        },  
        () \=\> {  
          fetchMessages();  
        }  
      )  
      .subscribe();

    return () \=\> {  
      clearInterval(interval);  
      subscription.unsubscribe();  
    };  
  }, \[\]);

  const fetchMessages \= async () \=\> {  
    const { data } \= await supabase  
      .from('ticker\_messages')  
      .select('\*')  
      .eq('is\_active', true)  
      .gte('display\_end', new Date().toISOString())  
      .order('is\_urgent', { ascending: false })  
      .order('priority', { ascending: false })  
      .order('created\_at', { ascending: false })  
      .limit(20);

    if (data) {  
      setMessages(data);  
    }  
  };

  const trackClick \= async (messageId: string) \=\> {  
    await supabase  
      .from('ticker\_logs')  
      .insert({  
        message\_id: messageId,  
        event\_type: 'clicked'  
      });

    await supabase  
      .from('ticker\_messages')  
      .update({ click\_count: supabase.raw('click\_count \+ 1') })  
      .eq('id', messageId);  
  };

  if (\!isVisible || messages.length \=== 0\) return null;

  return (  
    \<div className="relative w-full bg-gray-900 border-y border-gray-700 overflow-hidden"\>  
      {/\* Source Badge \*/}  
      \<div className="absolute left-0 top-0 bottom-0 z-20 bg-gradient-to-r from-gray-900 via-gray-900 to-transparent pr-8"\>  
        \<div className="h-full flex items-center px-4"\>  
          \<div className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 rounded-lg"\>  
            \<Radio className="w-4 h-4 animate-pulse" /\>  
            \<span className="text-sm font-semibold whitespace-nowrap"\>  
              {currentSource || 'INFO LIVE'}  
            \</span\>  
          \</div\>  
        \</div\>  
      \</div\>

      {/\* Messages Container \*/}  
      \<div   
        ref={tickerRef}  
        className="relative h-12 flex items-center"  
        onMouseEnter={() \=\> setIsPaused(true)}  
        onMouseLeave={() \=\> setIsPaused(false)}  
      \>  
        \<motion.div  
          className="flex items-center gap-8 whitespace-nowrap"  
          animate={{  
            x: isPaused ? 0 : '-100%'  
          }}  
          transition={{  
            x: {  
              duration: messages.length \* 10 / (speed / 10),  
              ease: "linear",  
              repeat: Infinity,  
              repeatType: "loop"  
            }  
          }}  
          style={{  
            paddingLeft: '200px' // Offset for source badge  
          }}  
        \>  
          {/\* Duplicate messages for seamless loop \*/}  
          {\[...messages, ...messages\].map((message, index) \=\> (  
            \<Link  
              key={\`${message.id}-${index}\`}  
              href={message.article\_url}  
              target="\_blank"  
              onClick={() \=\> trackClick(message.id)}  
              onMouseEnter={() \=\> setCurrentSource(message.source\_name)}  
              className="inline-flex items-center gap-2 hover:text-orange-400 transition-colors"  
            \>  
              {message.is\_urgent && (  
                \<AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" /\>  
              )}  
              \<span className={\`text-sm ${message.is\_urgent ? 'text-red-400 font-semibold' : 'text-white'}\`}\>  
                {message.reformulated\_title}  
              \</span\>  
              \<span className="text-gray-500 text-xs"\>•\</span\>  
            \</Link\>  
          ))}  
        \</motion.div\>  
      \</div\>

      {/\* Controls \*/}  
      \<div className="absolute right-0 top-0 bottom-0 z-20 bg-gradient-to-l from-gray-900 via-gray-900 to-transparent pl-8"\>  
        \<div className="h-full flex items-center gap-2 px-4"\>  
          \<button  
            onClick={() \=\> setIsPaused(\!isPaused)}  
            className="p-1.5 hover:bg-gray-800 rounded transition-colors"  
            aria-label={isPaused ? 'Play' : 'Pause'}  
          \>  
            {isPaused ? (  
              \<Play className="w-4 h-4 text-gray-400" /\>  
            ) : (  
              \<Pause className="w-4 h-4 text-gray-400" /\>  
            )}  
          \</button\>  
            
          \<button  
            onClick={() \=\> setIsVisible(false)}  
            className="p-1.5 hover:bg-gray-800 rounded transition-colors"  
            aria-label="Fermer"  
          \>  
            \<X className="w-4 h-4 text-gray-400" /\>  
          \</button\>  
        \</div\>  
      \</div\>  
    \</div\>  
  );  
}

## **4\. Interface de Gestion Admin**

// app/admin/ticker/page.tsx  
'use client';

import { useState, useEffect } from 'react';  
import { motion } from 'framer-motion';  
import {   
  Settings, Plus, Edit2, Trash2, AlertTriangle,   
  Save, RefreshCw, Zap, Clock, Eye, EyeOff   
} from 'lucide-react';  
import { supabase } from '@/lib/supabase/client';

export default function TickerManager() {  
  const \[messages, setMessages\] \= useState\<any\[\]\>(\[\]);  
  const \[config, setConfig\] \= useState\<any\>({});  
  const \[editingMessage, setEditingMessage\] \= useState\<any\>(null);  
  const \[newMessage, setNewMessage\] \= useState('');  
  const \[activeTab, setActiveTab\] \= useState\<'messages' | 'settings' | 'urgent'\>('messages');

  useEffect(() \=\> {  
    fetchMessages();  
    fetchConfig();  
  }, \[\]);

  const fetchMessages \= async () \=\> {  
    const { data } \= await supabase  
      .from('ticker\_messages')  
      .select('\*')  
      .order('created\_at', { ascending: false })  
      .limit(50);  
      
    if (data) setMessages(data);  
  };

  const fetchConfig \= async () \=\> {  
    const { data } \= await supabase  
      .from('ticker\_config')  
      .select('\*')  
      .single();  
      
    if (data) setConfig(data);  
  };

  const handleCreateMessage \= async () \=\> {  
    if (\!newMessage.trim()) return;

    const { error } \= await supabase  
      .from('ticker\_messages')  
      .insert({  
        original\_title: newMessage,  
        reformulated\_title: newMessage,  
        message\_type: 'manual',  
        source\_name: 'Gabon 24/7',  
        display\_end: new Date(Date.now() \+ 3 \* 60 \* 60 \* 1000).toISOString()  
      });

    if (\!error) {  
      setNewMessage('');  
      fetchMessages();  
    }  
  };

  const handleUpdateMessage \= async (id: string, updates: any) \=\> {  
    const { error } \= await supabase  
      .from('ticker\_messages')  
      .update({  
        ...updates,  
        updated\_at: new Date().toISOString()  
      })  
      .eq('id', id);

    if (\!error) {  
      fetchMessages();  
      setEditingMessage(null);  
    }  
  };

  const handleDeleteMessage \= async (id: string) \=\> {  
    if (\!confirm('Supprimer ce message ?')) return;

    const { error } \= await supabase  
      .from('ticker\_messages')  
      .delete()  
      .eq('id', id);

    if (\!error) {  
      fetchMessages();  
    }  
  };

  const handleSendUrgent \= async (message: string) \=\> {  
    const { error } \= await supabase  
      .from('ticker\_messages')  
      .insert({  
        original\_title: message,  
        reformulated\_title: message,  
        message\_type: 'urgent',  
        is\_urgent: true,  
        priority: 1000,  
        source\_name: '🚨 URGENT',  
        display\_end: new Date(Date.now() \+ 24 \* 60 \* 60 \* 1000).toISOString()  
      });

    if (\!error) {  
      alert('Message urgent envoyé \!');  
      fetchMessages();  
    }  
  };

  const handleUpdateConfig \= async (updates: any) \=\> {  
    const { error } \= await supabase  
      .from('ticker\_config')  
      .update(updates)  
      .eq('id', config.id);

    if (\!error) {  
      fetchConfig();  
    }  
  };

  return (  
    \<div className="min-h-screen bg-gray-900 text-white p-6"\>  
      \<div className="max-w-7xl mx-auto"\>  
        {/\* Header \*/}  
        \<div className="flex items-center justify-between mb-8"\>  
          \<h1 className="text-3xl font-bold"\>Gestion du Bandeau d'Information\</h1\>  
          \<button  
            onClick={fetchMessages}  
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center gap-2"  
          \>  
            \<RefreshCw className="w-4 h-4" /\>  
            Actualiser  
          \</button\>  
        \</div\>

        {/\* Tabs \*/}  
        \<div className="flex gap-2 mb-6"\>  
          {\[  
            { id: 'messages', label: 'Messages', icon: Eye },  
            { id: 'urgent', label: 'Urgences', icon: AlertTriangle },  
            { id: 'settings', label: 'Paramètres', icon: Settings }  
          \].map(tab \=\> {  
            const Icon \= tab.icon;  
            return (  
              \<button  
                key={tab.id}  
                onClick={() \=\> setActiveTab(tab.id as any)}  
                className={\`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${  
                  activeTab \=== tab.id  
                    ? 'bg-orange-600'  
                    : 'bg-gray-800 hover:bg-gray-700'  
                }\`}  
              \>  
                \<Icon className="w-4 h-4" /\>  
                {tab.label}  
              \</button\>  
            );  
          })}  
        \</div\>

        {/\* Messages Tab \*/}  
        {activeTab \=== 'messages' && (  
          \<div className="space-y-4"\>  
            {/\* Create New Message \*/}  
            \<div className="bg-gray-800 rounded-lg p-4"\>  
              \<h3 className="font-semibold mb-3"\>Créer un message\</h3\>  
              \<div className="flex gap-2"\>  
                \<input  
                  type="text"  
                  value={newMessage}  
                  onChange={(e) \=\> setNewMessage(e.target.value)}  
                  placeholder="Tapez votre message..."  
                  className="flex-1 px-4 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"  
                  maxLength={100}  
                /\>  
                \<button  
                  onClick={handleCreateMessage}  
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg flex items-center gap-2"  
                \>  
                  \<Plus className="w-4 h-4" /\>  
                  Ajouter  
                \</button\>  
              \</div\>  
            \</div\>

            {/\* Messages List \*/}  
            \<div className="bg-gray-800 rounded-lg overflow-hidden"\>  
              \<table className="w-full"\>  
                \<thead className="bg-gray-900"\>  
                  \<tr\>  
                    \<th className="px-4 py-3 text-left"\>Message\</th\>  
                    \<th className="px-4 py-3 text-left"\>Source\</th\>  
                    \<th className="px-4 py-3 text-left"\>Type\</th\>  
                    \<th className="px-4 py-3 text-left"\>Statut\</th\>  
                    \<th className="px-4 py-3 text-left"\>Clics\</th\>  
                    \<th className="px-4 py-3 text-right"\>Actions\</th\>  
                  \</tr\>  
                \</thead\>  
                \<tbody className="divide-y divide-gray-700"\>  
                  {messages.map(message \=\> (  
                    \<tr key={message.id} className="hover:bg-gray-700/50"\>  
                      \<td className="px-4 py-3"\>  
                        {editingMessage?.id \=== message.id ? (  
                          \<input  
                            type="text"  
                            value={editingMessage.reformulated\_title}  
                            onChange={(e) \=\> setEditingMessage({  
                              ...editingMessage,  
                              reformulated\_title: e.target.value  
                            })}  
                            className="w-full px-2 py-1 bg-gray-700 rounded"  
                          /\>  
                        ) : (  
                          \<span className={message.is\_urgent ? 'text-red-400 font-semibold' : ''}\>  
                            {message.reformulated\_title}  
                          \</span\>  
                        )}  
                      \</td\>  
                      \<td className="px-4 py-3 text-sm"\>{message.source\_name}\</td\>  
                      \<td className="px-4 py-3"\>  
                        \<span className={\`px-2 py-1 text-xs rounded ${  
                          message.message\_type \=== 'urgent'   
                            ? 'bg-red-600'   
                            : message.message\_type \=== 'manual'  
                            ? 'bg-blue-600'  
                            : 'bg-gray-600'  
                        }\`}\>  
                          {message.message\_type}  
                        \</span\>  
                      \</td\>  
                      \<td className="px-4 py-3"\>  
                        \<button  
                          onClick={() \=\> handleUpdateMessage(message.id, {   
                            is\_active: \!message.is\_active   
                          })}  
                          className="p-1"  
                        \>  
                          {message.is\_active ? (  
                            \<Eye className="w-4 h-4 text-green-500" /\>  
                          ) : (  
                            \<EyeOff className="w-4 h-4 text-gray-500" /\>  
                          )}  
                        \</button\>  
                      \</td\>  
                      \<td className="px-4 py-3 text-sm"\>{message.click\_count}\</td\>  
                      \<td className="px-4 py-3 text-right"\>  
                        {editingMessage?.id \=== message.id ? (  
                          \<div className="flex justify-end gap-2"\>  
                            \<button  
                              onClick={() \=\> handleUpdateMessage(message.id, editingMessage)}  
                              className="p-1 text-green-500 hover:text-green-400"  
                            \>  
                              \<Save className="w-4 h-4" /\>  
                            \</button\>  
                            \<button  
                              onClick={() \=\> setEditingMessage(null)}  
                              className="p-1 text-gray-500 hover:text-gray-400"  
                            \>  
                              \<X className="w-4 h-4" /\>  
                            \</button\>  
                          \</div\>  
                        ) : (  
                          \<div className="flex justify-end gap-2"\>  
                            \<button  
                              onClick={() \=\> setEditingMessage(message)}  
                              className="p-1 text-blue-500 hover:text-blue-400"  
                            \>  
                              \<Edit2 className="w-4 h-4" /\>  
                            \</button\>  
                            \<button  
                              onClick={() \=\> handleDeleteMessage(message.id)}  
                              className="p-1 text-red-500 hover:text-red-400"  
                            \>  
                              \<Trash2 className="w-4 h-4" /\>  
                            \</button\>  
                          \</div\>  
                        )}  
                      \</td\>  
                    \</tr\>  
                  ))}  
                \</tbody\>  
              \</table\>  
            \</div\>  
          \</div\>  
        )}

        {/\* Urgent Tab \*/}  
        {activeTab \=== 'urgent' && (  
          \<div className="bg-gray-800 rounded-lg p-6"\>  
            \<h3 className="text-xl font-semibold mb-4 flex items-center gap-2"\>  
              \<AlertTriangle className="w-5 h-5 text-red-500" /\>  
              Envoyer un Message Urgent  
            \</h3\>  
              
            \<div className="space-y-4"\>  
              \<textarea  
                placeholder="Message urgent à diffuser immédiatement..."  
                className="w-full px-4 py-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 h-32"  
                maxLength={150}  
              /\>  
                
              \<div className="flex items-center gap-4"\>  
                \<button  
                  onClick={() \=\> {  
                    const textarea \= document.querySelector('textarea');  
                    if (textarea?.value) {  
                      handleSendUrgent(textarea.value);  
                      textarea.value \= '';  
                    }  
                  }}  
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-2 font-semibold"  
                \>  
                  \<Zap className="w-5 h-5" /\>  
                  Diffuser Immédiatement  
                \</button\>  
                  
                \<p className="text-sm text-gray-400"\>  
                  Le message sera affiché en priorité pendant 24h  
                \</p\>  
              \</div\>  
            \</div\>  
          \</div\>  
        )}

        {/\* Settings Tab \*/}  
        {activeTab \=== 'settings' && (  
          \<div className="bg-gray-800 rounded-lg p-6 space-y-6"\>  
            \<h3 className="text-xl font-semibold mb-4"\>Paramètres du Bandeau\</h3\>  
              
            \<div className="grid md:grid-cols-2 gap-6"\>  
              {/\* Activation \*/}  
              \<div\>  
                \<label className="block text-sm font-medium mb-2"\>

                 Activation  
                \</label\>  
                \<button  
                  onClick={() \=\> handleUpdateConfig({ is\_enabled: \!config.is\_enabled })}  
                  className={\`relative w-20 h-10 rounded-full transition-colors ${  
                    config.is\_enabled ? 'bg-orange-600' : 'bg-gray-600'  
                  }\`}  
                \>  
                  \<motion.div   
                    className="absolute w-8 h-8 bg-white rounded-full top-1"  
                    animate={{ x: config.is\_enabled ? 40 : 4 }}  
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}  
                  /\>  
                \</button\>  
              \</div\>

              {/\* Vitesse de défilement \*/}  
              \<div\>  
                \<label className="block text-sm font-medium mb-2"\>  
                  Vitesse de défilement (pixels/seconde)  
                \</label\>  
                \<input  
                  type="range"  
                  min="10"  
                  max="100"  
                  value={config.speed || 50}  
                  onChange={(e) \=\> handleUpdateConfig({ speed: parseInt(e.target.value) })}  
                  className="w-full"  
                /\>  
                \<span className="text-sm text-gray-400"\>{config.speed || 50} px/s\</span\>  
              \</div\>

              {/\* Durée des messages \*/}  
              \<div\>  
                \<label className="block text-sm font-medium mb-2"\>  
                  Durée d'affichage (heures)  
                \</label\>  
                \<select  
                  value={config.message\_duration / 3600}  
                  onChange={(e) \=\> handleUpdateConfig({   
                    message\_duration: parseInt(e.target.value) \* 3600   
                  })}  
                  className="w-full px-4 py-2 bg-gray-700 rounded-lg"  
                \>  
                  \<option value="1"\>1 heure\</option\>  
                  \<option value="3"\>3 heures\</option\>  
                  \<option value="6"\>6 heures\</option\>  
                  \<option value="12"\>12 heures\</option\>  
                  \<option value="24"\>24 heures\</option\>  
                \</select\>  
              \</div\>

              {/\* Nombre max de messages \*/}  
              \<div\>  
                \<label className="block text-sm font-medium mb-2"\>  
                  Nombre maximum de messages  
                \</label\>  
                \<input  
                  type="number"  
                  value={config.max\_messages || 20}  
                  onChange={(e) \=\> handleUpdateConfig({   
                    max\_messages: parseInt(e.target.value)   
                  })}  
                  className="w-full px-4 py-2 bg-gray-700 rounded-lg"  
                  min="5"  
                  max="50"  
                /\>  
              \</div\>

              {/\* Intervalle de rafraîchissement \*/}  
              \<div\>  
                \<label className="block text-sm font-medium mb-2"\>  
                  Intervalle de rafraîchissement (secondes)  
                \</label\>  
                \<input  
                  type="number"  
                  value={config.refresh\_interval || 300}  
                  onChange={(e) \=\> handleUpdateConfig({   
                    refresh\_interval: parseInt(e.target.value)   
                  })}  
                  className="w-full px-4 py-2 bg-gray-700 rounded-lg"  
                  min="60"  
                  max="1800"  
                /\>  
              \</div\>

              {/\* Pause au survol \*/}  
              \<div\>  
                \<label className="flex items-center gap-3"\>  
                  \<input  
                    type="checkbox"  
                    checked={config.pause\_on\_hover}  
                    onChange={(e) \=\> handleUpdateConfig({   
                      pause\_on\_hover: e.target.checked   
                    })}  
                    className="w-4 h-4"  
                  /\>  
                  \<span\>Pause au survol de la souris\</span\>  
                \</label\>  
              \</div\>  
            \</div\>

            {/\* Style Settings \*/}  
            \<div className="pt-6 border-t border-gray-700"\>  
              \<h4 className="font-semibold mb-4"\>Apparence\</h4\>  
                
              \<div className="grid md:grid-cols-3 gap-4"\>  
                \<div\>  
                  \<label className="block text-sm font-medium mb-2"\>  
                    Couleur de fond  
                  \</label\>  
                  \<input  
                    type="color"  
                    value={config.background\_color || '\#1f2937'}  
                    onChange={(e) \=\> handleUpdateConfig({   
                      background\_color: e.target.value   
                    })}  
                    className="w-full h-10 rounded cursor-pointer"  
                  /\>  
                \</div\>

                \<div\>  
                  \<label className="block text-sm font-medium mb-2"\>  
                    Couleur du texte  
                  \</label\>  
                  \<input  
                    type="color"  
                    value={config.text\_color || '\#ffffff'}  
                    onChange={(e) \=\> handleUpdateConfig({   
                      text\_color: e.target.value   
                    })}  
                    className="w-full h-10 rounded cursor-pointer"  
                  /\>  
                \</div\>

                \<div\>  
                  \<label className="block text-sm font-medium mb-2"\>  
                    Couleur urgences  
                  \</label\>  
                  \<input  
                    type="color"  
                    value={config.urgent\_color || '\#ef4444'}  
                    onChange={(e) \=\> handleUpdateConfig({   
                      urgent\_color: e.target.value   
                    })}  
                    className="w-full h-10 rounded cursor-pointer"  
                  /\>  
                \</div\>  
              \</div\>  
            \</div\>  
          \</div\>  
        )}

        {/\* Statistics \*/}  
        \<div className="mt-8 grid md:grid-cols-4 gap-4"\>  
          \<div className="bg-gray-800 rounded-lg p-4"\>  
            \<div className="text-gray-400 text-sm mb-1"\>Messages actifs\</div\>  
            \<div className="text-2xl font-bold"\>  
              {messages.filter(m \=\> m.is\_active).length}  
            \</div\>  
          \</div\>  
            
          \<div className="bg-gray-800 rounded-lg p-4"\>  
            \<div className="text-gray-400 text-sm mb-1"\>Total de clics\</div\>  
            \<div className="text-2xl font-bold"\>  
              {messages.reduce((sum, m) \=\> sum \+ m.click\_count, 0)}  
            \</div\>  
          \</div\>  
            
          \<div className="bg-gray-800 rounded-lg p-4"\>  
            \<div className="text-gray-400 text-sm mb-1"\>Messages urgents\</div\>  
            \<div className="text-2xl font-bold text-red-500"\>  
              {messages.filter(m \=\> m.is\_urgent).length}  
            \</div\>  
          \</div\>  
            
          \<div className="bg-gray-800 rounded-lg p-4"\>  
            \<div className="text-gray-400 text-sm mb-1"\>Taux de clic\</div\>  
            \<div className="text-2xl font-bold"\>  
              {messages.length \> 0   
                ? Math.round(messages.reduce((sum, m) \=\> sum \+ m.click\_count, 0\) / messages.length)  
                : 0  
              }%  
            \</div\>  
          \</div\>  
        \</div\>  
      \</div\>  
    \</div\>  
  );  
}

## **5\. Service de Mise à Jour Manuelle**

// netlify/functions/update-ticker-message.ts  
import { Handler } from '@netlify/functions';  
import { createClient } from '@supabase/supabase-js';

const supabase \= createClient(  
  process.env.SUPABASE\_URL\!,  
  process.env.SUPABASE\_SERVICE\_KEY\!  
);

export const handler: Handler \= async (event, context) \=\> {  
  if (event.httpMethod \!== 'POST' && event.httpMethod \!== 'PUT') {  
    return { statusCode: 405, body: 'Method Not Allowed' };  
  }

  try {  
    const { messageId, updates, userId } \= JSON.parse(event.body || '{}');

    if (\!messageId || \!updates) {  
      return {  
        statusCode: 400,  
        body: JSON.stringify({ error: 'Missing required fields' })  
      };  
    }

    // Mettre à jour le message  
    const { data, error } \= await supabase  
      .from('ticker\_messages')  
      .update({  
        ...updates,  
        updated\_at: new Date().toISOString(),  
        edited\_by: userId  
      })  
      .eq('id', messageId)  
      .select()  
      .single();

    if (error) throw error;

    // Logger l'action  
    await supabase  
      .from('ticker\_logs')  
      .insert({  
        message\_id: messageId,  
        event\_type: 'edited',  
        user\_id: userId,  
        metadata: { updates }  
      });

    return {  
      statusCode: 200,  
      body: JSON.stringify({   
        success: true,   
        message: data   
      })  
    };

  } catch (error) {  
    console.error('Error updating ticker message:', error);  
    return {  
      statusCode: 500,  
      body: JSON.stringify({ error: 'Update failed' })  
    };  
  }  
};

## **6\. Intégration sur la Page d'Accueil**

// app/page.tsx  
import NewsTicker from '@/components/ticker/NewsTicker';  
import AdSlider from '@/components/ads/AdSlider';  
// ... autres imports

export default function HomePage() {  
  return (  
    \<div className="min-h-screen bg-gray-900"\>  
      {/\* Header \*/}  
      \<Header /\>  
        
      {/\* Bandeau d'information \- Juste au-dessus des sliders publicitaires \*/}  
      \<NewsTicker /\>  
        
      {/\* Sliders publicitaires \*/}  
      \<AdSlider /\>  
        
      {/\* Contenu principal \*/}  
      \<main\>  
        {/\* ... reste du contenu \*/}  
      \</main\>  
        
      {/\* Footer \*/}  
      \<Footer /\>  
    \</div\>  
  );  
}

## **7\. Scheduler Netlify pour Auto-Update**

\# netlify.toml  
\[\[functions\]\]  
  schedule \= "\*/5 \* \* \* \*"  \# Toutes les 5 minutes  
  name \= "process-ticker-news"

## **📚 Documentation de Configuration**

### **Installation**

1. **Créer les tables Supabase** : Exécuter le SQL fourni  
2. **Configurer les variables d'environnement** :

OPENAI\_API\_KEY=your\_key  
SUPABASE\_URL=your\_url  
SUPABASE\_ANON\_KEY=your\_anon\_key  
SUPABASE\_SERVICE\_KEY=your\_service\_key

3. **Déployer les functions Netlify** :

netlify deploy \--prod

### **Configuration du Bandeau**

#### **Via l'Interface Admin**

* **URL** : `/admin/ticker`  
* **Accès** : Réservé aux administrateurs  
* **Fonctionnalités** :  
  * Créer/éditer/supprimer des messages  
  * Envoyer des urgences  
  * Configurer la vitesse et l'apparence  
  * Voir les statistiques

#### **Paramètres Disponibles**

| Paramètre | Description | Valeur par défaut |
| ----- | ----- | ----- |
| `speed` | Vitesse de défilement (px/s) | 50 |
| `max_messages` | Nombre max de messages | 20 |
| `message_duration` | Durée d'affichage | 3 heures |
| `refresh_interval` | Rafraîchissement | 5 minutes |
| `pause_on_hover` | Pause au survol | true |

### **API Endpoints**

#### **Créer un message urgent**

fetch('/.netlify/functions/send-urgent-message', {  
  method: 'POST',  
  body: JSON.stringify({  
    message: 'Message urgent',  
    duration: 86400 // 24 heures  
  })  
});

#### **Mettre à jour un message**

fetch('/.netlify/functions/update-ticker-message', {  
  method: 'PUT',  
  body: JSON.stringify({  
    messageId: 'uuid',  
    updates: {  
      reformulated\_title: 'Nouveau titre',  
      is\_active: true  
    }  
  })  
});

### **Personnalisation CSS**

/\* styles/ticker.css \*/  
.ticker-container {  
  \--ticker-bg: \#1f2937;  
  \--ticker-text: \#ffffff;  
  \--ticker-urgent: \#ef4444;  
  \--ticker-height: 48px;  
  \--ticker-speed: 50s;  
}

/\* Animation personnalisée \*/  
@keyframes ticker-scroll {  
  0% { transform: translateX(100%); }  
  100% { transform: translateX(-100%); }  
}

### **Monitoring et Analytics**

Le système track automatiquement :

* **Clics** sur chaque message  
* **Durée d'affichage**  
* **Sources populaires**  
* **Taux d'engagement**

Accessible via :

SELECT   
  source\_name,  
  COUNT(\*) as total\_messages,  
  SUM(click\_count) as total\_clicks,  
  AVG(click\_count) as avg\_clicks  
FROM ticker\_messages  
WHERE created\_at \> now() \- interval '7 days'  
GROUP BY source\_name  
ORDER BY total\_clicks DESC;

Ce système complet permet une gestion flexible et performante du bandeau d'information avec reformulation IA, gestion manuelle, et système d'urgence intégré.

