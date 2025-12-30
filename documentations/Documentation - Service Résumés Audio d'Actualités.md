# **🎙️ Documentation \- Service Résumés Audio d'Actualités**

## **🎯 Vue d'ensemble**

Développer un système de génération de résumés audio personnalisés des actualités gabonaises, avec envoi automatique via WhatsApp et gestion de crédits intégrée.

---

## **📋 Fonctionnalités principales**

### **1\. Résumé audio quotidien (Actualités du jour)**

* Génération automatique chaque matin  
* Top 5-10 articles du jour  
* Envoi WhatsApp programmé

### **2\. Résumé audio Actu++ (Articles sélectionnés)**

* User sélectionne articles spécifiques  
* Génération à la demande  
* Envoi immédiat WhatsApp

### **3\. Système de crédits**

* Consommation par génération audio  
* Intégration au Credit Manager existant

---

## **🏗️ Architecture technique**

### **Stack**

* **TTS** : Kokoro v1.0 (Replicate API) \- 82M params  
* **Résumés** : GPT-4 (ou résumés existants dans Supabase)  
* **WhatsApp** : Whapi.cloud API  
* **Storage** : Supabase Storage (fichiers audio)  
* **Queue** : BullMQ pour jobs asynchrones  
* **Cron** : Jobs programmés quotidiens

### **Flux de traitement**

Articles sélectionnés → Récupération résumés Supabase   
→ Agrégation \+ formatage GPT-4 (si besoin)   
→ Génération audio Kokoro   
→ Upload Supabase Storage   
→ Envoi WhatsApp via Whapi   
→ Débit crédits utilisateur

---

## **📊 Structure base de données**

\-- Table résumés audio générés  
CREATE TABLE audio\_summaries (  
  id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
  user\_id UUID REFERENCES profiles(id),  
    
  \-- Type de résumé  
  summary\_type TEXT NOT NULL, \-- 'daily' ou 'custom'  
    
  \-- Articles inclus  
  article\_ids UUID\[\],  
  articles\_count INTEGER,  
    
  \-- Contenu  
  text\_summary TEXT, \-- Texte lu  
  audio\_url TEXT, \-- URL fichier audio dans Storage  
  audio\_duration\_seconds INTEGER,  
  voice\_used TEXT DEFAULT 'af\_nicole',  
    
  \-- WhatsApp  
  whatsapp\_sent BOOLEAN DEFAULT false,  
  whatsapp\_sent\_at TIMESTAMP,  
  whatsapp\_phone TEXT,  
  whatsapp\_message\_id TEXT,  
    
  \-- Crédits  
  credits\_cost INTEGER,  
    
  \-- Meta  
  status TEXT DEFAULT 'pending', \-- pending, processing, completed, failed  
  error\_message TEXT,  
  created\_at TIMESTAMP DEFAULT NOW(),  
  completed\_at TIMESTAMP  
);

\-- Index pour performances  
CREATE INDEX idx\_audio\_summaries\_user ON audio\_summaries(user\_id);  
CREATE INDEX idx\_audio\_summaries\_type ON audio\_summaries(summary\_type, created\_at);

\-- Table configuration utilisateur  
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS audio\_settings JSONB DEFAULT '{  
  "daily\_summary\_enabled": false,  
  "delivery\_time": "07:00",  
  "whatsapp\_number": null,  
  "preferred\_voice": "af\_nicole",  
  "max\_articles\_daily": 10  
}'::jsonb;

\-- Table consommation crédits (enrichir existante)  
CREATE TABLE IF NOT EXISTS credit\_transactions (  
  id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
  user\_id UUID REFERENCES profiles(id),  
  amount INTEGER, \-- négatif \= débit, positif \= crédit  
  transaction\_type TEXT, \-- 'audio\_summary\_daily', 'audio\_summary\_custom'  
  reference\_id UUID, \-- ID du audio\_summary  
  balance\_after INTEGER,  
  created\_at TIMESTAMP DEFAULT NOW()  
);

---

## **🤖 Intégration APIs**

### **1\. Kokoro TTS (Replicate)**

import Replicate from "replicate";  
import { writeFile } from "fs/promises";  
import { createClient } from '@supabase/supabase-js';

const replicate \= new Replicate({  
  auth: process.env.REPLICATE\_API\_TOKEN  
});

const supabase \= createClient(  
  process.env.SUPABASE\_URL,  
  process.env.SUPABASE\_SERVICE\_ROLE\_KEY  
);

/\*\*  
 \* Génère un audio à partir d'un texte  
 \* @param {string} text \- Texte à convertir en audio  
 \* @param {string} voice \- Voix à utiliser (défaut: af\_nicole)  
 \* @returns {Promise\<{audioUrl: string, duration: number}\>}  
 \*/  
