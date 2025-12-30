C'est une excellente évolution de l'architecture. Passer par Supabase (votre "Single Source of Truth") est beaucoup plus robuste que de relire le RSS, car vous avez la garantie d'envoyer uniquement ce qui a été validé et enrichi par votre IA.

Voici les deux éléments demandés :

### **1\. Le JSON Payload pour tester l'envoi d'Image**

Pour tester via Postman, Thunder Client ou l'interface de test de Whapi, utilisez ces paramètres.

* **Endpoint :** https://gate.whapi.cloud/messages/image  
* **Method :** POST  
* **Headers :**  
  * Content-Type: application/json  
  * Authorization: Bearer VOTRE\_TOKEN\_WHAPI

**Body (JSON) :**

JSON

{  
    "to": "120363161XXXXX471@newsletter",  
    "media": "https://votre-site.com/chemin/vers/image.jpg",  
    "caption": "\*Titre de l'Article Enrichi\*\\n\\nVoici le résumé généré par l'IA qui donne les points clés de l'actualité...\\n\\n🔗 Lire l'article complet : https://lien-vers-larticle.com",  
    "width": 100,  
    "height": 100  
}

**Notes importantes pour le test :**

* **to** : Remplacez par votre ID de chaîne (@newsletter).  
* **media** : L'URL doit être une image publique accessible (jpg, png). Whapi va la télécharger pour l'envoyer.  
* **caption** : C'est ici que vous mettez votre texte. Le \\n permet de faire des sauts de ligne.

---

### **2\. Le Prompt Optimisé pour Cascade / Windsurf (Supabase \+ Whapi)**

Ce prompt est structuré pour que l'IA comprenne qu'elle doit interagir avec votre base de données existante et gérer l'état des envois (pour ne pas spammer les anciens articles).

**Copiez ce bloc pour votre assistant :**

"Agis comme un développeur Backend Senior. Je veux créer un script (Node.js/TypeScript) pour automatiser l'envoi d'actualités vers une chaîne WhatsApp via l'API Whapi.cloud.

Architecture des données (Supabase) :

J'ai une table articles dans Supabase.

Les articles sont déjà insérés et enrichis par une autre IA.

Colonnes supposées (adapte le code si besoin) :

