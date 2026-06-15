// Routes Express supplémentaires pour remplacer les fonctions Netlify
// À ajouter dans backend/server.js après les routes d'articles existantes

const additionalRoutes = `

// ==================== ROUTES EVENTS ====================
app.get('/api/events', async (req, res) => {
  try {
    const health = req.query.health;
    if (health) {
      return res.json({ success: true, ok: true });
    }

    console.log('🎉 Récupération des événements...');
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .eq('is_active', true)
      .order('event_date', { ascending: true })
      .limit(50);

    if (error) throw error;

    res.json({
      success: true,
      events: events || [],
      count: events?.length || 0
    });
  } catch (error) {
    console.error('❌ Erreur récupération événements:', error);
    res.json({ success: false, events: [], error: error.message });
  }
});

// ==================== ROUTES POLLS ====================
app.get('/api/polls', async (req, res) => {
  try {
    console.log('📊 Récupération des sondages...');
    const { data: polls, error } = await supabase
      .from('polls')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    res.json({
      success: true,
      polls: polls || [],
      count: polls?.length || 0
    });
  } catch (error) {
    console.error('❌ Erreur récupération sondages:', error);
    res.json({ success: false, polls: [], error: error.message });
  }
});

app.post('/api/polls/questions', async (req, res) => {
  try {
    const { pollId } = req.body;
    console.log(\`📋 Récupération des questions pour le sondage: \${pollId}\`);

    const { data: questions, error } = await supabase
      .from('poll_questions')
      .select('*')
      .eq('poll_id', pollId)
      .order('question_order', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      questions: questions || []
    });
  } catch (error) {
    console.error('❌ Erreur récupération questions:', error);
    res.json({ success: false, questions: [], error: error.message });
  }
});

app.get('/api/polls/stats', async (req, res) => {
  try {
    const questionId = req.query.question_id;
    console.log(\`📊 Récupération des stats pour la question: \${questionId}\`);

    const { data: stats, error } = await supabase
      .from('poll_responses')
      .select('response_value')
      .eq('question_id', questionId);

    if (error) throw error;

    res.json({
      success: true,
      stats: stats || []
    });
  } catch (error) {
    console.error('❌ Erreur récupération stats:', error);
    res.json({ success: false, stats: [], error: error.message });
  }
});

app.post('/api/polls/check-votes', async (req, res) => {
  try {
    const { userId, pollId } = req.body;

    const { data: votes, error } = await supabase
      .from('poll_votes')
      .select('question_id')
      .eq('user_id', userId)
      .eq('poll_id', pollId);

    if (error) throw error;

    res.json({
      success: true,
      hasVoted: votes && votes.length > 0,
      votes: votes || []
    });
  } catch (error) {
    console.error('❌ Erreur vérification votes:', error);
    res.json({ success: false, hasVoted: false, error: error.message });
  }
});

app.post('/api/polls/vote', async (req, res) => {
  try {
    const { userId, questionId, pollId, response } = req.body;

    const { data, error } = await supabase
      .from('poll_votes')
      .insert({
        user_id: userId,
        question_id: questionId,
        poll_id: pollId,
        response: response,
        created_at: new Date().toISOString()
      })
      .select();

    if (error) throw error;

    res.json({ success: true, vote: data[0] });
  } catch (error) {
    console.error('❌ Erreur enregistrement vote:', error);
    res.json({ success: false, error: error.message });
  }
});

// ==================== ROUTES SLIDES ====================
app.get('/api/slides', async (req, res) => {
  try {
    const health = req.query.health;
    if (health) {
      return res.json({ success: true, ok: true });
    }

    console.log('📢 Récupération des slides...');
    const { data: slides, error } = await supabase
      .from('promotional_slides')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      slides: slides || []
    });
  } catch (error) {
    console.error('❌ Erreur récupération slides:', error);
    res.json({ success: false, slides: [], error: error.message });
  }
});

app.post('/api/slides', async (req, res) => {
  try {
    const { slideId, action } = req.body;
    
    if (action === 'view') {
      // RPC increment_slide_views n'existe pas encore dans Supabase
      console.log('[VIEW] Slide:', slideId);
    } else if (action === 'click') {
      // RPC increment_slide_clicks n'existe pas encore
      console.log('[CLICK] Slide:', slideId);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erreur tracking slide:', error);
    res.json({ success: false, error: error.message });
  }
});

// ==================== ROUTES ROUTES/MAPS ====================
app.get('/api/routes', async (req, res) => {
  try {
    console.log('🗺️  Récupération des trajets...');
    const { data: routes, error } = await supabase
      .from('map_routes')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      routes: routes || []
    });
  } catch (error) {
    console.error('❌ Erreur récupération trajets:', error);
    res.json({ success: false, routes: [], error: error.message });
  }
});

// ==================== ROUTES CREDITS ====================
app.get('/api/credits/stats', async (req, res) => {
  try {
    const { type, userId } = req.query;
    
    if (type === 'balance' && userId) {
      const { data, error } = await supabase
        .from('user_credits')
        .select('balance, bonus_balance')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      res.json({
        success: true,
        balance: {
          balance: data?.balance || 0,
          bonus: data?.bonus_balance || 0,
          total: (data?.balance || 0) + (data?.bonus_balance || 0)
        }
      });
    } else {
      res.json({ success: false, error: 'Invalid parameters' });
    }
  } catch (error) {
    console.error('❌ Erreur stats crédits:', error);
    res.json({ success: false, error: error.message });
  }
});

app.get('/api/credits/packages', async (req, res) => {
  try {
    const { data: packages, error } = await supabase
      .from('credit_packages')
      .select('*')
      .eq('is_active', true)
      .order('credits', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      packages: packages || []
    });
  } catch (error) {
    console.error('❌ Erreur packages crédits:', error);
    res.json({ success: false, packages: [], error: error.message });
  }
});

app.post('/api/credits/packages', async (req, res) => {
  try {
    const { userId, packageId, paymentMethod, paymentReference } = req.body;

    // Récupérer le package
    const { data: pkg, error: pkgError } = await supabase
      .from('credit_packages')
      .select('*')
      .eq('id', packageId)
      .single();

    if (pkgError) throw pkgError;

    // Ajouter les crédits
    const { data, error } = await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        package_id: packageId,
        credits: pkg.credits,
        amount: pkg.price,
        payment_method: paymentMethod,
        payment_reference: paymentReference,
        status: 'completed',
        created_at: new Date().toISOString()
      })
      .select();

    if (error) throw error;

    // Mettre à jour le solde utilisateur
    await supabase.rpc('add_user_credits', { 
      p_user_id: userId, 
      p_credits: pkg.credits 
    });

    res.json({ success: true, transaction: data[0] });
  } catch (error) {
    console.error('❌ Erreur achat crédits:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/credits/manage', async (req, res) => {
  try {
    const { action, userId, requiredCredits } = req.body;

    if (action === 'check_balance') {
      const { data, error } = await supabase
        .from('user_credits')
        .select('balance, bonus_balance')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      const total = (data?.balance || 0) + (data?.bonus_balance || 0);
      
      res.json({
        success: true,
        hasEnough: total >= requiredCredits,
        balance: total
      });
    } else {
      res.json({ success: false, error: 'Unknown action' });
    }
  } catch (error) {
    console.error('❌ Erreur gestion crédits:', error);
    res.json({ success: false, error: error.message });
  }
});

// ==================== ROUTES USER HISTORY ====================
app.get('/api/user/history', async (req, res) => {
  try {
    const { userId, page = 1, limit = 20, category } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from('user_reading_history')
      .select('*, articles(*)', { count: 'exact' })
      .eq('user_id', userId)
      .order('read_at', { ascending: false });

    if (category) {
      query = query.eq('articles.category', category);
    }

    const { data, error, count } = await query
      .range(offset, offset + parseInt(limit) - 1);

    if (error) throw error;

    res.json({
      success: true,
      history: data || [],
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit))
    });
  } catch (error) {
    console.error('❌ Erreur historique utilisateur:', error);
    res.json({ success: false, history: [], error: error.message });
  }
});

// ==================== ROUTES OPPORTUNITIES ====================
app.post('/api/opportunities/enhance', async (req, res) => {
  try {
    const { opportunityData, userId } = req.body;

    // Simuler l'enrichissement (remplacer par vraie logique IA)
    const enhanced = {
      ...opportunityData,
      enriched: true,
      suggestions: [
        'Analyse de marché approfondie recommandée',
        'Étude de faisabilité technique suggérée'
      ],
      score: Math.floor(Math.random() * 100)
    };

    res.json({
      success: true,
      enhanced
    });
  } catch (error) {
    console.error('❌ Erreur enrichissement opportunité:', error);
    res.json({ success: false, error: error.message });
  }
});

`;

console.log(additionalRoutes);
