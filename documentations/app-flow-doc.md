# Application Flow Document
## GabonNews WhatsApp SaaS

### 1. User Onboarding Flow

#### WhatsApp Channel Registration (Free)
```
START
  ↓
User finds WhatsApp Channel link
  ↓
Clicks "Rejoindre la chaîne"
  ↓
Automatically subscribed to channel
  ↓
Receives welcome message
  ↓
END → Receives daily news broadcasts
```

#### Premium WhatsApp Registration
```
START
  ↓
User visits website or sends "PREMIUM" to WhatsApp
  ↓
System checks if number exists
  ↓
[New User?]
  → YES: Create account flow
      ↓
      Send service description with tiers:
      - FREE: Channel access only
      - PREMIUM: 2,500 XAF - Personal messages + filters
      - JOURNALIST: 5,000 XAF - Editorial tools
      ↓
      [User selects PREMIUM/JOURNALIST]
      ↓
      Request mobile money number
      ↓
      Initialize payment
      ↓
      [Payment successful?]
      → NO: Retry or stay on FREE
      → YES: Activate features
          ↓
          IF PREMIUM:
            → Setup keyword filters
            → Choose categories
            → Set delivery preferences
          IF JOURNALIST:
            → Create editorial profile
            → Access dashboard credentials
      ↓
  → NO: Show current status
      ↓
END → Premium features activated
```

#### Journalist Portal Registration
```
START
  ↓
User visits /journalist-portal
  ↓
Enter credentials or register
  ↓
Verify journalist status (media affiliation)
  ↓
OTP verification via WhatsApp
  ↓
[Verified?]
  → YES: Grant access to editorial tools
      ↓
      Setup editorial preferences:
      - Publication name
      - Editorial schedule
      - Content categories
      - Team members (if applicable)
      ↓
      Tutorial for editorial tools
      ↓
END → Access to journalist dashboard
```

#### Web Dashboard Registration
```
START
  ↓
User visits web portal
  ↓
Click "S'inscrire"
  ↓
Enter WhatsApp number
  ↓
Receive OTP via WhatsApp
  ↓
[OTP Valid?]
  → NO: Retry (max 3 attempts) → Block for 24h
  → YES: Continue
      ↓
      Complete profile (email, name)
      ↓
      Select subscription plan
      ↓
      Payment processing
      ↓
      Account activation
      ↓
END → Dashboard Access
```

### 2. Main Application Flow

#### RSS Feed Management Flow
```
START (Admin Interface)
  ↓
Admin accesses RSS Feed Manager
  ↓
Options:
  1. Add New Feed
  2. Edit Existing Feed
  3. Monitor Feed Health
  ↓
[Add New Feed?]
  → Enter RSS URL
  → Enter Media Name (e.g., "Gabon Media Time")
  → Select Category
  → Test Feed Connection
  → [Feed Valid?]
    → NO: Show error, request correction
    → YES: Save to database
        ↓
        Schedule immediate fetch
        ↓
END → Feed added to monitoring
```

#### News Distribution Pipeline
```
START (Cron Job every 5 minutes)
  ↓
Fetch all active RSS feeds
  ↓
For each new article:
  ↓
  Check if article exists
  ↓
  [New article?]
  → YES: Process with GPT-5
      ↓
      Generate summary
      ↓
      Extract keywords
      ↓
      Store in Supabase
      ↓
      // Distribution Split
      ↓
      [WhatsApp Channel Distribution]
      → Queue for channel broadcast
      → Aggregate with other articles
      → Send at scheduled times (8h, 12h, 18h)
      ↓
      [Premium User Distribution]
      → Match against user filters/keywords
      → Queue for individual delivery
      → Send immediately or per user schedule
      ↓
END → Articles distributed
```

#### Journalist Editorial Creation Flow
```
START
  ↓
Journalist logs into portal
  ↓
Select "Créer une Matinale" or "Créer un Éditorial"
  ↓
[Article Selection Interface]
  → View today's articles by:
    - Media source
    - Category
    - Time published
    - Trending topics
  ↓
Select articles for editorial (drag & drop)
  ↓
Choose editorial type:
  1. Matinale (Morning brief)
  2. Analyse thématique
  3. Revue de presse
  ↓
[GPT-5 Editorial Generation]
  → Send selected articles to GPT-5
  → Prompt for editorial style
  → Generate:
    - Introduction
    - Article summaries with context
    - Analysis/Commentary
    - Conclusion
  ↓
[Editorial Review]
  → Preview generated content
  → Edit manually if needed
  → Add journalist notes
  ↓
[Publishing Options]
  → Schedule for WhatsApp Channel
  → Export as PDF
  → Send to email list
  → Generate social media posts
  ↓
END → Editorial published
```