* id (int/uuid)  
* title (text)  
* ai\_summary (text : le résumé enrichi par IA)  
* image\_url (text)  
* original\_url (text)  
* is\_enriched (boolean : true quand l'IA a fini son travail)  
* whatsapp\_sent (boolean : false par défaut, true une fois envoyé)

**Le Flux de travail du script :**

1. **Initialisation :** Configure le client @supabase/supabase-js et axios.  
2. **Requête DB :** Sélectionne les articles où is\_enriched est TRUE et whatsapp\_sent est FALSE. Limite à 5 articles par exécution pour éviter le flood.  
3. **Boucle d'envoi :** Pour chaque article trouvé :  
   * Prépare le payload pour Whapi.  
   * Utilise l'endpoint /messages/image si image\_url est présent, sinon utilise /messages/text.  
   * Formate le message : "*\[Titre\]* \\n\\n \[ai\_summary\] \\n\\n 🔗 \[original\_url\]".  
   * Envoie la requête POST à Whapi.  
4. **Mise à jour DB :** Si l'envoi Whapi est un succès (status 200), met à jour la ligne de l'article dans Supabase pour passer whatsapp\_sent à TRUE.  
5. **Sécurité & Logs :**  
   * Ajoute un délai (sleep) de 5 secondes entre chaque envoi pour respecter les limites de débit.  
   * Log les succès et les erreurs dans la console.

**Variables d'environnement (.env) :**

* SUPABASE\_URL  
* SUPABASE\_KEY (Service Role pour pouvoir écrire)  
* WHAPI\_TOKEN  
* WHAPI\_CHANNEL\_ID

Génère le code complet et modulaire, prêt à être déployé (par exemple via une GitHub Action ou un Cron Job)."

---

### **Conseil pour votre table Supabase**

Avant de lancer le script généré, assurez-vous d'avoir ajouté la colonne de "flag" dans votre table articles pour éviter les doublons.

Vous pouvez exécuter ceci dans l'éditeur SQL de Supabase :

SQL

ALTER TABLE articles  
ADD COLUMN whatsapp\_sent BOOLEAN DEFAULT FALSE;

Voulez-vous que je vous explique comment configurer ce script pour qu'il tourne automatiquement toutes les heures (via les Edge Functions de Supabase ou un Cron externe) ?

Voici un guide technique structuré en français, basé sur la transcription de l'équipe Whapi.cloud.

Ce guide explique comment automatiser la gestion et l'envoi de messages sur des chaînes WhatsApp (Channels) via leur API.

---

# **Guide d'Automatisation des Chaînes WhatsApp avec l'API Whapi.cloud**

Ce guide couvre la configuration initiale, la création de chaînes, la récupération des identifiants et l'envoi de messages (texte et média) pour des cas d'usage comme le marketing ou la communication interne.

## **1\. Prérequis et Connexion**

Avant d'utiliser l'API, vous devez lier un compte WhatsApp à Whapi.

1. Connectez-vous à votre tableau de bord **Whapi.cloud**.  
2. Scannez le **QR Code** affiché avec votre application mobile WhatsApp (comme pour WhatsApp Web).  
3. Donnez un nom à la session (c'est une info système interne).  
4. Ignorez la section des paramètres (settings) si vous n'êtes pas développeur de bot conversationnel complexe.  
5. **Important :** Copiez votre **Jeton API (API Token)** présent sur la page du canal autorisé. Il sera nécessaire pour toutes les requêtes (Header Authorization).

---

## **2\. Créer une Chaîne via l'API (Optionnel)**

Vous pouvez créer une chaîne programmatiquement au lieu de le faire sur le mobile.

* **Endpoint :** create newsletter  
* **Méthode :** POST  
* **Header :** Authorization: Bearer VOTRE\_TOKEN  
* **Body (JSON) :**  
  * channel\_name : Le nom de votre chaîne.  
  * description : La description visible par les utilisateurs.

Une fois la requête envoyée, l'API renvoie les détails de la chaîne créée. Vous pouvez vérifier sa présence immédiate dans votre application WhatsApp.

---

## **3\. Récupérer l'ID de la Chaîne (Crucial)**

Pour envoyer des messages, vous devez connaître l'identifiant unique (ID) de la chaîne.

* **Endpoint :** get newsletters  
* **Méthode :** GET  
* **Action :** Cette requête retourne la liste de toutes les chaînes dont vous êtes membre ou administrateur.  
* **Résultat :** Repérez l'ID de la chaîne cible dans la réponse JSON. Copiez-le.

---

## **4\. Envoyer un Message Texte**

Une fois l'ID en main, vous pouvez publier du contenu.

* **Endpoint :** send text message  
* **Méthode :** POST  
* **Paramètres requis (Body) :**  
  * to : Collez ici l'ID de la chaîne récupéré à l'étape 3\.  
  * body : Le texte de votre message.  
* **Vérification :** Exécutez la requête. La réponse confirmera l'envoi et le message apparaîtra instantanément sur la chaîne WhatsApp.

---

## **5\. Envoyer une Image (Média)**

Pour rendre les posts plus engageants, l'API permet l'envoi d'images.

* **Endpoint :** send media image message  
* **Méthode :** POST  
* **Paramètres requis (Body) :**  
  * to : L'ID de la chaîne.  
  * media : Vous avez deux options :  
    1. Une **URL directe** vers l'image.  
    2. Une chaîne **Base64** (Whapi propose un outil d'encodage si besoin).  
* **Ajouter une légende (Caption) :**  
  * Ajoutez le paramètre caption dans le corps de la requête pour accompagner l'image d'un texte.

---

## **Résumé des fonctionnalités API**

L'API Whapi.cloud permet non seulement d'envoyer du texte et des images, mais aussi :

* Des vidéos.  
* Des sondages (polls).  
* D'envoyer des invitations.  
* D'assigner des administrateurs.  
* De récupérer l'historique des posts d'autres chaînes.

**Note :** N'oubliez jamais d'inclure votre Token API dans le Header de chaque requête pour l'authentification.

\# Send post to WhatsApp Channel

{% embed url="\<https://youtu.be/IVxsndTXp-4\>" %}

Our Cloud API supports WhatsApp Channels, a brand-new feature introduced by WhatsApp. It’s a unidirectional broadcast tool where administrators can send text, photos, videos, stickers, and polls. And users receive push notifications of updates from the channel like a private message.

To send a message to the channel you need to know the channel ID.

In order to find out the identifier use the following method: \[GET /newsletters\](https://whapi.readme.io/reference/getnewsletters)

\`\`\`sh  
curl \--request GET \\  
     \--url 'https://gate.whapi.cloud/newsletters?count=100' \\  
     \--header 'accept: application/json' \\  
     \--header 'authorization: Bearer iB1vpNBhV4sbdSPwVwcczBDCXo2bBmcs'  
\`\`\`

The channel ID looks like this: \`120363171744447809@newsletter\`&\#x20;

Once you know the channel ID, you can use the method to send any message. For example, a text message:&\#x20;

{% embed url="\<https://whapi.readme.io/reference/sendmessagetext\>" %}

In the \`“to”\` parameter you insert the ID of the channel ( \`120363171744447809@newsletter\` ) you want to send the message to. And in the \`“body”,\` the text of the message

\`\`\`sh  
curl \--request POST \\  
     \--url https://gate.whapi.cloud/messages/text \\  
     \--header 'accept: application/json' \\  
     \--header 'authorization: Bearer iB1vpNBhVwc4sbdSPwczBDVCXo2bBmcs' \\  
     \--header 'content-type: application/json' \\  
     \--data '  
{  
  "typing\_time": 0,  
  "to": "120208836317406034@newsletter",  
  "body": "Hello, World\!"  
}  
'  
\`\`\`

\# Send message with Buttons

{% hint style="warning" %}  
Button message functionality is currently provided on an 'as-is' basis due to its inherent instability and dependency on Meta's updates. Please be aware that with each new WhatsApp update, the behavior of button messages may change.

For more details, visit the \[Button Status\](https://support.whapi.cloud/help-desk/faq/current-status-of-buttons-on-whatsapp) topic.  
{% endhint %}

Peculiarities when working with buttons:

\* the button name can have no more than 25 characters;  
\* there can be no more than 3 buttons of this type;  
\* the button can be pressed only 1 time.  
\* for current nuances of button display, see the article \[current-status-of-buttons-on-whatsapp\](https://support.whapi.cloud/help-desk/faq/current-status-of-buttons-on-whatsapp "mention")

You can send a message with the button to either private chat or group chat. The buttons, e.g. YES / NO, can be selected by the user and used as a response to the sent message.

\#\#\# Types of buttons

There are four types of buttons on WhatsApp:

\* Simple text button (Quick-reply)  
\* List of options  
\* Link Button  
\* OTP Button (Copy Button)  
\* Call Button

{% embed url="\<https://whapi.readme.io/reference/sendmessageinteractive\>" %}  
Endpoint for sending messages with different buttons  
{% endembed %}

Sending requires a request to be made to:

\`POST https://gate.whapi.cloud/messages/interactive\`

\*\*\*

\#\#\# Message with auto-reply buttons

\<figure\>\<img src="https://2417185145-files.gitbook.io/\~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FhsdgGmVCG31mEaHyRvxC%2Fuploads%2FfKyWJ6Sr7D888ZkwfQ8l%2Fimage.png?alt=media&\#x26;token=28bb9951-84d5-4096-a991-6abe093b0cb8" alt="" width="369"\>\<figcaption\>\<p\>Example of a message with quick reply buttons.\</p\>\</figcaption\>\</figure\>

\`\`\`json  
curl \--request POST \\  
     \--url https://gate.whapi.cloud/messages/interactive \\  
     \--header 'accept: application/json' \\  
     \--header 'authorization: Bearer {Your\_Token}' \\  
     \--header 'content-type: application/json' \\  
     \--data '  
{  
  "header": {  
    "text": "Header with text"  
  },  
  "body": {  
    "text": "Body message"  
  },  
  "footer": {  
    "text": "Footer message"  
  },  
  "action": {  
    "buttons": \[  
      {  
        "type": "quick\_reply",  
        "title": "Button1",  
        "id": "randomId1"  
      },  
      {  
        "type": "quick\_reply",  
        "title": "Button2",  
        "id": "randomId2"  
      }  
    \]  
  },  
  "type": "button",  
  "to": "61371989950"  
}  
'  
\`\`\`

When the recipient clicks on a button, it automatically sends a reply to your message containing the button’s text. If you've set up a webhook for the channel, you'll receive a callback with both the button ID and the text.

\<pre class="language-json"\>\<code class="lang-json"\>{  
  "messages": \[  
    {  
      "id": "g0jEG0ZsSobn4yNGGU3TAg-gDYOS60TLw",  
      "from\_me": false,  
      "type": "reply",  
      "chat\_id": "61371989950@s.whatsapp.net",  
      "timestamp": 1726126124,  
      "source": "mobile",  
      "chat\_name": "Jonathan Customer",  
      "reply": {  
        "type": "buttons\_reply",  
        "buttons\_reply": {  
          "id": "ButtonsV3:\<a data-footnote-ref href="\#user-content-fn-1"\>randomId1\</a\>",  
          "title": "\<a data-footnote-ref href="\#user-content-fn-1"\>Button1\</a\>"  
        }  
      },  
      "context": {  
        "quoted\_id": "yqKj.Z7XWg0g1lA-wD8Sij1GoQ",  
        "quoted\_author": "919984351847",  
        "quoted\_content": {  
          "header": "Header with text",  
          "body": "Body message",  
          "footer": "Footer message",  
          "buttons": \[  
            {  
              "type": "quick\_reply",  
              "text": "Button1",  
              "id": "ButtonsV3:randomId1"  
            },  
            {  
              "type": "quick\_reply",  
              "text": "Button2",  
              "id": "ButtonsV3:randomId2"  
            }  
          \]  
        },  
        "quoted\_type": "hsm"  
      },  
      "from": "61371989950",  
      "from\_name": "Jonathan"  
    }  
  \],  
  "event": {  
    "type": "messages",  
    "event": "post"  
  },  
  "channel\_id": "MANTIS-PF238"  
}  
\</code\>\</pre\>

Note that the callback may be slightly different if the customer clicked the button in Web WhatsApp:

\<pre class="language-json"\>\<code class="lang-json"\>{  
  "messages": \[  
    {  
      "id": "g0jEG0ZsSobn4yNGGU3TAg-gDYOS60TLw",  
      "from\_me": false,  
      "type": "reply",  
      "chat\_id": "61371989950@s.whatsapp.net",  
      "timestamp": 1726126124,  
      "source": "mobile",  
      "chat\_name": "Jonathan Customer",  
      "reply": {  
        "type": "buttons\_reply",  
        "buttons\_reply": {  
          "id": "ButtonsV3:\<a data-footnote-ref href="\#user-content-fn-1"\>randomId2\</a\>",  
          "title": "\<a data-footnote-ref href="\#user-content-fn-1"\>Button2\</a\>"  
        }  
      },  
      "context": {  
        "quoted\_id": "yqKj.Z7XWg0g1lA-wD8Sij1GoQ",  
        "quoted\_author": "919984351847",  
        "quoted\_content": {  
          "body": "Body message"  
        },  
        "quoted\_type": "text"  
      },  
      "from": "61371989950",  
      "from\_name": "Jonathan"  
    }  
  \],  
  "event": {  
    "type": "messages",  
    "event": "post"  
  },  
  "channel\_id": "MANTIS-PF238"  
}  
\</code\>\</pre\>

\#\#\# Message with Call button and Link button

\<figure\>\<img src="https://2417185145-files.gitbook.io/\~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FhsdgGmVCG31mEaHyRvxC%2Fuploads%2FCckqU69CFBHZDBzEkCnN%2Fimage.png?alt=media&\#x26;token=27ea0cbb-3161-4079-8373-1d6e336b9ed4" alt="" width="364"\>\<figcaption\>\<p\>Example of a message with callback buttons and a link to a third-party site\</p\>\</figcaption\>\</figure\>

\`\`\`json  
curl \--request POST \\  
     \--url https://gate.whapi.cloud/messages/interactive \\  
     \--header 'accept: application/json' \\  
     \--header 'authorization: Bearer {Your\_Token}' \\  
     \--header 'content-type: application/json' \\  
     \--data '  
{  
  "header": {  
    "text": "Header with text"  
  },  
  "body": {  
    "text": "Body message"  
  },  
  "footer": {  
    "text": "Footer message"  
  },  
  "action": {  
    "buttons": \[  
      {  
        "type": "call",  
        "title": "Call us",  
        "id": "randomId1",  
        "phone\_number": "61371989950"  
      },  
      {  
        "type": "url",  
        "title": "Look at the website",  
        "id": "randomId2",  
        "url": "https://whapi.cloud"  
      }  
    \]  
  },  
  "type": "button",  
  "to": "61371989950"  
}  
'  
\`\`\`

Unfortunately, WhatsApp does not track the event of clicking these buttons. Therefore, it is not possible to get a webhook for pressing these buttons.

\*\*\*

\#\#\# Message with copy button (OTP code)

\<figure\>\<img src="https://2417185145-files.gitbook.io/\~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FhsdgGmVCG31mEaHyRvxC%2Fuploads%2FpUgOaokeZxOv84Qhu0iq%2Fimage.png?alt=media&\#x26;token=cfb469e4-3539-48c4-be47-b6621f406b3c" alt=""\>\<figcaption\>\<p\>Example of a message with a button to copy hidden text\</p\>\</figcaption\>\</figure\>

You can pass any text to the snippet that will be copied after the button is clicked.

\`\`\`json  
curl \--request POST \\  
     \--url https://gate.whapi.cloud/messages/interactive \\  
     \--header 'accept: application/json' \\  
     \--header 'authorization: Bearer {Your\_Token}' \\  
     \--header 'content-type: application/json' \\  
     \--data '  
{  
  "header": {  
    "text": "Header with text"  
  },  
  "body": {  
    "text": "Body message"  
  },  
  "footer": {  
    "text": "Footer message"  
  },  
  "action": {  
    "buttons": \[  
      {  
        "type": "copy",  
        "title": "Copy OTP",  
        "id": "randomId1",  
        "copy\_code": "65545"  
      }  
    \]  
  },  
  "type": "button",  
  "to": "61371989950"  
}  
'  
\`\`\`

Unfortunately, WhatsApp does not track the event of clicking these buttons. Therefore, it is not possible to get a webhook for pressing these buttons.

\*\*\*

\#\#\# Message with list of options

\<div align="left"\>\<figure\>\<img src="https://2417185145-files.gitbook.io/\~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FhsdgGmVCG31mEaHyRvxC%2Fuploads%2FMb1TGT5O4NJebHWJwnEo%2Fimage.png?alt=media&\#x26;token=50a2b163-1021-4da0-b51b-7be4076c7d65" alt="" width="366"\>\<figcaption\>\<p\>Example of a message with a button with a list of options\</p\>\</figcaption\>\</figure\> \<figure\>\<img src="https://2417185145-files.gitbook.io/\~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FhsdgGmVCG31mEaHyRvxC%2Fuploads%2F3kIw5AjTMZEpyeECD9bu%2Fimage.png?alt=media&\#x26;token=ded3334f-a472-433e-bdf7-56233952d61a" alt="" width="247"\>\<figcaption\>\<p\>The list of options will expand if the user clicks on it.\</p\>\</figcaption\>\</figure\>\</div\>

\`\`\`json  
curl \--request POST \\  
     \--url https://gate.whapi.cloud/messages/interactive \\  
     \--header 'accept: application/json' \\  
     \--header 'authorization: Bearer {Your\_Token}' \\  
     \--header 'content-type: application/json' \\  
     \--data '  
{  
  "header": {  
    "text": "Header with text"  
  },  
  "body": {  
    "text": "Body message"  
  },  
  "footer": {  
    "text": "Footer message"  
  },  
"action": {  
    "list": {  
      "sections": \[  
        {  
          "title": "What's your favorite hamburger?",  
          "rows": \[  
            {  
              "title": "Hamburger without cheese",  
              "id": "r1",  
              "description": "A burger without cheese or sauce is often referred to as a \\"plain\\" burger."  
            },  
            {  
              "id": "r2",  
              "title": "Cheeseburger",  
              "description": "A cheeseburger is a hamburger with a slice of melted cheese on top of the meat patty"  
            }  
          \]  
        }  
      \],  
      "label": "Pick a hamburger\!"  
    }  
  },  
  "type": "list",  
  "to": "61371989950"  
}  
'  
\`\`\`

When the recipient clicks on a button, it automatically sends a reply to your message containing the button’s text. If you've set up a webhook for the channel, you'll receive a callback with both the button ID and the text.

\<pre class="language-json"\>\<code class="lang-json"\>{  
  "messages": \[  
    {  
      "id": "A5y7S8JfMsgaYiXZC6Royw-gMoOS60TLw",  
      "from\_me": false,  
      "type": "reply",  
      "chat\_id": "61371989950@s.whatsapp.net",  
      "timestamp": 1726127469,  
      "source": "mobile",  
      "chat\_name": "Jonathan Customer",  
      "reply": {  
        "type": "list\_reply",  
        "list\_reply": {  
          "id": "ListV3:\<a data-footnote-ref href="\#user-content-fn-1"\>r1\</a\>",  
          "title": "\<a data-footnote-ref href="\#user-content-fn-1"\>Hamburger without cheese\</a\>",  
          "description": "A burger without cheese or sauce is often referred to as a \\"plain\\" burger."  
        }  
      },  
      "context": {  
        "quoted\_id": "yqL1GxfdT7pX48I-wEASij1GoQ",  
        "quoted\_author": "919984351847",  
        "quoted\_content": {  
          "title": "Header with text",  
          "description": "Body message",  
          "label": "Pick a hamburger\!",  
          "footer": "Footer message",  
          "sections": \[  
            {  
              "title": "What's your favorite hamburger?",  
              "rows": \[  
                {  
                  "id": "ListV3:r1",  
                  "title": "Hamburger without cheese",  
                  "description": "A burger without cheese or sauce is often referred to as a \\"plain\\" burger."  
                },  
                {  
                  "id": "ListV3:r2",  
                  "title": "Cheeseburger",  
                  "description": "A cheeseburger is a hamburger with a slice of melted cheese on top of the meat patty"  
                }  
              \]  
            }  
          \]  
        },  
        "quoted\_type": "list"  
      },  
      "from": "61371989950",  
      "from\_name": "Jonathan"  
    }  
  \],  
  "event": {  
    "type": "messages",  
    "event": "post"  
  },  
  "channel\_id": "MANTIS-PF238"  
}  
\</code\>\</pre\>

\*\*\*

\#\# Send buttons with images

When using this endpoint, you can also send images containing interactive action buttons. The labels on these buttons, such as “YES” or “NO,” are selected by the user and serve as direct responses to the message transmitted using the buttons.

Sending requires a request to be made to:

\`POST https://gate.whapi.cloud/messages/interactive\`

The image can be transferred either via a direct link, \[Base64\](https://support.whapi.cloud/help-desk/send-video-audio-image-document\#sending-media-file-via-base64), or \[Media ID\](https://support.whapi.cloud/help-desk/send-video-audio-image-document\#sending-by-media-id).

\<div data-full-width="false"\>\<figure\>\<img src="https://2417185145-files.gitbook.io/\~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FhsdgGmVCG31mEaHyRvxC%2Fuploads%2FuEADtjBZUQAAwvWeHq5L%2Fphoto\_2025-09-16\_11-39-59.png?alt=media&\#x26;token=4e596d55-be80-4998-985f-10f515be6e25" alt="Send a message with buttons and an image to WhatsApp" width="288"\>\<figcaption\>\<p\>Send a message with buttons and an image\</p\>\</figcaption\>\</figure\>\</div\>

\`\`\`bash  
curl \--request POST \\  
     \--url https://gate.whapi.cloud/messages/interactive \\  
     \--header 'accept: application/json' \\  
     \--header 'authorization: Bearer {Your\_Token}' \\  
     \--header 'content-type: application/json' \\  
     \--data '  
{  
  "body": {  
    "text": "Hello. Take your pick\!"  
  },  
  "footer": {  
    "text": "After all, this is just an example"  
  },  
  "action": {  
    "buttons": \[  
      {  
        "type": "quick\_reply",  
        "title": "Point 1",  
        "id": "p1"  
      },  
      {  
        "type": "quick\_reply",  
        "title": "Point 2",  
        "id": "p2"  
      },  
      {  
        "type": "quick\_reply",  
        "title": "Point 3",  
        "id": "p3"  
      }  
    \]  
  },  
  "type": "button",  
  "to": "61371989950",  
  "media": "https://fileinfo.com/img/ss/xl/jpg\_44-2.jpg"  
}  
'  
\`\`\`

\*\*\*

\#\# Send Buttons with Video

This method allows you to send videos with action buttons. You can place up to three buttons with different content in a message, and whatever the user selects will be used as a response to the message sent along with the buttons.

Sending requires a request to be made to:

\`POST https://gate.whapi.cloud/messages/interactive\`

The video can be transferred either via a direct link, \[Base64\](https://support.whapi.cloud/help-desk/send-video-audio-image-document\#sending-media-file-via-base64), or \[Media ID\](https://support.whapi.cloud/help-desk/send-video-audio-image-document\#sending-by-media-id).

\<figure\>\<img src="https://2417185145-files.gitbook.io/\~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FhsdgGmVCG31mEaHyRvxC%2Fuploads%2FJZnGpKddqGTZ29Iz5qPk%2Fphoto\_2025-09-16\_11-48-33.png?alt=media&\#x26;token=646fe221-bbfc-4149-bd02-cf13086addf1" alt="" width="288"\>\<figcaption\>\<p\>Send a message with buttons and video\</p\>\</figcaption\>\</figure\>

\`\`\`bash  
curl \--request POST \\  
     \--url https://gate.whapi.cloud/messages/interactive \\  
     \--header 'accept: application/json' \\  
     \--header 'authorization: Bearer {Your\_Token}' \\  
     \--header 'content-type: application/json' \\  
     \--data '  
{  
  "body": {  
    "text": "Hello. Take your pick\!"  
  },  
  "footer": {  
    "text": "After all, this is just an example"  
  },  
  "action": {  
    "buttons": \[  
      {  
        "type": "quick\_reply",  
        "title": "Point 1",  
        "id": "p1"  
      },  
      {  
        "type": "quick\_reply",  
        "title": "Point 2",  
        "id": "p2"  
      },  
      {  
        "type": "quick\_reply",  
        "title": "Point 3",  
        "id": "p3"  
      }  
    \]  
  },  
  "type": "button",  
  "to": "61371989950",  
  "media": "https://download.samplelib.com/mp4/sample-5s.mp4",  
  "no\_encode": true  
}  
'  
\`\`\`

\*\*\*

\#\# Send Carousel

\*\*WhatsApp Carousel Messages\*\*

A \*\*carousel\*\* in WhatsApp is an interactive message format. It allows sending up to \*\*10 cards\*\* in a single message — each containing an image or video, text, and \*\*interactive buttons.\*\* Using action buttons, you can redirect to links, make calls, and also provide standard responses.

\<figure\>\<img src="https://2417185145-files.gitbook.io/\~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FhsdgGmVCG31mEaHyRvxC%2Fuploads%2FK1GHVakN857PwBKqKQ35%2FWEB.png?alt=media&\#x26;token=60d6a046-5ae0-4dc7-bfd3-0815f991e2ba" alt=""\>\<figcaption\>\<p\>Displaying the carousel in Web WhatsApp\</p\>\</figcaption\>\</figure\>

This format is ideal for showcasing \*\*products, services, or catalogs\*\*, enabling recipients to swipe through multiple cards within one message. It provides a clear and engaging way to organize and present visual content or offer users interactive choices.

\<figure\>\<img src="https://2417185145-files.gitbook.io/\~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FhsdgGmVCG31mEaHyRvxC%2Fuploads%2Fq69dRMBx2M7yDZYWhjcb%2Fphoto\_2025-10-13\_17-20-55.jpg?alt=media&\#x26;token=567dec4a-4278-41f2-9bec-212c44cf7ee9" alt="" width="288"\>\<figcaption\>\<p\>Displaying the carousel in the WhatsApp app on phone\</p\>\</figcaption\>\</figure\>

This endpoint is responsible for sending messages with carousel:&\#x20;

\`POST https://gate.whapi.cloud/messages/carousel\`

Example of request payload:

\`\`\`json  
{  
  "body": {  
    "text": "Hey, we're having a big sale today, be sure to check it out\! 👇"  
  },  
  "to": "61371989950",  
  "cards": \[  
    {  
      "media": {  
        "media": "https://as1.ftcdn.net/v2/jpg/16/63/78/04/1000\_F\_1663780499\_vMDTzHPYceR3VReJGYm1mYiiwLdHTrfP.jpg"  
      },  
      "text": "Just click on the button to visit our catalog",  
      "id": "Card-ID1",  
      "buttons": \[  
        {  
          "type": "url",  
          "title": "Website link",  
          "id": "Button-ID1",  
          "url": "https://yourdomain.com/"  
        }  
      \]  
    },  
    {  
      "media": {  
        "media": "https://t3.ftcdn.net/jpg/15/92/71/94/240\_F\_1592719402\_Fxu8hyWHmVUzIkSOQstoZnEhQSXsqR7S.jpg"  
      },  
      "text": "This product has already won over many people\! It truly has no equal. Do you know why? No? Then click on the button below and our bot will tell you everything\! 💥",  
      "id": "Card-ID2",  
      "buttons": \[  
        {  
          "type": "quick\_reply",  
          "title": "Button text 2",  
          "id": "Button-ID2"  
        }  
      \]  
    },  
    {  
      "media": {  
        "media": "https://t3.ftcdn.net/jpg/15/80/60/18/240\_F\_1580601875\_0a4XG63mcTPUaGKaopR7bdLz3kkBrxU5.jpg"  
      },  
      "text": "Card text 3",  
      "id": "Card-ID3",  
      "buttons": \[  
        {  
          "type": "quick\_reply",  
          "title": "Button text 3",  
          "id": "Button-ID3"  
        }  
      \]  
    }  
  \]  
}  
\`\`\`

{% embed url="\<https://whapi.readme.io/reference/sendmessagecarousel\>" %}

\*\*\*

We continue to explore WhatsApp's capabilities and add to our methods for automation. In the upcoming updates we will have the ability to send messages with picture/media and buttons.

If you have any questions, our team is always available to help you.

\[^1\]: You can use this information to identify the selected response.

