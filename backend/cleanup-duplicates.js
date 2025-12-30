/**
 * 🧹 Nettoyage des doublons d'articles (soft-delete via is_published=false)
 * - Clé canonique: normalized_url si dispo, sinon url normalisée à la volée
 * - Garde le plus récent (published_at desc, puis created_at desc)
 * - Met les autres en is_published=false pour éviter conflits d'index unique
 *
 * Exécution: node cleanup-duplicates.js
 */

const supabaseService = require('./supabase-config');

function normalizeUrlInline(url) {
  try {
    if (!url) return '';
    // baisser la casse et retirer www.
    let u = url.toString().trim();
    u = u.replace(/^https?:\/\/(www\.)?/i, (m, w) => m.toLowerCase().includes('https') ? 'https://' : 'http://');
    u = u.replace(/^https?:\/\/www\./i, (m) => m.toLowerCase().startsWith('https') ? 'https://' : 'http://');
    // retirer utm_*, fbclid, gclid etc.
    const parsed = new URL(u);
    const trackingParams = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','utm_name','gclid','fbclid','igshid','mc_cid','mc_eid'];
    trackingParams.forEach(p => parsed.searchParams.delete(p));
    parsed.hash = '';
    if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString().toLowerCase();
  } catch (e) {
    return (url || '').toString().trim().toLowerCase();
  }
}

async function fetchAllPublished(batch = 1000) {
  const all = [];
  let from = 0;
  while (true) {
    const to = from + batch - 1;
    const { data, error } = await supabaseService.supabase
      .from('articles')
      .select('id, url, normalized_url, published_at, created_at, is_published', { count: 'exact' })
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    from += data.length;
  }
  return all;
}

async function run() {
  console.log('🔎 Récupération des articles publiés...');
  const rows = await fetchAllPublished();
  console.log(`📊 ${rows.length} articles publiés chargés`);

  const groups = new Map();
  for (const r of rows) {
    const key = (r.normalized_url && r.normalized_url.trim())
      ? r.normalized_url.trim().toLowerCase()
      : normalizeUrlInline(r.url);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  let toUnpublish = [];
  for (const [key, arr] of groups) {
    if (arr.length <= 1) continue;
    // Trier par published_at desc NULLS LAST, puis created_at desc
    arr.sort((a, b) => {
      const pa = a.published_at ? new Date(a.published_at).getTime() : 0;
      const pb = b.published_at ? new Date(b.published_at).getTime() : 0;
      if (pb !== pa) return pb - pa;
      const ca = a.created_at ? new Date(a.created_at).getTime() : 0;
      const cb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return cb - ca;
    });
    const keep = arr[0];
    const rest = arr.slice(1);
    for (const r of rest) {
      toUnpublish.push(r.id);
    }
  }

  console.log(`🧮 Doublons à dépublier: ${toUnpublish.length}`);
  const batchSize = 500;
  let updated = 0;
  for (let i = 0; i < toUnpublish.length; i += batchSize) {
    const batchIds = toUnpublish.slice(i, i + batchSize);
    const { error } = await supabaseService.supabase
      .from('articles')
      .update({ is_published: false })
      .in('id', batchIds);
    if (error) {
      console.error('❌ Erreur update batch:', error.message);
      continue;
    }
    updated += batchIds.length;
    console.log(`✅ Dépubliés: ${updated}/${toUnpublish.length}`);
  }

  console.log('🏁 Nettoyage terminé');
}

run().catch(err => {
  console.error('❌ Erreur nettoyage:', err.message);
  process.exit(1);
});