async function generateAudioSummary(text, voice \= "af\_nicole") {  
  try {  
    console.log('🎙️ Génération audio avec Kokoro...');  
      
    const input \= {  
      text: text,  
      voice: voice,  
      speed: 1.0 // Vitesse normale  
    };

    const output \= await replicate.run(  
      "jaaari/kokoro-82m:f559560eb822dc509045f3921a1921234918b91739db4bf3daab2169b71c7a13",  
      { input }  
    );

    // Télécharger le fichier audio  
    const audioBuffer \= await output.arrayBuffer();  
    const audioBlob \= Buffer.from(audioBuffer);  
      
    // Calculer durée approximative (basé sur taille fichier)  
    const durationSeconds \= Math.ceil(audioBlob.length / 16000); // \~16KB par seconde  
      
    return {  
      audioBuffer: audioBlob,  
      duration: durationSeconds,  
      fileSize: audioBlob.length  
    };

  } catch (error) {  
    console.error('❌ Erreur génération audio:', error);  
    throw new Error(\`Échec génération audio: ${error.message}\`);  
  }  
}

/\*\*  
 \* Upload audio vers Supabase Storage  
 \* @param {Buffer} audioBuffer \- Buffer du fichier audio  
 \* @param {string} userId \- ID utilisateur  
 \* @param {string} summaryId \- ID du résumé  
 \* @returns {Promise\<string\>} URL publique du fichier  
 \*/  
async function uploadAudioToStorage(audioBuffer, userId, summaryId) {  
  try {  
    const fileName \= \`${userId}/${summaryId}.wav\`;  
      
    const { data, error } \= await supabase.storage  
      .from('audio-summaries')  
      .upload(fileName, audioBuffer, {  
        contentType: 'audio/wav',  
        upsert: true  
      });

    if (error) throw error;

    // Obtenir URL publique  
    const { data: urlData } \= supabase.storage  
      .from('audio-summaries')  
      .getPublicUrl(fileName);

    return urlData.publicUrl;

  } catch (error) {  
    console.error('❌ Erreur upload audio:', error);  
    throw new Error(\`Échec upload audio: ${error.message}\`);  
  }  
}

### **2\. Préparation du texte pour audio**

/\*\*  
 \* Récupère et formate les résumés d'articles pour audio  
 \* @param {string\[\]} articleIds \- IDs des articles  
 \* @param {string} summaryType \- Type de résumé ('daily' ou 'custom')  
 \* @returns {Promise\<string\>} Texte formaté pour audio  
 \*/  
async function prepareAudioScript(articleIds, summaryType \= 'daily') {  
  try {  
    // Récupérer articles avec résumés depuis Supabase  
    const { data: articles, error } \= await supabase  
      .from('articles')  
      .select('id, title, summary, category, published\_at')  
      .in('id', articleIds)  
      .order('published\_at', { ascending: false });

    if (error) throw error;

    // Introduction  
    let script \= '';  
    if (summaryType \=== 'daily') {  
      const date \= new Date().toLocaleDateString('fr-FR', {   
        weekday: 'long',   
        day: 'numeric',   
        month: 'long'   
      });  
      script \= \`Bonjour et bienvenue dans votre résumé d'actualités Gabon 24/7 pour ce ${date}. Voici les principales informations du jour.\\n\\n\`;  
    } else {  
      script \= \`Voici le résumé audio de vos articles sélectionnés.\\n\\n\`;  
    }

    // Ajouter chaque article  
    articles.forEach((article, index) \=\> {  
      script \+= \`Article ${index \+ 1}. ${article.title}.\\n\`;  
      script \+= \`${article.summary}\\n\\n\`;  
    });

    // Conclusion  
    script \+= \`Fin de votre résumé d'actualités. Restez informé avec Gabon 24/7.\`;

    return script;

  } catch (error) {  
    console.error('❌ Erreur préparation script:', error);  
    throw new Error(\`Échec préparation script: ${error.message}\`);  
  }  
}

/\*\*  
 \* Utilise GPT-4 pour améliorer/résumer le script audio si besoin  
 \* @param {string} rawScript \- Script brut  
 \* @returns {Promise\<string\>} Script optimisé pour audio  
 \*/  
async function optimizeScriptWithGPT4(rawScript) {  
  try {  
    const response \= await fetch('https://api.openai.com/v1/chat/completions', {  
      method: 'POST',  
      headers: {  
        'Authorization': \`Bearer ${process.env.OPENAI\_API\_KEY}\`,  
        'Content-Type': 'application/json'  
      },  
      body: JSON.stringify({  
        model: 'gpt-4',  
        messages: \[{  
          role: 'system',  
          content: 'Tu es un rédacteur de bulletins d\\'information audio pour Gabon 24/7. Optimise le script pour qu\\'il soit fluide et agréable à l\\'écoute, en gardant un ton professionnel et informatif. Garde la structure mais améliore les transitions.'  
        }, {  
          role: 'user',  
          content: rawScript  
        }\],  
        max\_tokens: 1500,  
        temperature: 0.7  
      })  
    });

    const result \= await response.json();  
    return result.choices\[0\].message.content;

  } catch (error) {  
    console.error('⚠️ Erreur optimisation GPT-4, utilisation script brut:', error);  
    return rawScript; // Fallback sur script original  
  }  
}

### **3\. Envoi WhatsApp (Whapi)**

/\*\*  
 \* Envoie le résumé audio via WhatsApp  
 \* @param {string} phoneNumber \- Numéro WhatsApp (format international)  
 \* @param {string} audioUrl \- URL du fichier audio  
 \* @param {string} caption \- Message d'accompagnement  
 \* @returns {Promise\<{messageId: string}\>}  
 \*/  
async function sendAudioViaWhatsApp(phoneNumber, audioUrl, caption) {  
  try {  
    console.log('📱 Envoi WhatsApp...');

    const response \= await fetch('https://gate.whapi.cloud/messages/audio', {  
      method: 'POST',  
      headers: {  
        'Authorization': \`Bearer ${process.env.WHAPI\_TOKEN}\`,  
        'Content-Type': 'application/json'  
      },  
      body: JSON.stringify({  
        to: phoneNumber,  
        media: {  
          url: audioUrl,  
          mimetype: 'audio/wav'  
        },  
        caption: caption  
      })  
    });

    const result \= await response.json();

    if (\!response.ok) {  
      throw new Error(\`Whapi error: ${result.message || 'Unknown error'}\`);  
    }

    return {  
      messageId: result.message\_id,  
      status: result.status  
    };

  } catch (error) {  
    console.error('❌ Erreur envoi WhatsApp:', error);  
    throw new Error(\`Échec envoi WhatsApp: ${error.message}\`);  
  }  
}

---

## **🔄 Service principal**

/\*\*  
 \* Service complet de génération et envoi de résumé audio  
 \*/  
class AudioSummaryService {  
    
  /\*\*  
   \* Génère un résumé audio quotidien pour un utilisateur  
   \* @param {string} userId \- ID utilisateur  
   \*/  
  async generateDailySummary(userId) {  
    let summaryRecord \= null;  
      
    try {  
      console.log(\`🎙️ Génération résumé quotidien pour user ${userId}\`);

      // 1\. Vérifier configuration utilisateur  
      const { data: userProfile } \= await supabase  
        .from('profiles')  
        .select('audio\_settings, credits\_balance')  
        .eq('id', userId)  
        .single();

      if (\!userProfile.audio\_settings?.daily\_summary\_enabled) {  
        console.log('⏭️ Résumé quotidien désactivé pour cet utilisateur');  
        return;  
      }

      // 2\. Vérifier crédits suffisants  
      const requiredCredits \= 5; // Coût résumé quotidien  
      if (userProfile.credits\_balance \< requiredCredits) {  
        console.log('❌ Crédits insuffisants');  
        throw new Error('Crédits insuffisants pour générer le résumé audio');  
      }

      // 3\. Récupérer les articles du jour  
      const { data: todayArticles } \= await supabase  
        .from('articles')  
        .select('id, title, summary, importance\_score')  
        .gte('published\_at', new Date().setHours(0, 0, 0, 0))  
        .order('importance\_score', { ascending: false })  
        .limit(userProfile.audio\_settings.max\_articles\_daily || 10);

      if (\!todayArticles?.length) {  
        console.log('ℹ️ Aucun article disponible aujourd\\'hui');  
        return;  
      }

      const articleIds \= todayArticles.map(a \=\> a.id);

      // 4\. Créer enregistrement résumé audio  
      const { data: summary, error: summaryError } \= await supabase  
        .from('audio\_summaries')  
        .insert({  
          user\_id: userId,  
          summary\_type: 'daily',  
          article\_ids: articleIds,  
          articles\_count: articleIds.length,  
          status: 'processing',  
          credits\_cost: requiredCredits,  
          whatsapp\_phone: userProfile.audio\_settings.whatsapp\_number  
        })  
        .select()  
        .single();

      if (summaryError) throw summaryError;  
      summaryRecord \= summary;

      // 5\. Préparer script audio  
      let script \= await prepareAudioScript(articleIds, 'daily');  
        
      // Optionnel: optimiser avec GPT-4  
      script \= await optimizeScriptWithGPT4(script);

      // 6\. Générer audio avec Kokoro  
      const { audioBuffer, duration } \= await generateAudioSummary(  
        script,  
        userProfile.audio\_settings.preferred\_voice || 'af\_nicole'  
      );

      // 7\. Upload vers Supabase Storage  
      const audioUrl \= await uploadAudioToStorage(audioBuffer, userId, summary.id);

      // 8\. Envoyer via WhatsApp  
      let whatsappResult \= null;  
      if (userProfile.audio\_settings.whatsapp\_number) {  
        const caption \= \`🎙️ Votre résumé d'actualités Gabon 24/7 du ${new Date().toLocaleDateString('fr-FR')}\`;  
        whatsappResult \= await sendAudioViaWhatsApp(  
          userProfile.audio\_settings.whatsapp\_number,  
          audioUrl,  
          caption  
        );  
      }

      // 9\. Mettre à jour résumé audio  
      await supabase  
        .from('audio\_summaries')  
        .update({  
          text\_summary: script,  
          audio\_url: audioUrl,  
          audio\_duration\_seconds: duration,  
          whatsapp\_sent: \!\!whatsappResult,  
          whatsapp\_sent\_at: whatsappResult ? new Date().toISOString() : null,  
          whatsapp\_message\_id: whatsappResult?.messageId,  
          status: 'completed',  
          completed\_at: new Date().toISOString()  
        })  
        .eq('id', summary.id);

      // 10\. Débiter crédits  
      await this.debitCredits(userId, requiredCredits, summary.id, 'audio\_summary\_daily');

      console.log('✅ Résumé audio quotidien généré et envoyé avec succès');  
      return summary;

    } catch (error) {  
      console.error('❌ Erreur génération résumé quotidien:', error);

      // Mettre à jour statut erreur si enregistrement créé  
      if (summaryRecord) {  
        await supabase  
          .from('audio\_summaries')  
          .update({  
            status: 'failed',  
            error\_message: error.message  
          })  
          .eq('id', summaryRecord.id);  
      }

      throw error;  
    }  
  }

  /\*\*  
   \* Génère un résumé audio personnalisé (Actu++)  
   \* @param {string} userId \- ID utilisateur  
   \* @param {string\[\]} articleIds \- Articles sélectionnés  
   \*/  
  async generateCustomSummary(userId, articleIds) {  
    let summaryRecord \= null;

    try {  
      console.log(\`🎙️ Génération résumé personnalisé pour user ${userId}\`);

      // Validation  
      if (\!articleIds || articleIds.length \=== 0\) {  
        throw new Error('Aucun article sélectionné');  
      }

      if (articleIds.length \> 20\) {  
        throw new Error('Maximum 20 articles par résumé personnalisé');  
      }

      // 1\. Vérifier crédits  
      const { data: userProfile } \= await supabase  
        .from('profiles')  
        .select('credits\_balance, audio\_settings')  
        .eq('id', userId)  
        .single();

      // Calcul coût (2 crédits \+ 0.5 par article supplémentaire après 5\)  
      const baseCredits \= 2;  
      const extraArticles \= Math.max(0, articleIds.length \- 5);  
      const requiredCredits \= baseCredits \+ (extraArticles \* 0.5);

      if (userProfile.credits\_balance \< requiredCredits) {  
        throw new Error('Crédits insuffisants');  
      }

      // 2\. Créer enregistrement  
      const { data: summary } \= await supabase  
        .from('audio\_summaries')  
        .insert({  
          user\_id: userId,  
          summary\_type: 'custom',  
          article\_ids: articleIds,  
          articles\_count: articleIds.length,  
          status: 'processing',  
          credits\_cost: requiredCredits,  
          whatsapp\_phone: userProfile.audio\_settings?.whatsapp\_number  
        })  
        .select()  
        .single();

      summaryRecord \= summary;

      // 3-9. Même processus que daily summary  
      let script \= await prepareAudioScript(articleIds, 'custom');  
      const { audioBuffer, duration } \= await generateAudioSummary(script);  
      const audioUrl \= await uploadAudioToStorage(audioBuffer, userId, summary.id);

      let whatsappResult \= null;  
      if (userProfile.audio\_settings?.whatsapp\_number) {  
        const caption \= \`🎙️ Votre résumé personnalisé Gabon 24/7 (${articleIds.length} articles)\`;  
        whatsappResult \= await sendAudioViaWhatsApp(  
          userProfile.audio\_settings.whatsapp\_number,  
          audioUrl,  
          caption  
        );  
      }

      await supabase  
        .from('audio\_summaries')  
        .update({  
          text\_summary: script,  
          audio\_url: audioUrl,  
          audio\_duration\_seconds: duration,  
          whatsapp\_sent: \!\!whatsappResult,  
          whatsapp\_sent\_at: whatsappResult ? new Date().toISOString() : null,  
          whatsapp\_message\_id: whatsappResult?.messageId,  
          status: 'completed',  
          completed\_at: new Date().toISOString()  
        })  
        .eq('id', summary.id);

      await this.debitCredits(userId, requiredCredits, summary.id, 'audio\_summary\_custom');

      console.log('✅ Résumé audio personnalisé généré');  
      return summary;

    } catch (error) {  
      console.error('❌ Erreur résumé personnalisé:', error);  
        
      if (summaryRecord) {  
        await supabase  
          .from('audio\_summaries')  
          .update({ status: 'failed', error\_message: error.message })  
          .eq('id', summaryRecord.id);  
      }

      throw error;  
    }  
  }

  /\*\*  
   \* Débite les crédits utilisateur  
   \*/  
  async debitCredits(userId, amount, referenceId, transactionType) {  
    try {  
      // 1\. Récupérer solde actuel  
      const { data: profile } \= await supabase  
        .from('profiles')  
        .select('credits\_balance')  
        .eq('id', userId)  
        .single();

      const newBalance \= profile.credits\_balance \- amount;

      // 2\. Mettre à jour solde  
      await supabase  
        .from('profiles')  
        .update({ credits\_balance: newBalance })  
        .eq('id', userId);

      // 3\. Enregistrer transaction  
      await supabase  
        .from('credit\_transactions')  
        .insert({  
          user\_id: userId,  
          amount: \-amount,  
          transaction\_type: transactionType,  
          reference\_id: referenceId,  
          balance\_after: newBalance  
        });

      console.log(\`💳 ${amount} crédits débités \- Nouveau solde: ${newBalance}\`);

    } catch (error) {  
      console.error('❌ Erreur débit crédits:', error);  
      throw error;  
    }  
  }  
}

// Export instance  
export const audioSummaryService \= new AudioSummaryService();

---

## **⚡ APIs Routes**

import express from 'express';  
import { audioSummaryService } from './services/audioSummaryService';  
import { authenticateUser } from './middleware/auth';

const router \= express.Router();

/\*\*  
 \* POST /api/audio-summary/custom  
 \* Génère résumé audio personnalisé  
 \*/  
router.post('/custom', authenticateUser, async (req, res) \=\> {  
  try {  
    const { articleIds } \= req.body;  
    const userId \= req.user.id;

    if (\!articleIds || \!Array.isArray(articleIds)) {  
      return res.status(400).json({ error: 'articleIds requis (array)' });  
    }

    const summary \= await audioSummaryService.generateCustomSummary(userId, articleIds);

    res.json({  
      success: true,  
      summaryId: summary.id,  
      audioUrl: summary.audio\_url,  
      creditsUsed: summary.credits\_cost,  
      whatsappSent: summary.whatsapp\_sent  
    });

  } catch (error) {  
    console.error('Erreur API custom summary:', error);  
    res.status(500).json({ error: error.message });  
  }  
});

/\*\*  
 \* GET /api/audio-summary/history  
 \* Historique résumés utilisateur  
 \*/  
router.get('/history', authenticateUser, async (req, res) \=\> {  
  try {  
    const { data: summaries } \= await supabase  
      .from('audio\_summaries')  
      .select('\*')  
      .eq('user\_id', req.user.id)  
      .order('created\_at', { ascending: false })  
      .limit(50);

    res.json({ summaries });

  } catch (error) {  
    res.status(500).json({ error: error.message });  
  }  
});

/\*\*  
 \* GET /api/audio-summary/:id  
 \* Détail résumé spécifique  
 \*/  
router.get('/:id', authenticateUser, async (req, res) \=\> {  
  try {  
    const { data: summary } \= await supabase  
      .from('audio\_summaries')  
      .select('\*')  
      .eq('id', req.params.id)  
      .eq('user\_id', req.user.id)  
      .single();

    if (\!summary) {  
      return res.status(404).json({ error: 'Résumé non trouvé' });  
    }

    res.json({ summary });

  } catch (error) {  
    res.status(500).json({ error: error.message });  
  }  
});

/\*\*  
 \* PUT /api/audio-summary/settings  
 \* Configuration résumés quotidiens  
 \*/  
router.put('/settings', authenticateUser, async (req, res) \=\> {  
  try {  
    const { dailyEnabled, deliveryTime, whatsappNumber, preferredVoice } \= req.body;

    const audioSettings \= {  
      daily\_summary\_enabled: dailyEnabled,  
      delivery\_time: deliveryTime || '07:00',  
      whatsapp\_number: whatsappNumber,  
      preferred\_voice: preferredVoice || 'af\_nicole',  
      max\_articles\_daily: 10  
    };

    await supabase  
      .from('profiles')  
      .update({ audio\_settings: audioSettings })  
      .eq('id', req.user.id);

    res.json({ success: true, settings: audioSettings });

  } catch (error) {  
    res.status(500).json({ error: error.message });  
  }  
});

export default router;

---

## **⏰ Cron Job quotidien**

import cron from 'node-cron';  
import { audioSummaryService } from './services/audioSummaryService';

/\*\*  
 \* Job quotidien \- génération résumés audio  
 \* S'exécute chaque jour à 06:00  
 \*/  
cron.schedule('0 6 \* \* \*', async () \=\> {  
  console.log('🕐 Démarrage génération résumés audio quotidiens...');

  try {  
    // Récupérer utilisateurs avec résumé quotidien activé  
    const { data: users } \= await supabase  
      .from('profiles')  
      .select('id, audio\_settings')  
      .not('audio\_settings-\>daily\_summary\_enabled', 'is', null)  
      .gte('credits\_balance', 5); // Au moins 5 crédits

    const enabledUsers \= users.filter(  
      u \=\> u.audio\_settings?.daily\_summary\_enabled \=== true  
    );

    console.log(\`📊 ${enabledUsers.length} utilisateurs éligibles\`);

    // Générer résumés en parallèle (max 5 à la fois)  
    const chunks \= \[\];  
    for (let i \= 0; i \< enabledUsers.length; i \+= 5\) {  
      chunks.push(enabledUsers.slice(i, i \+ 5));  
    }

    for (const chunk of chunks) {  
      await Promise.all(  
        chunk.map(user \=\>   
          audioSummaryService.generateDailySummary(user.id)  
            .catch(err \=\> console.error(\`Erreur user ${user.id}:\`, err))  
        )  
      );  
    }

    console.log('✅ Génération résumés quotidiens terminée');

  } catch (error) {  
    console.error('❌ Erreur cron résumés quotidiens:', error);  
  }  
});

---

## **💰 Tarification crédits**

const AUDIO\_SUMMARY\_PRICING \= {  
  // Résumé quotidien  
  daily\_summary: 5, // crédits  
    
  // Résumé personnalisé  
  custom\_base: 2, // jusqu'à 5 articles  
  custom\_extra\_article: 0.5, // par article supplémentaire  
    
  // Calcul dynamique  
  calculateCustomCost: (articleCount) \=\> {  
    const base \= AUDIO\_SUMMARY\_PRICING.custom\_base;  
    const extra \= Math.max(0, articleCount \- 5);  
    return base \+ (extra \* AUDIO\_SUMMARY\_PRICING.custom\_extra\_article);  
  }  
};

---

## **📱 Interface Frontend (exemples)**

### **Page configuration**

const AudioSettingsPage \= () \=\> {  
  const \[settings, setSettings\] \= useState({  
    dailyEnabled: false,  
    deliveryTime: '07:00',  
    whatsappNumber: '',  
    preferredVoice: 'af\_nicole'  
  });

  const handleSaveSettings \= async () \=\> {  
    const response \= await fetch('/api/audio-summary/settings', {  
      method: 'PUT',  
      headers: { 'Content-Type': 'application/json' },  
      body: JSON.stringify(settings)  
    });  
    // ...  
  };

  return (  
    \<div className="audio-settings"\>  
      \<h2\>🎙️ Résumés Audio\</h2\>  
        
      \<div className="setting-item"\>  
        \<label\>  
          \<input   
            type="checkbox"  
            checked={settings.dailyEnabled}  
            onChange={(e) \=\> setSettings({...settings, dailyEnabled: e.target.checked})}  
          /\>  
          Activer résumé quotidien (5 crédits/jour)  
        \</label\>  
      \</div\>

      {settings.dailyEnabled && (  
        \<\>  
          \<div className="setting-item"\>  
            \<label\>Heure de livraison\</label\>  
            \<input   
              type="time"  
              value={settings.deliveryTime}  
              onChange={(e) \=\> setSettings({...settings, deliveryTime: e.target.value})}  
            /\>  
          \</div\>

          \<div className="setting-item"\>  
            \<label\>Numéro WhatsApp\</label\>  
            \<input   
              type="tel"  
              placeholder="+241 XX XX XX XX"  
              value={settings.whatsappNumber}  
              onChange={(e) \=\> setSettings({...settings, whatsappNumber: e.target.value})}  
            /\>  
          \</div\>  
        \</\>  
      )}

      \<button onClick={handleSaveSettings}\>Sauvegarder\</button\>  
    \</div\>  
  );  
};

### **Bouton génération personnalisée**

const ArticlesList \= ({ articles, selectedIds, onSelectionsChange }) \=\> {  
  const \[generating, setGenerating\] \= useState(false);

  const handleGenerateAudio \= async () \=\> {  
    if (selectedIds.length \=== 0\) {  
      alert('Sélectionnez au moins un article');  
      return;  
    }

    setGenerating(true);  
    try {  
      const response \= await fetch('/api/audio-summary/custom', {  
        method: 'POST',  
        headers: { 'Content-Type': 'application/json' },  
        body: JSON.stringify({ articleIds: selectedIds })  
      });

      const result \= await response.json();

      if (result.success) {  
        alert(\`✅ Résumé audio généré et envoyé via WhatsApp\!\\n${result.creditsUsed} crédits utilisés\`);  
        // Optionnel: écouter directement  
        window.open(result.audioUrl, '\_blank');  
      }  
    } catch (error) {  
      alert('❌ Erreur: ' \+ error.message);  
    } finally {  
      setGenerating(false);  
    }  
  };

  const cost \= AUDIO\_SUMMARY\_PRICING.calculateCustomCost(selectedIds.length);

  return (  
    \<div className="articles-list"\>  
      \<div className="articles-header"\>  
        \<h2\>Articles disponibles\</h2\>  
        \<div className="audio-actions"\>  
          \<span className="selected-count"\>  
            {selectedIds.length} article{selectedIds.length \> 1 ? 's' : ''} sélectionné{selectedIds.length \> 1 ? 's' : ''}  
          \</span\>  
          \<button   
            className="btn-generate-audio"  
            onClick={handleGenerateAudio}  
            disabled={generating || selectedIds.length \=== 0}  
          \>  
            {generating ? '🔄 Génération...' : \`🎙️ Générer résumé audio (${cost} crédits)\`}  
          \</button\>  
        \</div\>  
      \</div\>

      \<div className="articles-grid"\>  
        {articles.map(article \=\> (  
          \<div key={article.id} className="article-card"\>  
            \<input   
              type="checkbox"  
              checked={selectedIds.includes(article.id)}  
              onChange={(e) \=\> {  
                if (e.target.checked) {  
                  onSelectionsChange(\[...selectedIds, article.id\]);  
                } else {  
                  onSelectionsChange(selectedIds.filter(id \=\> id \!== article.id));  
                }  
              }}  
            /\>  
            \<h3\>{article.title}\</h3\>  
            \<p\>{article.summary}\</p\>  
          \</div\>  
        ))}  
      \</div\>  
    \</div\>  
  );  
};

### **Historique des résumés audio**

const AudioSummariesHistory \= () \=\> {  
  const \[summaries, setSummaries\] \= useState(\[\]);  
  const \[loading, setLoading\] \= useState(true);

  useEffect(() \=\> {  
    fetchHistory();  
  }, \[\]);

  const fetchHistory \= async () \=\> {  
    try {  
      const response \= await fetch('/api/audio-summary/history');  
      const data \= await response.json();  
      setSummaries(data.summaries);  
    } catch (error) {  
      console.error('Erreur chargement historique:', error);  
    } finally {  
      setLoading(false);  
    }  
  };

  if (loading) return \<div\>Chargement...\</div\>;

  return (  
    \<div className="audio-history"\>  
      \<h2\>📚 Historique de vos résumés audio\</h2\>  
        
      \<div className="summaries-list"\>  
        {summaries.map(summary \=\> (  
          \<div key={summary.id} className="summary-card"\>  
            \<div className="summary-header"\>  
              \<div className="summary-type"\>  
                {summary.summary\_type \=== 'daily' ? '📅 Quotidien' : '🎯 Personnalisé'}  
              \</div\>  
              \<div className="summary-date"\>  
                {new Date(summary.created\_at).toLocaleDateString('fr-FR', {  
                  day: 'numeric',  
                  month: 'long',  
                  year: 'numeric',  
                  hour: '2-digit',  
                  minute: '2-digit'  
                })}  
              \</div\>  
            \</div\>

            \<div className="summary-info"\>  
              \<span className="articles-count"\>  
                📰 {summary.articles\_count} article{summary.articles\_count \> 1 ? 's' : ''}  
              \</span\>  
              \<span className="duration"\>  
                ⏱️ {Math.floor(summary.audio\_duration\_seconds / 60)}min {summary.audio\_duration\_seconds % 60}s  
              \</span\>  
              \<span className="credits"\>  
                💳 {summary.credits\_cost} crédits  
              \</span\>  
            \</div\>

            \<div className="summary-status"\>  
              {summary.status \=== 'completed' && (  
                \<span className="status-completed"\>✅ Complété\</span\>  
              )}  
              {summary.status \=== 'processing' && (  
                \<span className="status-processing"\>🔄 En cours...\</span\>  
              )}  
              {summary.status \=== 'failed' && (  
                \<span className="status-failed"\>❌ Échec\</span\>  
              )}  
                
              {summary.whatsapp\_sent && (  
                \<span className="whatsapp-sent"\>📱 Envoyé WhatsApp\</span\>  
              )}  
            \</div\>

            {summary.status \=== 'completed' && (  
              \<div className="summary-actions"\>  
                \<button   
                  className="btn-play"  
                  onClick={() \=\> window.open(summary.audio\_url, '\_blank')}  
                \>  
                  ▶️ Écouter  
                \</button\>  
                \<button   
                  className="btn-download"  
                  onClick={() \=\> {  
                    const a \= document.createElement('a');  
                    a.href \= summary.audio\_url;  
                    a.download \= \`resume-${summary.id}.wav\`;  
                    a.click();  
                  }}  
                \>  
                  📥 Télécharger  
                \</button\>  
                \<button   
                  className="btn-resend"  
                  onClick={() \=\> resendToWhatsApp(summary.id)}  
                \>  
                  🔄 Renvoyer WhatsApp  
                \</button\>  
              \</div\>  
            )}

            {summary.error\_message && (  
              \<div className="error-message"\>  
                ⚠️ {summary.error\_message}  
              \</div\>  
            )}  
          \</div\>  
        ))}  
      \</div\>  
    \</div\>  
  );  
};

---

## **🎨 Styles CSS**

/\* Configuration audio \*/  
.audio-settings {  
  max-width: 800px;  
  margin: 0 auto;  
  padding: 2rem;  
}

.setting-item {  
  margin-bottom: 1.5rem;  
  padding: 1rem;  
  background: \#f8f9fa;  
  border-radius: 8px;  
}

.setting-item label {  
  display: flex;  
  align-items: center;  
  gap: 0.5rem;  
  font-weight: 500;  
}

.setting-item input\[type="checkbox"\] {  
  width: 20px;  
  height: 20px;  
  cursor: pointer;  
}

.setting-item input\[type="time"\],  
.setting-item input\[type="tel"\] {  
  width: 100%;  
  padding: 0.5rem;  
  margin-top: 0.5rem;  
  border: 1px solid \#ddd;  
  border-radius: 4px;  
  font-size: 1rem;  
}

/\* Liste articles avec sélection \*/  
.articles-header {  
  display: flex;  
  justify-content: space-between;  
  align-items: center;  
  margin-bottom: 2rem;  
  padding: 1rem;  
  background: linear-gradient(135deg, \#ff8c00, \#ff7700);  
  color: white;  
  border-radius: 12px;  
}

.audio-actions {  
  display: flex;  
  align-items: center;  
  gap: 1rem;  
}

.selected-count {  
  font-weight: 600;  
  background: rgba(255,255,255,0.2);  
  padding: 0.5rem 1rem;  
  border-radius: 20px;  
}

.btn-generate-audio {  
  padding: 0.75rem 1.5rem;  
  background: white;  
  color: \#ff8c00;  
  border: none;  
  border-radius: 50px;  
  font-weight: 600;  
  cursor: pointer;  
  transition: all 0.3s ease;  
}

.btn-generate-audio:hover:not(:disabled) {  
  transform: translateY(-2px);  
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);  
}

.btn-generate-audio:disabled {  
  opacity: 0.5;  
  cursor: not-allowed;  
}

/\* Cards articles avec checkbox \*/  
.article-card {  
  position: relative;  
  padding: 1rem;  
  padding-left: 3rem;  
  background: white;  
  border: 2px solid \#e5e5e5;  
  border-radius: 12px;  
  transition: all 0.3s ease;  
}

.article-card input\[type="checkbox"\] {  
  position: absolute;  
  left: 1rem;  
  top: 1rem;  
  width: 20px;  
  height: 20px;  
  cursor: pointer;  
}

.article-card:has(input:checked) {  
  border-color: \#ff8c00;  
  background: \#fff5f0;  
}

/\* Historique résumés \*/  
.audio-history {  
  max-width: 1200px;  
  margin: 0 auto;  
  padding: 2rem;  
}

.summaries-list {  
  display: grid;  
  gap: 1.5rem;  
}

.summary-card {  
  background: white;  
  border: 1px solid \#e5e5e5;  
  border-radius: 12px;  
  padding: 1.5rem;  
  transition: all 0.3s ease;  
}

.summary-card:hover {  
  box-shadow: 0 4px 12px rgba(255, 140, 0, 0.1);  
  border-color: \#ff8c00;  
}

.summary-header {  
  display: flex;  
  justify-content: space-between;  
  align-items: center;  
  margin-bottom: 1rem;  
  padding-bottom: 1rem;  
  border-bottom: 1px solid \#e5e5e5;  
}

.summary-type {  
  font-size: 1.1rem;  
  font-weight: 600;  
  color: \#ff8c00;  
}

.summary-date {  
  color: \#666;  
  font-size: 0.9rem;  
}

.summary-info {  
  display: flex;  
  gap: 1.5rem;  
  margin-bottom: 1rem;  
  flex-wrap: wrap;  
}

.summary-info span {  
  padding: 0.5rem 1rem;  
  background: \#f8f9fa;  
  border-radius: 20px;  
  font-size: 0.9rem;  
}

.summary-status {  
  display: flex;  
  gap: 0.5rem;  
  margin-bottom: 1rem;  
}

.status-completed {  
  color: \#00cc66;  
  font-weight: 600;  
}

.status-processing {  
  color: \#ff8c00;  
  font-weight: 600;  
}

.status-failed {  
  color: \#dc3545;  
  font-weight: 600;  
}

.whatsapp-sent {  
  color: \#25D366;  
  font-weight: 600;  
}

.summary-actions {  
  display: flex;  
  gap: 0.5rem;  
  flex-wrap: wrap;  
}

.summary-actions button {  
  padding: 0.5rem 1rem;  
  border: 1px solid \#ddd;  
  border-radius: 6px;  
  background: white;  
  cursor: pointer;  
  transition: all 0.2s ease;  
}

.summary-actions button:hover {  
  background: \#f8f9fa;  
  border-color: \#ff8c00;  
}

.btn-play {  
  color: \#ff8c00;  
  font-weight: 600;  
}

.error-message {  
  margin-top: 1rem;  
  padding: 0.75rem;  
  background: \#fff3cd;  
  border: 1px solid \#ffc107;  
  border-radius: 6px;  
  color: \#856404;  
}

/\* Responsive \*/  
@media (max-width: 768px) {  
  .articles-header {  
    flex-direction: column;  
    gap: 1rem;  
  }

  .audio-actions {  
    flex-direction: column;  
    width: 100%;  
  }

  .btn-generate-audio {  
    width: 100%;  
  }

  .summary-header {  
    flex-direction: column;  
    align-items: flex-start;  
    gap: 0.5rem;  
  }

  .summary-info {  
    flex-direction: column;  
    gap: 0.5rem;  
  }  
}

---

## **🔧 Variables d'environnement**

\# .env  
\# Replicate (Kokoro TTS)  
REPLICATE\_API\_TOKEN=r8\_xxx

\# OpenAI (GPT-4 pour optimisation scripts)  
OPENAI\_API\_KEY=sk-xxx

\# Whapi (WhatsApp)  
WHAPI\_TOKEN=xxx

\# Supabase  
SUPABASE\_URL=https://xxx.supabase.co  
SUPABASE\_SERVICE\_ROLE\_KEY=xxx

\# Configuration audio  
AUDIO\_STORAGE\_BUCKET=audio-summaries  
MAX\_AUDIO\_DURATION\_SECONDS=600  
DEFAULT\_VOICE=af\_nicole

---

## **📦 Installation et déploiement**

### **1\. Installer dépendances**

npm install replicate @supabase/supabase-js node-cron express

### **2\. Créer bucket Supabase Storage**

\-- Dans Supabase Dashboard \> Storage  
\-- Créer bucket "audio-summaries" (public)

\-- Politique d'accès  
CREATE POLICY "Les utilisateurs peuvent lire leurs audios"  
ON storage.objects FOR SELECT  
USING (bucket\_id \= 'audio-summaries' AND auth.uid()::text \= (storage.foldername(name))\[1\]);

CREATE POLICY "Service role peut tout faire"  
ON storage.objects FOR ALL  
USING (bucket\_id \= 'audio-summaries');

### **3\. Initialiser tables**

\# Exécuter les scripts SQL de création de tables  
psql $DATABASE\_URL \< migrations/audio\_summaries.sql

### **4\. Configurer cron job**

// server.js  
import './jobs/dailyAudioSummaries.js';

### **5\. Tester en local**

\# Test génération personnalisée  
curl \-X POST http://localhost:3000/api/audio-summary/custom \\  
  \-H "Content-Type: application/json" \\  
  \-H "Authorization: Bearer YOUR\_TOKEN" \\  
  \-d '{"articleIds": \["uuid1", "uuid2"\]}'

---

## **🎯 Checklist de déploiement**

### **Backend**

* \[ \] Variables d'environnement configurées  
* \[ \] Tables Supabase créées  
* \[ \] Bucket Storage créé et configuré  
* \[ \] API Replicate testée  
* \[ \] API Whapi testée  
* \[ \] Cron job configuré  
* \[ \] Système de crédits intégré

### **Frontend**

* \[ \] Page configuration audio  
* \[ \] Bouton génération personnalisée  
* \[ \] Historique résumés audio  
* \[ \] Affichage coût en crédits  
* \[ \] Player audio intégré  
* \[ \] Notifications WhatsApp

### **Tests**

* \[ \] Génération quotidienne automatique  
* \[ \] Génération personnalisée à la demande  
* \[ \] Envoi WhatsApp  
* \[ \] Débit crédits correct  
* \[ \] Gestion erreurs API  
* \[ \] Performance (temps génération)

---

## **📊 Monitoring et métriques**

// Métriques à suivre  
const AUDIO\_METRICS \= {  
  // Performance  
  average\_generation\_time: 'Temps moyen génération (secondes)',  
  success\_rate: 'Taux de succès génération (%)',  
    
  // Business  
  daily\_summaries\_sent: 'Résumés quotidiens envoyés/jour',  
  custom\_summaries\_generated: 'Résumés personnalisés/jour',  
  credits\_consumed: 'Crédits consommés pour audio/jour',  
    
  // Qualité  
  whatsapp\_delivery\_rate: 'Taux livraison WhatsApp (%)',  
  user\_satisfaction: 'Note satisfaction (si collectée)',  
    
  // Technique  
  replicate\_api\_errors: 'Erreurs API Replicate',  
  whapi\_errors: 'Erreurs API Whapi',  
  storage\_usage: 'Espace Storage utilisé (MB)'  
};

---

## **🚨 Gestion erreurs et limites**

### **Rate limits**

const RATE\_LIMITS \= {  
  replicate: {  
    requests\_per\_minute: 60,  
    concurrent\_requests: 5  
  },  
  whapi: {  
    messages\_per\_hour: 100  
  }  
};

### **Retry logic**

async function generateWithRetry(text, voice, maxRetries \= 3\) {  
  for (let i \= 0; i \< maxRetries; i++) {  
    try {  
      return await generateAudioSummary(text, voice);  
    } catch (error) {  
      if (i \=== maxRetries \- 1\) throw error;  
      console.log(\`Tentative ${i \+ 1} échouée, retry dans 5s...\`);  
      await new Promise(resolve \=\> setTimeout(resolve, 5000));  
    }  
  }  
}

---

## **💡 Améliorations futures**

### **Court terme**

* \[ \] Support voix masculines/féminines multiples  
* \[ \] Vitesse de lecture ajustable  
* \[ \] Transcription audio pour accessibilité  
* \[ \] Partage direct sur réseaux sociaux

### **Moyen terme**

* \[ \] Playlist audio personnalisée  
* \[ \] Podcasts thématiques automatiques  
* \[ \] Integration Spotify/Apple Podcasts  
* \[ \] Résumés audio en langues locales (Fang, etc.)

### **Long terme**

* \[ \] IA vocale clonée pour présentateurs  
* \[ \] Format vidéo avec sous-titres  
* \[ \] Radio Gabon 24/7 en direct  
* \[ \] Sponsoring audio publicitaire

---

## **📞 Support et ressources**

### **Documentation APIs**

* **Replicate Kokoro**: https://replicate.com/jaaari/kokoro-82m  
* **Whapi**: https://whapi.cloud/docs  
* **OpenAI GPT-4**: https://platform.openai.com/docs  
* **Supabase Storage**: https://supabase.com/docs/guides/storage

/\* Player audio modal \*/ .audio-player-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.8); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(8px); }

.audio-player-modal { background: white; border-radius: 24px; width: 90%; max-width: 600px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); animation: modalSlideIn 0.3s ease-out; }

@keyframes modalSlideIn { from { opacity: 0; transform: translateY(-30px); } to { opacity: 1; transform: translateY(0); } }

.modal-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 2rem; border-bottom: 1px solid \#e5e5e5; background: linear-gradient(135deg, \#ff8c00, \#ff7700); color: white; border-radius: 24px 24px 0 0; }

.header-content { display: flex; gap: 1rem; align-items: center; }

.audio-icon { font-size: 3rem; animation: pulse 2s infinite; }

@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }

.header-text h3 { margin: 0; font-size: 1.5rem; }

.header-text p { margin: 0.5rem 0 0 0; opacity: 0.9; font-size: 0.9rem; }

.btn-close { background: rgba(255, 255, 255, 0.2); border: none; width: 40px; height: 40px; border-radius: 50%; color: white; font-size: 1.5rem; cursor: pointer; transition: all 0.2s ease; }

.btn-close:hover { background: rgba(255, 255, 255, 0.3); transform: rotate(90deg); }

.player-controls { padding: 2rem; }

/\* Waveform visuel \*/ .audio-waveform { height: 80px; background: linear-gradient(to right, \#f0f0f0, \#e0e0e0); border-radius: 12px; margin-bottom: 1.5rem; position: relative; overflow: hidden; }

.waveform-progress { height: 100%; background: linear-gradient(135deg, \#ff8c00, \#ff7700); transition: width 0.1s linear; position: relative; }

.waveform-progress::after { content: ''; position: absolute; right: 0; top: 0; bottom: 0; width: 3px; background: white; box-shadow: 0 0 10px rgba(255, 140, 0, 0.8); }

/\* Timeline \*/ .timeline { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }

.time-current, .time-duration { font-size: 0.9rem; color: \#666; font-weight: 600; min-width: 45px; }

.timeline-slider { flex: 1; height: 6px; \-webkit-appearance: none; appearance: none; background: \#e5e5e5; border-radius: 3px; outline: none; cursor: pointer; }

.timeline-slider::-webkit-slider-thumb { \-webkit-appearance: none; appearance: none; width: 18px; height: 18px; background: \#ff8c00; border-radius: 50%; cursor: pointer; box-shadow: 0 2px 8px rgba(255, 140, 0, 0.4); transition: transform 0.2s ease; }

.timeline-slider::-webkit-slider-thumb:hover { transform: scale(1.2); }

.timeline-slider::-moz-range-thumb { width: 18px; height: 18px; background: \#ff8c00; border-radius: 50%; border: none; cursor: pointer; box-shadow: 0 2px 8px rgba(255, 140, 0, 0.4); }

/\* Contrôles de lecture \*/ .playback-controls { display: flex; justify-content: center; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }

.playback-controls button { background: white; border: 2px solid \#e5e5e5; border-radius: 50px; padding: 0.75rem 1.5rem; font-size: 1rem; cursor: pointer; transition: all 0.2s ease; font-weight: 600; }

.playback-controls button:hover { border-color: \#ff8c00; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(255, 140, 0, 0.2); }

.btn-play-pause { width: 70px; height: 70px; background: linear-gradient(135deg, \#ff8c00, \#ff7700) \!important; border: none \!important; color: white; font-size: 1.8rem; padding: 0 \!important; box-shadow: 0 4px 16px rgba(255, 140, 0, 0.4); }

.btn-play-pause:hover { transform: scale(1.1); }

.btn-speed { min-width: 60px; }

/\* Actions supplémentaires \*/ .player-actions { display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap; padding-top: 1rem; border-top: 1px solid \#e5e5e5; }

.player-actions button { background: \#f8f9fa; border: 1px solid \#e5e5e5; border-radius: 8px; padding: 0.75rem 1.25rem; cursor: pointer; transition: all 0.2s ease; font-weight: 500; }

.player-actions button:hover { background: \#ff8c00; color: white; border-color: \#ff8c00; }

.whatsapp-status { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.25rem; background: \#d4edda; color: \#155724; border-radius: 8px; font-weight: 500; }

/\* Transcription \*/ .audio-transcript { padding: 2rem; background: \#f8f9fa; border-radius: 0 0 24px 24px; margin-top: 1rem; }

.audio-transcript h4 { margin: 0 0 1rem 0; color: \#ff8c00; font-size: 1.1rem; }

.transcript-content { max-height: 200px; overflow-y: auto; line-height: 1.8; color: \#333; font-size: 0.95rem; padding: 1rem; background: white; border-radius: 8px; border: 1px solid \#e5e5e5; }

.transcript-content::-webkit-scrollbar { width: 6px; }

.transcript-content::-webkit-scrollbar-track { background: \#f1f1f1; border-radius: 3px; }

.transcript-content::-webkit-scrollbar-thumb { background: \#ff8c00; border-radius: 3px; }

/\* Card résumé quotidien dans dashboard \*/ .daily-summary-card { background: linear-gradient(135deg, \#fff5f0, white); border: 2px solid \#ff8c00; border-radius: 16px; padding: 1.5rem; margin-bottom: 2rem; box-shadow: 0 4px 16px rgba(255, 140, 0, 0.1); }

.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }

.summary-badge { background: linear-gradient(135deg, \#ff8c00, \#ff7700); color: white; padding: 0.5rem 1rem; border-radius: 50px; font-weight: 600; font-size: 0.9rem; }

.summary-date { color: \#666; font-size: 0.9rem; }

.summary-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem; }

.stat { display: flex; align-items: center; gap: 0.75rem; padding: 1rem; background: white; border-radius: 12px; border: 1px solid \#e5e5e5; }

.stat-icon { font-size: 2rem; }

.stat-value { font-size: 1.5rem; font-weight: bold; color: \#ff8c00; }

.stat-label { font-size: 0.8rem; color: \#666; text-transform: uppercase; }

.btn-listen { width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.75rem; padding: 1rem; background: linear-gradient(135deg, \#ff8c00, \#ff7700); color: white; border: none; border-radius: 12px; font-size: 1.1rem; font-weight: 600; cursor: pointer; transition: all 0.3s ease; }

.btn-listen:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(255, 140, 0, 0.3); }

.play-icon { font-size: 1.5rem; }

.whatsapp-info { display: flex; align-items: center; gap: 0.5rem; margin-top: 1rem; padding: 0.75rem; background: \#d4edda; border-radius: 8px; color: \#155724; font-size: 0.9rem; }

.whatsapp-icon { font-size: 1.2rem; }

/\* Widget audio dans page article \*/ .audio-summaries-widget { background: linear-gradient(135deg, \#fff9e6, \#fffbf0); border: 2px solid \#ffd700; border-radius: 16px; padding: 1.5rem; margin: 2rem 0; }

.audio-summaries-widget h3 { margin: 0 0 0.5rem 0; color: \#ff8c00; font-size: 1.2rem; }

.audio-summaries-widget p { margin: 0 0 1rem 0; color: \#666; font-size: 0.9rem; }

.audio-summaries-list { display: flex; flex-direction: column; gap: 0.75rem; }

.audio-summary-item { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: white; border-radius: 8px; border: 1px solid \#e5e5e5; transition: all 0.2s ease; }

.audio-summary-item:hover { border-color: \#ff8c00; transform: translateX(4px); }

.summary-info { display: flex; gap: 1rem; font-size: 0.85rem; }

.summary-type { font-weight: 600; color: \#ff8c00; }

.summary-date { color: \#666; }

.btn-play-mini { padding: 0.5rem 1rem; background: \#ff8c00; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; transition: all 0.2s\# 🎙️ Documentation \- Service Résumés Audio d'Actualités

## **🎯 Vue d'ensemble**

Développer un système de génération de résumés audio personnalisés des actualités gabonaises, avec envoi automatique via WhatsApp et gestion de crédits intégrée.

---

## **📋 Fonctionnalités principales**

### **1\. Résumé audio quotidien (Actualités du jour)**

* Génération automatique chaque matin  
* Top 5-10 articles du jour  
* Envoi WhatsApp programmé

### **2\. Résumé audio Actu++ (Articles sélectionnés)**

* User sélectionne articles spécifiques  
* Génération à la demande  
* Envoi immédiat WhatsApp

### **3\. Système de crédits**

* Consommation par génération audio  
* Intégration au Credit Manager existant

---

## **🏗️ Architecture technique**

### **Stack**

* **TTS** : Kokoro v1.0 (Replicate API) \- 82M params  
* **Résumés** : GPT-4 (ou résumés existants dans Supabase)  
* **WhatsApp** : Whapi.cloud API  
* **Storage** : Supabase Storage (fichiers audio)  
* **Queue** : BullMQ pour jobs asynchrones  
* **Cron** : Jobs programmés quotidiens

### **Flux de traitement**

Articles sélectionnés → Récupération résumés Supabase   
→ Agrégation \+ formatage GPT-4 (si besoin)   
→ Génération audio Kokoro   
→ Upload Supabase Storage   
→ Envoi WhatsApp via Whapi   
→ Débit crédits utilisateur

---

## **📊 Structure base de données**

\-- Table résumés audio générés  
CREATE TABLE audio\_summaries (  
  id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
  user\_id UUID REFERENCES profiles(id),  
    
  \-- Type de résumé  
  summary\_type TEXT NOT NULL, \-- 'daily' ou 'custom'  
    
  \-- Articles inclus  
  article\_ids UUID\[\],  
  articles\_count INTEGER,  
    
  \-- Contenu  
  text\_summary TEXT, \-- Texte lu  
  audio\_url TEXT, \-- URL fichier audio dans Storage  
  audio\_duration\_seconds INTEGER,  
  voice\_used TEXT DEFAULT 'af\_nicole',  
    
  \-- WhatsApp  
  whatsapp\_sent BOOLEAN DEFAULT false,  
  whatsapp\_sent\_at TIMESTAMP,  
  whatsapp\_phone TEXT,  
  whatsapp\_message\_id TEXT,  
    
  \-- Crédits  
  credits\_cost INTEGER,  
    
  \-- Meta  
  status TEXT DEFAULT 'pending', \-- pending, processing, completed, failed  
  error\_message TEXT,  
  created\_at TIMESTAMP DEFAULT NOW(),  
  completed\_at TIMESTAMP  
);

\-- Index pour performances  
CREATE INDEX idx\_audio\_summaries\_user ON audio\_summaries(user\_id);  
CREATE INDEX idx\_audio\_summaries\_type ON audio\_summaries(summary\_type, created\_at);

\-- Table configuration utilisateur  
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS audio\_settings JSONB DEFAULT '{  
  "daily\_summary\_enabled": false,  
  "delivery\_time": "07:00",  
  "whatsapp\_number": null,  
  "preferred\_voice": "af\_nicole",  
  "max\_articles\_daily": 10  
}'::jsonb;

\-- Table consommation crédits (enrichir existante)  
CREATE TABLE IF NOT EXISTS credit\_transactions (  
  id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
  user\_id UUID REFERENCES profiles(id),  
  amount INTEGER, \-- négatif \= débit, positif \= crédit  
  transaction\_type TEXT, \-- 'audio\_summary\_daily', 'audio\_summary\_custom'  
  reference\_id UUID, \-- ID du audio\_summary  
  balance\_after INTEGER,  
  created\_at TIMESTAMP DEFAULT NOW()  
);

---

## **🤖 Intégration APIs**

### **1\. Kokoro TTS (Replicate)**

import Replicate from "replicate";  
import { writeFile } from "fs/promises";  
import { createClient } from '@supabase/supabase-js';

const replicate \= new Replicate({  
  auth: process.env.REPLICATE\_API\_TOKEN  
});

const supabase \= createClient(  
  process.env.SUPABASE\_URL,  
  process.env.SUPABASE\_SERVICE\_ROLE\_KEY  
);

/\*\*  
 \* Génère un audio à partir d'un texte  
 \* @param {string} text \- Texte à convertir en audio  
 \* @param {string} voice \- Voix à utiliser (défaut: af\_nicole)  
 \* @returns {Promise\<{audioUrl: string, duration: number}\>}  
 \*/  
async function generateAudioSummary(text, voice \= "af\_nicole") {  
  try {  
    console.log('🎙️ Génération audio avec Kokoro...');  
      
    const input \= {  
      text: text,  
      voice: voice,  
      speed: 1.0 // Vitesse normale  
    };

    const output \= await replicate.run(  
      "jaaari/kokoro-82m:f559560eb822dc509045f3921a1921234918b91739db4bf3daab2169b71c7a13",  
      { input }  
    );

    // Télécharger le fichier audio  
    const audioBuffer \= await output.arrayBuffer();  
    const audioBlob \= Buffer.from(audioBuffer);  
      
    // Calculer durée approximative (basé sur taille fichier)  
    const durationSeconds \= Math.ceil(audioBlob.length / 16000); // \~16KB par seconde  
      
    return {  
      audioBuffer: audioBlob,  
      duration: durationSeconds,  
      fileSize: audioBlob.length  
    };

  } catch (error) {  
    console.error('❌ Erreur génération audio:', error);  
    throw new Error(\`Échec génération audio: ${error.message}\`);  
  }  
}

/\*\*  
 \* Upload audio vers Supabase Storage  
 \* @param {Buffer} audioBuffer \- Buffer du fichier audio  
 \* @param {string} userId \- ID utilisateur  
 \* @param {string} summaryId \- ID du résumé  
 \* @returns {Promise\<string\>} URL publique du fichier  
 \*/  
async function uploadAudioToStorage(audioBuffer, userId, summaryId) {  
  try {  
    const fileName \= \`${userId}/${summaryId}.wav\`;  
      
    const { data, error } \= await supabase.storage  
      .from('audio-summaries')  
      .upload(fileName, audioBuffer, {  
        contentType: 'audio/wav',  
        upsert: true  
      });

    if (error) throw error;

    // Obtenir URL publique  
    const { data: urlData } \= supabase.storage  
      .from('audio-summaries')  
      .getPublicUrl(fileName);

    return urlData.publicUrl;

  } catch (error) {  
    console.error('❌ Erreur upload audio:', error);  
    throw new Error(\`Échec upload audio: ${error.message}\`);  
  }  
}

### **2\. Préparation du texte pour audio**

/\*\*  
 \* Récupère et formate les résumés d'articles pour audio  
 \* @param {string\[\]} articleIds \- IDs des articles  
 \* @param {string} summaryType \- Type de résumé ('daily' ou 'custom')  
 \* @returns {Promise\<string\>} Texte formaté pour audio  
 \*/  
async function prepareAudioScript(articleIds, summaryType \= 'daily') {  
  try {  
    // Récupérer articles avec résumés depuis Supabase  
    const { data: articles, error } \= await supabase  
      .from('articles')  
      .select('id, title, summary, category, published\_at')  
      .in('id', articleIds)  
      .order('published\_at', { ascending: false });

    if (error) throw error;

    // Introduction  
    let script \= '';  
    if (summaryType \=== 'daily') {  
      const date \= new Date().toLocaleDateString('fr-FR', {   
        weekday: 'long',   
        day: 'numeric',   
        month: 'long'   
      });  
      script \= \`Bonjour et bienvenue dans votre résumé d'actualités Gabon 24/7 pour ce ${date}. Voici les principales informations du jour.\\n\\n\`;  
    } else {  
      script \= \`Voici le résumé audio de vos articles sélectionnés.\\n\\n\`;  
    }

    // Ajouter chaque article  
    articles.forEach((article, index) \=\> {  
      script \+= \`Article ${index \+ 1}. ${article.title}.\\n\`;  
      script \+= \`${article.summary}\\n\\n\`;  
    });

    // Conclusion  
    script \+= \`Fin de votre résumé d'actualités. Restez informé avec Gabon 24/7.\`;

    return script;

  } catch (error) {  
    console.error('❌ Erreur préparation script:', error);  
    throw new Error(\`Échec préparation script: ${error.message}\`);  
  }  
}

/\*\*  
 \* Utilise GPT-4 pour améliorer/résumer le script audio si besoin  
 \* @param {string} rawScript \- Script brut  
 \* @returns {Promise\<string\>} Script optimisé pour audio  
 \*/  
async function optimizeScriptWithGPT4(rawScript) {  
  try {  
    const response \= await fetch('https://api.openai.com/v1/chat/completions', {  
      method: 'POST',  
      headers: {  
        'Authorization': \`Bearer ${process.env.OPENAI\_API\_KEY}\`,  
        'Content-Type': 'application/json'  
      },  
      body: JSON.stringify({  
        model: 'gpt-4',  
        messages: \[{  
          role: 'system',  
          content: 'Tu es un rédacteur de bulletins d\\'information audio pour Gabon 24/7. Optimise le script pour qu\\'il soit fluide et agréable à l\\'écoute, en gardant un ton professionnel et informatif. Garde la structure mais améliore les transitions.'  
        }, {  
          role: 'user',  
          content: rawScript  
        }\],  
        max\_tokens: 1500,  
        temperature: 0.7  
      })  
    });

    const result \= await response.json();  
    return result.choices\[0\].message.content;

  } catch (error) {  
    console.error('⚠️ Erreur optimisation GPT-4, utilisation script brut:', error);  
    return rawScript; // Fallback sur script original  
  }  
}

### **3\. Envoi WhatsApp (Whapi)**

/\*\*  
 \* Envoie le résumé audio via WhatsApp  
 \* @param {string} phoneNumber \- Numéro WhatsApp (format international)  
 \* @param {string} audioUrl \- URL du fichier audio  
 \* @param {string} caption \- Message d'accompagnement  
 \* @returns {Promise\<{messageId: string}\>}  
 \*/  
async function sendAudioViaWhatsApp(phoneNumber, audioUrl, caption) {  
  try {  
    console.log('📱 Envoi WhatsApp...');

    const response \= await fetch('https://gate.whapi.cloud/messages/audio', {  
      method: 'POST',  
      headers: {  
        'Authorization': \`Bearer ${process.env.WHAPI\_TOKEN}\`,  
        'Content-Type': 'application/json'  
      },  
      body: JSON.stringify({  
        to: phoneNumber,  
        media: {  
          url: audioUrl,  
          mimetype: 'audio/wav'  
        },  
        caption: caption  
      })  
    });

    const result \= await response.json();

    if (\!response.ok) {  
      throw new Error(\`Whapi error: ${result.message || 'Unknown error'}\`);  
    }

    return {  
      messageId: result.message\_id,  
      status: result.status  
    };

  } catch (error) {  
    console.error('❌ Erreur envoi WhatsApp:', error);  
    throw new Error(\`Échec envoi WhatsApp: ${error.message}\`);  
  }  
}

---

## **🔄 Service principal**

/\*\*  
 \* Service complet de génération et envoi de résumé audio  
 \*/  
class AudioSummaryService {  
    
  /\*\*  
   \* Génère un résumé audio quotidien pour un utilisateur  
   \* @param {string} userId \- ID utilisateur  
   \*/  
  async generateDailySummary(userId) {  
    let summaryRecord \= null;  
      
    try {  
      console.log(\`🎙️ Génération résumé quotidien pour user ${userId}\`);

      // 1\. Vérifier configuration utilisateur  
      const { data: userProfile } \= await supabase  
        .from('profiles')  
        .select('audio\_settings, credits\_balance')  
        .eq('id', userId)  
        .single();

      if (\!userProfile.audio\_settings?.daily\_summary\_enabled) {  
        console.log('⏭️ Résumé quotidien désactivé pour cet utilisateur');  
        return;  
      }

      // 2\. Vérifier crédits suffisants  
      const requiredCredits \= 5; // Coût résumé quotidien  
      if (userProfile.credits\_balance \< requiredCredits) {  
        console.log('❌ Crédits insuffisants');  
        throw new Error('Crédits insuffisants pour générer le résumé audio');  
      }

      // 3\. Récupérer les articles du jour  
      const { data: todayArticles } \= await supabase  
        .from('articles')  
        .select('id, title, summary, importance\_score')  
        .gte('published\_at', new Date().setHours(0, 0, 0, 0))  
        .order('importance\_score', { ascending: false })  
        .limit(userProfile.audio\_settings.max\_articles\_daily || 10);

      if (\!todayArticles?.length) {  
        console.log('ℹ️ Aucun article disponible aujourd\\'hui');  
        return;  
      }

      const articleIds \= todayArticles.map(a \=\> a.id);

      // 4\. Créer enregistrement résumé audio  
      const { data: summary, error: summaryError } \= await supabase  
        .from('audio\_summaries')  
        .insert({  
          user\_id: userId,  
          summary\_type: 'daily',  
          article\_ids: articleIds,  
          articles\_count: articleIds.length,  
          status: 'processing',  
          credits\_cost: requiredCredits,  
          whatsapp\_phone: userProfile.audio\_settings.whatsapp\_number  
        })  
        .select()  
        .single();

      if (summaryError) throw summaryError;  
      summaryRecord \= summary;

      // 5\. Préparer script audio  
      let script \= await prepareAudioScript(articleIds, 'daily');  
        
      // Optionnel: optimiser avec GPT-4  
      script \= await optimizeScriptWithGPT4(script);

      // 6\. Générer audio avec Kokoro  
      const { audioBuffer, duration } \= await generateAudioSummary(  
        script,  
        userProfile.audio\_settings.preferred\_voice || 'af\_nicole'  
      );

      // 7\. Upload vers Supabase Storage  
      const audioUrl \= await uploadAudioToStorage(audioBuffer, userId, summary.id);

      // 8\. Envoyer via WhatsApp  
      let whatsappResult \= null;  
      if (userProfile.audio\_settings.whatsapp\_number) {  
        const caption \= \`🎙️ Votre résumé d'actualités Gabon 24/7 du ${new Date().toLocaleDateString('fr-FR')}\`;  
        whatsappResult \= await sendAudioViaWhatsApp(  
          userProfile.audio\_settings.whatsapp\_number,  
          audioUrl,  
          caption  
        );  
      }

      // 9\. Mettre à jour résumé audio  
      await supabase  
        .from('audio\_summaries')  
        .update({  
          text\_summary: script,  
          audio\_url: audioUrl,  
          audio\_duration\_seconds: duration,  
          whatsapp\_sent: \!\!whatsappResult,  
          whatsapp\_sent\_at: whatsappResult ? new Date().toISOString() : null,  
          whatsapp\_message\_id: whatsappResult?.messageId,  
          status: 'completed',  
          completed\_at: new Date().toISOString()  
        })  
        .eq('id', summary.id);

      // 10\. Débiter crédits  
      await this.debitCredits(userId, requiredCredits, summary.id, 'audio\_summary\_daily');

      console.log('✅ Résumé audio quotidien généré et envoyé avec succès');  
      return summary;

    } catch (error) {  
      console.error('❌ Erreur génération résumé quotidien:', error);

      // Mettre à jour statut erreur si enregistrement créé  
      if (summaryRecord) {  
        await supabase  
          .from('audio\_summaries')  
          .update({  
            status: 'failed',  
            error\_message: error.message  
          })  
          .eq('id', summaryRecord.id);  
      }

      throw error;  
    }  
  }

  /\*\*  
   \* Génère un résumé audio personnalisé (Actu++)  
   \* @param {string} userId \- ID utilisateur  
   \* @param {string\[\]} articleIds \- Articles sélectionnés  
   \*/  
  async generateCustomSummary(userId, articleIds) {  
    let summaryRecord \= null;

    try {  
      console.log(\`🎙️ Génération résumé personnalisé pour user ${userId}\`);

      // Validation  
      if (\!articleIds || articleIds.length \=== 0\) {  
        throw new Error('Aucun article sélectionné');  
      }

      if (articleIds.length \> 20\) {  
        throw new Error('Maximum 20 articles par résumé personnalisé');  
      }

      // 1\. Vérifier crédits  
      const { data: userProfile } \= await supabase  
        .from('profiles')  
        .select('credits\_balance, audio\_settings')  
        .eq('id', userId)  
        .single();

      // Calcul coût (2 crédits \+ 0.5 par article supplémentaire après 5\)  
      const baseCredits \= 2;  
      const extraArticles \= Math.max(0, articleIds.length \- 5);  
      const requiredCredits \= baseCredits \+ (extraArticles \* 0.5);

      if (userProfile.credits\_balance \< requiredCredits) {  
        throw new Error('Crédits insuffisants');  
      }

      // 2\. Créer enregistrement  
      const { data: summary } \= await supabase  
        .from('audio\_summaries')  
        .insert({  
          user\_id: userId,  
          summary\_type: 'custom',  
          article\_ids: articleIds,  
          articles\_count: articleIds.length,  
          status: 'processing',  
          credits\_cost: requiredCredits,  
          whatsapp\_phone: userProfile.audio\_settings?.whatsapp\_number  
        })  
        .select()  
        .single();

      summaryRecord \= summary;

      // 3-9. Même processus que daily summary  
      let script \= await prepareAudioScript(articleIds, 'custom');  
      const { audioBuffer, duration } \= await generateAudioSummary(script);  
      const audioUrl \= await uploadAudioToStorage(audioBuffer, userId, summary.id);

      let whatsappResult \= null;  
      if (userProfile.audio\_settings?.whatsapp\_number) {  
        const caption \= \`🎙️ Votre résumé personnalisé Gabon 24/7 (${articleIds.length} articles)\`;  
        whatsappResult \= await sendAudioViaWhatsApp(  
          userProfile.audio\_settings.whatsapp\_number,  
          audioUrl,  
          caption  
        );  
      }

      await supabase  
        .from('audio\_summaries')  
        .update({  
          text\_summary: script,  
          audio\_url: audioUrl,  
          audio\_duration\_seconds: duration,  
          whatsapp\_sent: \!\!whatsappResult,  
          whatsapp\_sent\_at: whatsappResult ? new Date().toISOString() : null,  
          whatsapp\_message\_id: whatsappResult?.messageId,  
          status: 'completed',  
          completed\_at: new Date().toISOString()  
        })  
        .eq('id', summary.id);

      await this.debitCredits(userId, requiredCredits, summary.id, 'audio\_summary\_custom');

      console.log('✅ Résumé audio personnalisé généré');  
      return summary;

    } catch (error) {  
      console.error('❌ Erreur résumé personnalisé:', error);  
        
      if (summaryRecord) {  
        await supabase  
          .from('audio\_summaries')  
          .update({ status: 'failed', error\_message: error.message })  
          .eq('id', summaryRecord.id);  
      }

      throw error;  
    }  
  }

  /\*\*  
   \* Débite les crédits utilisateur  
   \*/  
  async debitCredits(userId, amount, referenceId, transactionType) {  
    try {  
      // 1\. Récupérer solde actuel  
      const { data: profile } \= await supabase  
        .from('profiles')  
        .select('credits\_balance')  
        .eq('id', userId)  
        .single();

      const newBalance \= profile.credits\_balance \- amount;

      // 2\. Mettre à jour solde  
      await supabase  
        .from('profiles')  
        .update({ credits\_balance: newBalance })  
        .eq('id', userId);

      // 3\. Enregistrer transaction  
      await supabase  
        .from('credit\_transactions')  
        .insert({  
          user\_id: userId,  
          amount: \-amount,  
          transaction\_type: transactionType,  
          reference\_id: referenceId,  
          balance\_after: newBalance  
        });

      console.log(\`💳 ${amount} crédits débités \- Nouveau solde: ${newBalance}\`);

    } catch (error) {  
      console.error('❌ Erreur débit crédits:', error);  
      throw error;  
    }  
  }  
}

// Export instance  
export const audioSummaryService \= new AudioSummaryService();

---

## **⚡ APIs Routes**

import express from 'express';  
import { audioSummaryService } from './services/audioSummaryService';  
import { authenticateUser } from './middleware/auth';

const router \= express.Router();

/\*\*  
 \* POST /api/audio-summary/custom  
 \* Génère résumé audio personnalisé  
 \*/  
router.post('/custom', authenticateUser, async (req, res) \=\> {  
  try {  
    const { articleIds } \= req.body;  
    const userId \= req.user.id;

    if (\!articleIds || \!Array.isArray(articleIds)) {  
      return res.status(400).json({ error: 'articleIds requis (array)' });  
    }

    const summary \= await audioSummaryService.generateCustomSummary(userId, articleIds);

    res.json({  
      success: true,  
      summaryId: summary.id,  
      audioUrl: summary.audio\_url,  
      creditsUsed: summary.credits\_cost,  
      whatsappSent: summary.whatsapp\_sent  
    });

  } catch (error) {  
    console.error('Erreur API custom summary:', error);  
    res.status(500).json({ error: error.message });  
  }  
});

/\*\*  
 \* GET /api/audio-summary/history  
 \* Historique résumés utilisateur  
 \*/  
router.get('/history', authenticateUser, async (req, res) \=\> {  
  try {  
    const { data: summaries } \= await supabase  
      .from('audio\_summaries')  
      .select('\*')  
      .eq('user\_id', req.user.id)  
      .order('created\_at', { ascending: false })  
      .limit(50);

    res.json({ summaries });

  } catch (error) {  
    res.status(500).json({ error: error.message });  
  }  
});

/\*\*  
 \* GET /api/audio-summary/:id  
 \* Détail résumé spécifique  
 \*/  
router.get('/:id', authenticateUser, async (req, res) \=\> {  
  try {  
    const { data: summary } \= await supabase  
      .from('audio\_summaries')  
      .select('\*')  
      .eq('id', req.params.id)  
      .eq('user\_id', req.user.id)  
      .single();

    if (\!summary) {  
      return res.status(404).json({ error: 'Résumé non trouvé' });  
    }

    res.json({ summary });

  } catch (error) {  
    res.status(500).json({ error: error.message });  
  }  
});

/\*\*  
 \* PUT /api/audio-summary/settings  
 \* Configuration résumés quotidiens  
 \*/  
router.put('/settings', authenticateUser, async (req, res) \=\> {  
  try {  
    const { dailyEnabled, deliveryTime, whatsappNumber, preferredVoice } \= req.body;

    const audioSettings \= {  
      daily\_summary\_enabled: dailyEnabled,  
      delivery\_time: deliveryTime || '07:00',  
      whatsapp\_number: whatsappNumber,  
      preferred\_voice: preferredVoice || 'af\_nicole',  
      max\_articles\_daily: 10  
    };

    await supabase  
      .from('profiles')  
      .update({ audio\_settings: audioSettings })  
      .eq('id', req.user.id);

    res.json({ success: true, settings: audioSettings });

  } catch (error) {  
    res.status(500).json({ error: error.message });  
  }  
});

export default router;

---

## **⏰ Cron Job quotidien**

import cron from 'node-cron';  
import { audioSummaryService } from './services/audioSummaryService';

/\*\*  
 \* Job quotidien \- génération résumés audio  
 \* S'exécute chaque jour à 06:00  
 \*/  
cron.schedule('0 6 \* \* \*', async () \=\> {  
  console.log('🕐 Démarrage génération résumés audio quotidiens...');

  try {  
    // Récupérer utilisateurs avec résumé quotidien activé  
    const { data: users } \= await supabase  
      .from('profiles')  
      .select('id, audio\_settings')  
      .not('audio\_settings-\>daily\_summary\_enabled', 'is', null)  
      .gte('credits\_balance', 5); // Au moins 5 crédits

    const enabledUsers \= users.filter(  
      u \=\> u.audio\_settings?.daily\_summary\_enabled \=== true  
    );

    console.log(\`📊 ${enabledUsers.length} utilisateurs éligibles\`);

    // Générer résumés en parallèle (max 5 à la fois)  
    const chunks \= \[\];  
    for (let i \= 0; i \< enabledUsers.length; i \+= 5\) {  
      chunks.push(enabledUsers.slice(i, i \+ 5));  
    }

    for (const chunk of chunks) {  
      await Promise.all(  
        chunk.map(user \=\>   
          audioSummaryService.generateDailySummary(user.id)  
            .catch(err \=\> console.error(\`Erreur user ${user.id}:\`, err))  
        )  
      );  
    }

    console.log('✅ Génération résumés quotidiens terminée');

  } catch (error) {  
    console.error('❌ Erreur cron résumés quotidiens:', error);  
  }  
});

---

## **💰 Tarification crédits**

const AUDIO\_SUMMARY\_PRICING \= {  
  // Résumé quotidien  
  daily\_summary: 5, // crédits  
    
  // Résumé personnalisé  
  custom\_base: 2, // jusqu'à 5 articles  
  custom\_extra\_article: 0.5, // par article supplémentaire  
    
  // Calcul dynamique  
  calculateCustomCost: (articleCount) \=\> {  
    const base \= AUDIO\_SUMMARY\_PRICING.custom\_base;  
    const extra \= Math.max(0, articleCount \- 5);  
    return base \+ (extra \* AUDIO\_SUMMARY\_PRICING.custom\_extra\_article);  
  }  
};

---

## **📱 Interface Frontend (exemples)**

### **Page configuration**

const AudioSettingsPage \= () \=\> {  
  const \[settings, setSettings\] \= useState({  
    dailyEnabled: false,  
    deliveryTime: '07:00',  
    whatsappNumber: '',  
    preferredVoice: 'af\_nicole'  
  });

  const handleSaveSettings \= async () \=\> {  
    const response \= await fetch('/api/audio-summary/settings', {  
      method: 'PUT',  
      headers: { 'Content-Type': 'application/json' },  
      body: JSON.stringify(settings)  
    });  
    // ...  
  };

  return (  
    \<div className="audio-settings"\>  
      \<h2\>🎙️ Résumés Audio\</h2\>  
        
      \<div className="setting-item"\>  
        \<label\>  
          \<input   
            type="checkbox"  
            checked={settings.dailyEnabled}  
            onChange={(e) \=\> setSettings({...settings, dailyEnabled: e.target.checked})}  
          /\>  
          Activer résumé quotidien (5 crédits/jour)  
        \</label\>  
      \</div\>

      {settings.dailyEnabled && (  
        \<\>  
          \<div className="setting-item"\>  
            \<label\>Heure de livraison\</label\>  
            \<input   
              type="time"  
              value={settings.deliveryTime}  
              onChange={(e) \=\> setSettings({...settings, deliveryTime: e.target.value})}  
            /\>  
          \</div\>

          \<div className="setting-item"\>  
            \<label\>Numéro WhatsApp\</label\>  
            \<input   
              type="tel"  
              placeholder="+241 XX XX XX XX"  
              value={settings.whatsappNumber}  
              onChange={(e) \=\> setSettings({...settings, whatsappNumber: e.target.value})}  
            /\>  
          \</div\>  
        \</\>  
      )}

      \<button onClick={handleSaveSettings}\>Sauvegarder\</button\>  
    \</div\>  
  );  
};

### **Bouton génération personnalisée avec lecture intégrée**

const ArticlesList \= ({ articles, selectedIds, onSelectionsChange }) \=\> {  
  const \[generating, setGenerating\] \= useState(false);  
  const \[generatedAudio, setGeneratedAudio\] \= useState(null);  
  const \[showPlayer, setShowPlayer\] \= useState(false);

  const handleGenerateAudio \= async () \=\> {  
    if (selectedIds.length \=== 0\) {  
      alert('Sélectionnez au moins un article');  
      return;  
    }

    setGenerating(true);  
    try {  
      const response \= await fetch('/api/audio-summary/custom', {  
        method: 'POST',  
        headers: { 'Content-Type': 'application/json' },  
        body: JSON.stringify({ articleIds: selectedIds })  
      });

      const result \= await response.json();

      if (result.success) {  
        setGeneratedAudio(result);  
        setShowPlayer(true);  
          
        // Notification succès  
        toast.success(\`✅ Résumé audio généré\!\\n${result.creditsUsed} crédits utilisés\`);  
      }  
    } catch (error) {  
      toast.error('❌ Erreur: ' \+ error.message);  
    } finally {  
      setGenerating(false);  
    }  
  };

  const cost \= AUDIO\_SUMMARY\_PRICING.calculateCustomCost(selectedIds.length);

  return (  
    \<div className="articles-list"\>  
      \<div className="articles-header"\>  
        \<h2\>Articles disponibles\</h2\>  
        \<div className="audio-actions"\>  
          \<span className="selected-count"\>  
            {selectedIds.length} article{selectedIds.length \> 1 ? 's' : ''} sélectionné{selectedIds.length \> 1 ? 's' : ''}  
          \</span\>  
          \<button   
            className="btn-generate-audio"  
            onClick={handleGenerateAudio}  
            disabled={generating || selectedIds.length \=== 0}  
          \>  
            {generating ? '🔄 Génération...' : \`🎙️ Générer résumé audio (${cost} crédits)\`}  
          \</button\>  
        \</div\>  
      \</div\>

      {/\* Player audio intégré \*/}  
      {showPlayer && generatedAudio && (  
        \<AudioPlayerModal   
          audio={generatedAudio}  
          onClose={() \=\> setShowPlayer(false)}  
        /\>  
      )}

      \<div className="articles-grid"\>  
        {articles.map(article \=\> (  
          \<div key={article.id} className="article-card"\>  
            \<input   
              type="checkbox"  
              checked={selectedIds.includes(article.id)}  
              onChange={(e) \=\> {  
                if (e.target.checked) {  
                  onSelectionsChange(\[...selectedIds, article.id\]);  
                } else {  
                  onSelectionsChange(selectedIds.filter(id \=\> id \!== article.id));  
                }  
              }}  
            /\>  
            \<h3\>{article.title}\</h3\>  
            \<p\>{article.summary}\</p\>  
          \</div\>  
        ))}  
      \</div\>  
    \</div\>  
  );  
};

### **Composant Player Audio Modal**

const AudioPlayerModal \= ({ audio, onClose }) \=\> {  
  const audioRef \= useRef(null);  
  const \[isPlaying, setIsPlaying\] \= useState(false);  
  const \[currentTime, setCurrentTime\] \= useState(0);  
  const \[duration, setDuration\] \= useState(audio.duration || 0);  
  const \[playbackRate, setPlaybackRate\] \= useState(1.0);

  useEffect(() \=\> {  
    const audioElement \= audioRef.current;  
      
    const updateTime \= () \=\> setCurrentTime(audioElement.currentTime);  
    const updateDuration \= () \=\> setDuration(audioElement.duration);  
    const handleEnded \= () \=\> setIsPlaying(false);

    audioElement.addEventListener('timeupdate', updateTime);  
    audioElement.addEventListener('loadedmetadata', updateDuration);  
    audioElement.addEventListener('ended', handleEnded);

    return () \=\> {  
      audioElement.removeEventListener('timeupdate', updateTime);  
      audioElement.removeEventListener('loadedmetadata', updateDuration);  
      audioElement.removeEventListener('ended', handleEnded);  
    };  
  }, \[\]);

  const togglePlay \= () \=\> {  
    if (isPlaying) {  
      audioRef.current.pause();  
    } else {  
      audioRef.current.play();  
    }  
    setIsPlaying(\!isPlaying);  
  };

  const handleSeek \= (e) \=\> {  
    const seekTime \= (e.target.value / 100\) \* duration;  
    audioRef.current.currentTime \= seekTime;  
    setCurrentTime(seekTime);  
  };

  const handleSpeedChange \= (speed) \=\> {  
    setPlaybackRate(speed);  
    audioRef.current.playbackRate \= speed;  
  };

  const formatTime \= (seconds) \=\> {  
    const mins \= Math.floor(seconds / 60);  
    const secs \= Math.floor(seconds % 60);  
    return \`${mins}:${secs.toString().padStart(2, '0')}\`;  
  };

  const downloadAudio \= () \=\> {  
    const a \= document.createElement('a');  
    a.href \= audio.audioUrl;  
    a.download \= \`gabon247-resume-${audio.summaryId}.wav\`;  
    a.click();  
  };

  const shareToWhatsApp \= () \=\> {  
    window.open(\`https://wa.me/?text=Écoutez mon résumé audio Gabon 24/7: ${audio.audioUrl}\`, '\_blank');  
  };

  return (  
    \<div className="audio-player-modal-overlay" onClick={onClose}\>  
      \<div className="audio-player-modal" onClick={(e) \=\> e.stopPropagation()}\>  
        \<div className="modal-header"\>  
          \<div className="header-content"\>  
            \<div className="audio-icon"\>🎙️\</div\>  
            \<div className="header-text"\>  
              \<h3\>Votre résumé audio\</h3\>  
              \<p\>{audio.articlesCount} article{audio.articlesCount \> 1 ? 's' : ''} • {formatTime(duration)}\</p\>  
            \</div\>  
          \</div\>  
          \<button className="btn-close" onClick={onClose}\>✕\</button\>  
        \</div\>

        \<div className="player-controls"\>  
          {/\* Waveform visuel (optionnel) \*/}  
          \<div className="audio-waveform"\>  
            \<div   
              className="waveform-progress"   
              style={{ width: \`${(currentTime / duration) \* 100}%\` }}  
            /\>  
          \</div\>

          {/\* Timeline \*/}  
          \<div className="timeline"\>  
            \<span className="time-current"\>{formatTime(currentTime)}\</span\>  
            \<input   
              type="range"  
              min="0"  
              max="100"  
              value={(currentTime / duration) \* 100 || 0}  
              onChange={handleSeek}  
              className="timeline-slider"  
            /\>  
            \<span className="time-duration"\>{formatTime(duration)}\</span\>  
          \</div\>

          {/\* Contrôles lecture \*/}  
          \<div className="playback-controls"\>  
            \<button   
              className="btn-speed"  
              onClick={() \=\> {  
                const speeds \= \[0.75, 1.0, 1.25, 1.5, 2.0\];  
                const currentIndex \= speeds.indexOf(playbackRate);  
                const nextSpeed \= speeds\[(currentIndex \+ 1\) % speeds.length\];  
                handleSpeedChange(nextSpeed);  
              }}  
            \>  
              {playbackRate}x  
            \</button\>

            \<button className="btn-rewind" onClick={() \=\> {  
              audioRef.current.currentTime \= Math.max(0, currentTime \- 10);  
            }}\>  
              ⏪ 10s  
            \</button\>

            \<button className="btn-play-pause" onClick={togglePlay}\>  
              {isPlaying ? '⏸️' : '▶️'}  
            \</button\>

            \<button className="btn-forward" onClick={() \=\> {  
              audioRef.current.currentTime \= Math.min(duration, currentTime \+ 10);  
            }}\>  
              10s ⏩  
            \</button\>

            \<button className="btn-volume"\>🔊\</button\>  
          \</div\>

          {/\* Actions supplémentaires \*/}  
          \<div className="player-actions"\>  
            \<button className="btn-download" onClick={downloadAudio}\>  
              📥 Télécharger  
            \</button\>  
            \<button className="btn-share" onClick={shareToWhatsApp}\>  
              💬 Partager WhatsApp  
            \</button\>  
            {audio.whatsappSent && (  
              \<span className="whatsapp-status"\>✅ Envoyé sur WhatsApp\</span\>  
            )}  
          \</div\>  
        \</div\>

        {/\* Élément audio HTML5 \*/}  
        \<audio   
          ref={audioRef}  
          src={audio.audioUrl}  
          preload="metadata"  
        /\>

        {/\* Transcription (optionnel) \*/}  
        \<div className="audio-transcript"\>  
          \<h4\>📝 Transcription\</h4\>  
          \<div className="transcript-content"\>  
            {audio.textSummary}  
          \</div\>  
        \</div\>  
      \</div\>  
    \</div\>  
  );  
};

### **Card résumé audio dans le dashboard**

const DailySummaryCard \= ({ summary }) \=\> {  
  const \[showPlayer, setShowPlayer\] \= useState(false);

  return (  
    \<\>  
      \<div className="daily-summary-card"\>  
        \<div className="card-header"\>  
          \<div className="summary-badge"\>🎙️ Résumé quotidien\</div\>  
          \<div className="summary-date"\>  
            {new Date(summary.created\_at).toLocaleDateString('fr-FR', {  
              weekday: 'long',  
              day: 'numeric',  
              month: 'long'  
            })}  
          \</div\>  
        \</div\>

        \<div className="card-body"\>  
          \<div className="summary-stats"\>  
            \<div className="stat"\>  
              \<span className="stat-icon"\>📰\</span\>  
              \<div\>  
                \<div className="stat-value"\>{summary.articles\_count}\</div\>  
                \<div className="stat-label"\>Articles\</div\>  
              \</div\>  
            \</div\>  
            \<div className="stat"\>  
              \<span className="stat-icon"\>⏱️\</span\>  
              \<div\>  
                \<div className="stat-value"\>{Math.ceil(summary.audio\_duration\_seconds / 60)}min\</div\>  
                \<div className="stat-label"\>Durée\</div\>  
              \</div\>  
            \</div\>  
            \<div className="stat"\>  
              \<span className="stat-icon"\>🎯\</span\>  
              \<div\>  
                \<div className="stat-value"\>{summary.credits\_cost}\</div\>  
                \<div className="stat-label"\>Crédits\</div\>  
              \</div\>  
            \</div\>  
          \</div\>

          \<button   
            className="btn-listen"  
            onClick={() \=\> setShowPlayer(true)}  
          \>  
            \<span className="play-icon"\>▶️\</span\>  
            \<span\>Écouter le résumé\</span\>  
          \</button\>

          {summary.whatsapp\_sent && (  
            \<div className="whatsapp-info"\>  
              \<span className="whatsapp-icon"\>📱\</span\>  
              \<span\>Envoyé sur WhatsApp à {new Date(summary.whatsapp\_sent\_at).toLocaleTimeString('fr-FR')}\</span\>  
            \</div\>  
          )}  
        \</div\>  
      \</div\>

      {showPlayer && (  
        \<AudioPlayerModal   
          audio={{  
            summaryId: summary.id,  
            audioUrl: summary.audio\_url,  
            duration: summary.audio\_duration\_seconds,  
            articlesCount: summary.articles\_count,  
            textSummary: summary.text\_summary,  
            whatsappSent: summary.whatsapp\_sent  
          }}  
          onClose={() \=\> setShowPlayer(false)}  
        /\>  
      )}  
    \</\>  
  );  
};

### **Widget résumé audio dans la page article**

const ArticlePage \= ({ article }) \=\> {  
  const \[audioSummaries, setAudioSummaries\] \= useState(\[\]);

  useEffect(() \=\> {  
    // Charger résumés audio contenant cet article  
    fetchAudioSummariesForArticle(article.id);  
  }, \[article.id\]);

  const fetchAudioSummariesForArticle \= async (articleId) \=\> {  
    const { data } \= await supabase  
      .from('audio\_summaries')  
      .select('\*')  
      .contains('article\_ids', \[articleId\])  
      .eq('status', 'completed')  
      .order('created\_at', { ascending: false })  
      .limit(3);

    setAudioSummaries(data || \[\]);  
  };

  return (  
    \<div className="article-page"\>  
      \<h1\>{article.title}\</h1\>  
        
      {/\* Widget résumés audio disponibles \*/}  
      {audioSummaries.length \> 0 && (  
        \<div className="audio-summaries-widget"\>  
          \<h3\>🎙️ Disponible en audio\</h3\>  
          \<p\>Cet article fait partie de {audioSummaries.length} résumé{audioSummaries.length \> 1 ? 's' : ''} audio\</p\>  
          \<div className="audio-summaries-list"\>  
            {audioSummaries.map(summary \=\> (  
              \<div key={summary.id} className="audio-summary-item"\>  
                \<div className="summary-info"\>  
                  \<span className="summary-type"\>  
                    {summary.summary\_type \=== 'daily' ? '📅 Quotidien' : '🎯 Personnalisé'}  
                  \</span\>  
                  \<span className="summary-date"\>  
                    {new Date(summary.created\_at).toLocaleDateString('fr-FR')}  
                  \</span\>  
                \</div\>  
                \<button   
                  className="btn-play-mini"  
                  onClick={() \=\> {  
                    // Ouvrir player  
                  }}  
                \>  
                  ▶️ Écouter  
                \</button\>  
              \</div\>  
            ))}  
          \</div\>  
        \</div\>  
      )}

      {/\* Contenu article \*/}  
      \<div className="article-content"\>  
        {article.content}  
      \</div\>  
    \</div\>  
  );  
};

### **Historique des résumés audio**

const AudioSummariesHistory \= () \=\> {  
  const \[summaries, setSummaries\] \= useState(\[\]);  
  const \[loading, setLoading\] \= useState(true);

  useEffect(() \=\> {  
    fetchHistory();  
  }, \[\]);

  const fetchHistory \= async () \=\> {  
    try {  
      const response \= await fetch('/api/audio-summary/history');  
      const data \= await response.json();  
      setSummaries(data.summaries);  
    } catch (error) {  
      console.error('Erreur chargement historique:', error);  
    } finally {  
      setLoading(false);  
    }  
  };

  if (loading) return \<div\>Chargement...\</div\>;

  return (  
    \<div className="audio-history"\>  
      \<h2\>📚 Historique de vos résumés audio\</h2\>  
        
      \<div className="summaries-list"\>  
        {summaries.map(summary \=\> (  
          \<div key={summary.id} className="summary-card"\>  
            \<div className="summary-header"\>  
              \<div className="summary-type"\>  
                {summary.summary\_type \=== 'daily' ? '📅 Quotidien' : '🎯 Personnalisé'}  
              \</div\>  
              \<div className="summary-date"\>  
                {new Date(summary.created\_at).toLocaleDateString('fr-FR', {  
                  day: 'numeric',  
                  month: 'long',  
                  year: 'numeric',  
                  hour: '2-digit',  
                  minute: '2-digit'  
                })}  
              \</div\>  
            \</div\>

            \<div className="summary-info"\>  
              \<span className="articles-count"\>  
                📰 {summary.articles\_count} article{summary.articles\_count \> 1 ? 's' : ''}  
              \</span\>  
              \<span className="duration"\>  
                ⏱️ {Math.floor(summary.audio\_duration\_seconds / 60)}min {summary.audio\_duration\_seconds % 60}s  
              \</span\>  
              \<span className="credits"\>  
                💳 {summary.credits\_cost} crédits  
              \</span\>  
            \</div\>

            \<div className="summary-status"\>  
              {summary.status \=== 'completed' && (  
                \<span className="status-completed"\>✅ Complété\</span\>  
              )}  
              {summary.status \=== 'processing' && (  
                \<span className="status-processing"\>🔄 En cours...\</span\>  
              )}  
              {summary.status \=== 'failed' && (  
                \<span className="status-failed"\>❌ Échec\</span\>  
              )}  
                
              {summary.whatsapp\_sent && (  
                \<span className="whatsapp-sent"\>📱 Envoyé WhatsApp\</span\>  
              )}  
            \</div\>

            {summary.status \=== 'completed' && (  
              \<div className="summary-actions"\>  
                \<button   
                  className="btn-play"  
                  onClick={() \=\> window.open(summary.audio\_url, '\_blank')}  
                \>  
                  ▶️ Écouter  
                \</button\>  
                \<button   
                  className="btn-download"  
                  onClick={() \=\> {  
                    const a \= document.createElement('a');  
                    a.href \= summary.audio\_url;  
                    a.download \= \`resume-${summary.id}.wav\`;  
                    a.click();  
                  }}  
                \>  
                  📥 Télécharger  
                \</button\>  
                \<button   
                  className="btn-resend"  
                  onClick={() \=\> resendToWhatsApp(summary.id)}  
                \>  
                  🔄 Renvoyer WhatsApp  
                \</button\>  
              \</div\>  
            )}

            {summary.error\_message && (  
              \<div className="error-message"\>  
                ⚠️ {summary.error\_message}  
              \</div\>  
            )}  
          \</div\>  
        ))}  
      \</div\>  
    \</div\>  
  );  
};

---

## **🎨 Styles CSS**

/\* Configuration audio \*/  
.audio-settings {  
  max-width: 800px;  
  margin: 0 auto;  
  padding: 2rem;  
}

.setting-item {  
  margin-bottom: 1.5rem;  
  padding: 1rem;  
  background: \#f8f9fa;  
  border-radius: 8px;  
}

.setting-item label {  
  display: flex;  
  align-items: center;  
  gap: 0.5rem;  
  font-weight: 500;  
}

.setting-item input\[type="checkbox"\] {  
  width: 20px;  
  height: 20px;  
  cursor: pointer;  
}

.setting-item input\[type="time"\],  
.setting-item input\[type="tel"\] {  
  width: 100%;  
  padding: 0.5rem;  
  margin-top: 0.5rem;  
  border: 1px solid \#ddd;  
  border-radius: 4px;  
  font-size: 1rem;  
}

/\* Liste articles avec sélection \*/  
.articles-header {  
  display: flex;  
  justify-content: space-between;  
  align-items: center;  
  margin-bottom: 2rem;  
  padding: 1rem;  
  background: linear-gradient(135deg, \#ff8c00, \#ff7700);  
  color: white;  
  border-radius: 12px;  
}

.audio-actions {  
  display: flex;  
  align-items: center;  
  gap: 1rem;  
}

.selected-count {  
  font-weight: 600;  
  background: rgba(255,255,255,0.2);  
  padding: 0.5rem 1rem;  
  border-radius: 20px;  
}

.btn-generate-audio {  
  padding: 0.75rem 1.5rem;  
  background: white;  
  color: \#ff8c00;  
  border: none;  
  border-radius: 50px;  
  font-weight: 600;  
  cursor: pointer;  
  transition: all 0.3s ease;  
}

.btn-generate-audio:hover:not(:disabled) {  
  transform: translateY(-2px);  
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);  
}

.btn-generate-audio:disabled {  
  opacity: 0.5;  
  cursor: not-allowed;  
}

/\* Cards articles avec checkbox \*/  
.article-card {  
  position: relative;  
  padding: 1rem;  
  padding-left: 3rem;  
  background: white;  
  border: 2px solid \#e5e5e5;  
  border-radius: 12px;  
  transition: all 0.3s ease;  
}

.article-card input\[type="checkbox"\] {  
  position: absolute;  
  left: 1rem;  
  top: 1rem;  
  width: 20px;  
  height: 20px;  
  cursor: pointer;  
}

.article-card:has(input:checked) {  
  border-color: \#ff8c00;  
  background: \#fff5f0;  
}

/\* Historique résumés \*/  
.audio-history {  
  max-width: 1200px;  
  margin: 0 auto;  
  padding: 2rem;  
}

.summaries-list {  
  display: grid;  
  gap: 1.5rem;  
}

.summary-card {  
  background: white;  
  border: 1px solid \#e5e5e5;  
  border-radius: 12px;  
  padding: 1.5rem;  
  transition: all 0.3s ease;  
}

.summary-card:hover {  
  box-shadow: 0 4px 12px rgba(255, 140, 0, 0.1);  
  border-color: \#ff8c00;  
}

.summary-header {  
  display: flex;  
  justify-content: space-between;  
  align-items: center;  
  margin-bottom: 1rem;  
  padding-bottom: 1rem;  
  border-bottom: 1px solid \#e5e5e5;  
}

.summary-type {  
  font-size: 1.1rem;  
  font-weight: 600;  
  color: \#ff8c00;  
}

.summary-date {  
  color: \#666;  
  font-size: 0.9rem;  
}

.summary-info {  
  display: flex;  
  gap: 1.5rem;  
  margin-bottom: 1rem;  
  flex-wrap: wrap;  
}

.summary-info span {  
  padding: 0.5rem 1rem;  
  background: \#f8f9fa;  
  border-radius: 20px;  
  font-size: 0.9rem;  
}

.summary-status {  
  display: flex;  
  gap: 0.5rem;  
  margin-bottom: 1rem;  
}

.status-completed {  
  color: \#00cc66;  
  font-weight: 600;  
}

.status-processing {  
  color: \#ff8c00;  
  font-weight: 600;  
}

.status-failed {  
  color: \#dc3545;  
  font-weight: 600;  
}

.whatsapp-sent {  
  color: \#25D366;  
  font-weight: 600;  
}

.summary-actions {  
  display: flex;  
  gap: 0.5rem;  
  flex-wrap: wrap;  
}

.summary-actions button {  
  padding: 0.5rem 1rem;  
  border: 1px solid \#ddd;  
  border-radius: 6px;  
  background: white;  
  cursor: pointer;  
  transition: all 0.2s ease;  
}

.summary-actions button:hover {  
  background: \#f8f9fa;  
  border-color: \#ff8c00;  
}

.btn-play {  
  color: \#ff8c00;  
  font-weight: 600;  
}

.error-message {  
  margin-top: 1rem;  
  padding: 0.75rem;  
  background: \#fff3cd;  
  border: 1px solid \#ffc107;  
  border-radius: 6px;  
  color: \#856404;  
}

/\* Responsive \*/  
@media (max-width: 768px) {  
  .articles-header {  
    flex-direction: column;  
    gap: 1rem;  
  }

  .audio-actions {  
    flex-direction: column;  
    width: 100%;  
  }

  .btn-generate-audio {  
    width: 100%;  
  }

  .summary-header {  
    flex-direction: column;  
    align-items: flex-start;  
    gap: 0.5rem;  
  }

  .summary-info {  
    flex-direction: column;  
    gap: 0.5rem;  
  }  
}

---

## **🔧 Variables d'environnement**

\# .env  
\# Replicate (Kokoro TTS)  
REPLICATE\_API\_TOKEN=r8\_xxx

\# OpenAI (GPT-4 pour optimisation scripts)  
OPENAI\_API\_KEY=sk-xxx

\# Whapi (WhatsApp)  
WHAPI\_TOKEN=xxx

\# Supabase  
SUPABASE\_URL=https://xxx.supabase.co  
SUPABASE\_SERVICE\_ROLE\_KEY=xxx

\# Configuration audio  
AUDIO\_STORAGE\_BUCKET=audio-summaries  
MAX\_AUDIO\_DURATION\_SECONDS=600  
DEFAULT\_VOICE=af\_nicole

---

## **📦 Installation et déploiement**

### **1\. Installer dépendances**

npm install replicate @supabase/supabase-js node-cron express

### **2\. Créer bucket Supabase Storage**

\-- Dans Supabase Dashboard \> Storage  
\-- Créer bucket "audio-summaries" (public)

\-- Politique d'accès  
CREATE POLICY "Les utilisateurs peuvent lire leurs audios"  
ON storage.objects FOR SELECT  
USING (bucket\_id \= 'audio-summaries' AND auth.uid()::text \= (storage.foldername(name))\[1\]);

CREATE POLICY "Service role peut tout faire"  
ON storage.objects FOR ALL  
USING (bucket\_id \= 'audio-summaries');

### **3\. Initialiser tables**

\# Exécuter les scripts SQL de création de tables  
psql $DATABASE\_URL \< migrations/audio\_summaries.sql

### **4\. Configurer cron job**

// server.js  
import './jobs/dailyAudioSummaries.js';

### **5\. Tester en local**

\# Test génération personnalisée  
curl \-X POST http://localhost:3000/api/audio-summary/custom \\  
  \-H "Content-Type: application/json" \\  
  \-H "Authorization: Bearer YOUR\_TOKEN" \\  
  \-d '{"articleIds": \["uuid1", "uuid2"\]}'

---

## **🎯 Checklist de déploiement**

### **Backend**

* \[ \] Variables d'environnement configurées  
* \[ \] Tables Supabase créées  
* \[ \] Bucket Storage créé et configuré  
* \[ \] API Replicate testée  
* \[ \] API Whapi testée  
* \[ \] Cron job configuré  
* \[ \] Système de crédits intégré

### **Frontend**

* \[ \] Page configuration audio  
* \[ \] Bouton génération personnalisée  
* \[ \] Historique résumés audio  
* \[ \] Affichage coût en crédits  
* \[ \] Player audio intégré  
* \[ \] Notifications WhatsApp

### **Tests**

* \[ \] Génération quotidienne automatique  
* \[ \] Génération personnalisée à la demande  
* \[ \] Envoi WhatsApp  
* \[ \] Débit crédits correct  
* \[ \] Gestion erreurs API  
* \[ \] Performance (temps génération)

---

## **📊 Monitoring et métriques**

// Métriques à suivre  
const AUDIO\_METRICS \= {  
  // Performance  
  average\_generation\_time: 'Temps moyen génération (secondes)',  
  success\_rate: 'Taux de succès génération (%)',  
    
  // Business  
  daily\_summaries\_sent: 'Résumés quotidiens envoyés/jour',  
  custom\_summaries\_generated: 'Résumés personnalisés/jour',  
  credits\_consumed: 'Crédits consommés pour audio/jour',  
    
  // Qualité  
  whatsapp\_delivery\_rate: 'Taux livraison WhatsApp (%)',  
  user\_satisfaction: 'Note satisfaction (si collectée)',  
    
  // Technique  
  replicate\_api\_errors: 'Erreurs API Replicate',  
  whapi\_errors: 'Erreurs API Whapi',  
  storage\_usage: 'Espace Storage utilisé (MB)'  
};

---

## **🚨 Gestion erreurs et limites**

### **Rate limits**

const RATE\_LIMITS \= {  
  replicate: {  
    requests\_per\_minute: 60,  
    concurrent\_requests: 5  
  },  
  whapi: {  
    messages\_per\_hour: 100  
  }  
};

### **Retry logic**

async function generateWithRetry(text, voice, maxRetries \= 3\) {  
  for (let i \= 0; i \< maxRetries; i++) {  
    try {  
      return await generateAudioSummary(text, voice);  
    } catch (error) {  
      if (i \=== maxRetries \- 1\) throw error;  
      console.log(\`Tentative ${i \+ 1} échouée, retry dans 5s...\`);  
      await new Promise(resolve \=\> setTimeout(resolve, 5000));  
    }  
  }  
}

---

## **💡 Améliorations futures**

### **Court terme**

* \[ \] Support voix masculines/féminines multiples  
* \[ \] Vitesse de lecture ajustable  
* \[ \] Transcription audio pour accessibilité  
* \[ \] Partage direct sur réseaux sociaux

### **Moyen terme**

* \[ \] Playlist audio personnalisée  
* \[ \] Podcasts thématiques automatiques  
* \[ \] Integration Spotify/Apple Podcasts  
* \[ \] Résumés audio en langues locales (Fang, etc.)

### **Long terme**

* \[ \] IA vocale clonée pour présentateurs  
* \[ \] Format vidéo avec sous-titres  
* \[ \] Radio Gabon 24/7 en direct  
* \[ \] Sponsoring audio publicitaire

---

## **📞 Support et ressources**

### **Documentation APIs**

* **Replicate Kokoro**: https://replicate.com/jaaari/kokoro-82m  
* **Whapi**: https://whapi.cloud/docs  
* **OpenAI GPT-4**: https://platform.openai.com/docs  
* **Supabase Storage**: https://supabase.com/docs/guides/storage

### **Communauté**

* Discord Gabon 24/7 Dev Team  
* Slack channel \#audio-feature

---

**Timeline estimée**: 3-4 semaines  
 **Budget API mensuel estimé**: 50,000 \- 150,000 FCFA  
 **ROI attendu**: Break-even à 500 résumés premium/mois

