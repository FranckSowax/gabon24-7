# ⚡ Quick Fix - Backend Railway (2 minutes)

**Problème:** Backend Railway DOWN → Frontend ne charge pas les articles

---

## 🎯 Solution ultra-rapide

### 1️⃣ Aller sur Railway (30 sec)
```
https://railway.app/dashboard
→ Projet: gabon24-7-production
→ Onglet: Variables
```

### 2️⃣ Obtenir les clés Supabase (1 min)
```
https://supabase.com/dashboard/project/ykytsadwfqoyusleoflf/settings/api
→ Section: Project API keys
→ Copier: service_role (⚠️ PAS anon)
→ Copier: anon
→ Copier: URL
```

### 3️⃣ Ajouter dans Railway (30 sec)
```
New Variable → Name: SUPABASE_SERVICE_ROLE_KEY
              Value: [Coller service_role]

New Variable → Name: SUPABASE_URL
              Value: https://ykytsadwfqoyusleoflf.supabase.co

New Variable → Name: SUPABASE_ANON_KEY
              Value: [Coller anon]

New Variable → Name: FRONTEND_URL
              Value: https://gabon24-7.netlify.app
```

### 4️⃣ Attendre (30 sec)
Railway redémarre automatiquement

### 5️⃣ Tester (10 sec)
```bash
curl https://gabon24-7-production.up.railway.app/api/articles/trending
```

**Résultat attendu:** JSON avec articles

---

## ✅ C'est tout !

**Temps total:** ~2 minutes  
**Difficulté:** ⭐☆☆☆☆ (Très facile)

---

## 📚 Plus de détails ?

- **Solution complète:** `SOLUTION_RAPIDE_RAILWAY.md`
- **Diagnostic:** `DIAGNOSTIC_RAILWAY_CORS.md`
- **Débogage:** `GUIDE_DEBOGAGE_RAILWAY.md`
- **Test auto:** `./test-railway-backend.sh`

---

**Date:** 13 novembre 2025