#### Message Distribution Flow
```
START (Queue Processor - Continuous)
  ↓
Get next batch from queue (100 messages)
  ↓
For each message:
  ↓
  Check user preferences:
  - Active subscription?
  - Delivery time window?
  - Daily limit reached?
  ↓
  [Can send?]
  → NO: Reschedule or skip
  → YES: Format message
      ↓
      Add ads if FREE tier
      ↓
      Send via Whapi API
      ↓
      [Delivery successful?]
      → NO: Retry logic
          - Attempt 1: Wait 30s
          - Attempt 2: Wait 2min
          - Attempt 3: Wait 10min
          - Failed: Log and notify admin
      → YES: Update delivery status
          ↓
          Log analytics
          ↓
END → Process next message
```

### 3. User Interaction Flows

#### WhatsApp Command Processing
```
START (User sends message)
  ↓
Parse command
  ↓
[Valid command?]
  → NO: Send help menu
  → YES: Process command
      ↓
      Commands:
      - STOP: Pause subscription
      - START: Resume subscription
      - VEILLE [keywords]: Set monitoring keywords
      - CATEGORIES: Update news preferences
      - AIDE: Show help menu
      - STATUT: Show subscription status
      - HISTORIQUE: Last 10 articles
      - RECHERCHE [query]: Search articles
      ↓
      Execute command logic
      ↓
      Update database
      ↓
      Send confirmation
      ↓
END
```

#### Keyword Monitoring Setup
```
START
  ↓
User sends "VEILLE" command
  ↓
[Has active subscription?]
  → NO: Prompt to upgrade
  → YES: Continue
      ↓
      Request keywords (comma-separated)
      ↓
      Validate keywords (max 20 for premium)
      ↓
      Show current keywords
      ↓
      Options:
      1. Ajouter (Add)
      2. Supprimer (Remove)
      3. Remplacer (Replace)
      ↓
      Process user choice
      ↓
      Test with recent articles
      ↓
      Show sample matches
      ↓
      Confirm setup
      ↓
END → Active monitoring
```

### 4. Payment Flow

#### Mobile Money Integration
```
START
  ↓
User initiates payment
  ↓
Generate unique transaction ID
  ↓
Create payment request:
  - Amount in XAF
  - User phone number
  - Transaction reference
  ↓
Send to Mobile Money API
  ↓
[API Response]
  → ERROR: Show error message → Retry option
  → PENDING: Show USSD prompt instructions
      ↓
      Poll for status (max 5 min)
      ↓
      [Payment confirmed?]
      → NO: Timeout → Cancel transaction
      → YES: Continue
          ↓
          Update subscription in Supabase
          ↓
          Send receipt via WhatsApp
          ↓
          Activate premium features
          ↓
END → Premium activated
```

### 5. Error Handling

#### API Failures
```
WhatsApp API Error:
- 429 (Rate Limit): Queue and retry with backoff
- 401 (Auth): Refresh token and retry
- 500 (Server): Log, alert admin, use fallback

GPT API Error:
- Quota exceeded: Switch to GPT-3.5 or basic summarization
- Timeout: Retry with shorter content
- Invalid response: Use fallback summarization

RSS Feed Error:
- 404: Mark feed as inactive, notify admin
- Malformed XML: Try alternative parser
- Timeout: Skip and retry in next cycle
```

#### User Errors
```
Invalid Command:
→ Send friendly error message
→ Show command suggestions
→ Log for improvement

Payment Failed:
→ Clear explanation of issue
→ Provide alternative payment methods
→ Offer FREE tier as fallback

Subscription Expired:
→ Grace period of 3 days
→ Daily reminder messages
→ Auto-downgrade to FREE after grace period
```

### 6. Conditional Paths

#### Time-Based Delivery
```
IF user timezone preference exists:
  Deliver during preferred hours (8am-10pm local)
ELSE:
  Use default schedule (9am-8pm WAT)

IF breaking news AND premium user:
  Send immediately
ELSE:
  Queue for next delivery window
```

#### Content Filtering
```
IF user has content preferences:
  Filter by selected categories
  AND keyword matches
ELSE:
  Send top stories from all categories

IF article contains sensitive content:
  Add warning prefix
  OR skip for users who opted out
```

### 7. Admin Flow

#### Content Moderation
```
START
  ↓
Admin logs into dashboard
  ↓
View flagged content queue
  ↓
For each item:
  ↓
  Review article and summary
  ↓
  Options:
  - Approve as is
  - Edit summary
  - Block article
  - Block source
  ↓
  [Action taken]
  ↓
  Update database
  ↓
  Log moderation action
  ↓
END → Next item
```

### 8. Analytics Flow
```
START (Daily at midnight)
  ↓
Aggregate metrics:
- Active users
- Messages sent
- Articles processed
- Revenue collected
- Error rates
  ↓
Generate reports
  ↓
Store in Supabase
  ↓
Send summary to admins via WhatsApp
  ↓
IF critical metrics below threshold:
  Send alerts immediately
  ↓
END
```