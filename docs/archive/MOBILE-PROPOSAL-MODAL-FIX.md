# Fix Mobile Proposal Modal - Instructions Détaillées

## 🎯 Objectif

Sur mobile, quand l'utilisateur clique sur un secteur d'opportunité, il faut:
1. Ouvrir un MODAL avec le formulaire de personnalisation
2. Générer les propositions DANS le modal
3. Afficher les propositions avec boutons "Sauvegarder" et "Aller + Loin"

**PAS de workflow inline** comme sur desktop.

## 📍 Fichier à Modifier

`frontend/src/app/business/analyzer/page.tsx`

## ✅ Étapes à Suivre

### 1. Ajouter le State du Modal (ligne ~246)

```typescript
// Modal mobile pour propositions
const [showMobileProposalModal, setShowMobileProposalModal] = useState(false)
```

### 2. Modifier le Clic sur Secteur (ligne ~1107)

**AVANT:**
```typescript
onClick={() => handleSelectSecteur(secteur)}
```

**APRÈS:**
```typescript
onClick={() => {
  // Sur mobile: ouvrir modal
  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    setSelectedSecteur(secteur)
    setSelectedBudget(null)
    setProposals([])
    setShowMobileProposalModal(true)
  } else {
    // Sur desktop: workflow inline classique
    handleSelectSecteur(secteur)
  }
}}
```

### 3. Ajouter le Modal à la Fin (après ligne ~1530)

Copier le modal complet de `/run/page.tsx` (lignes 306-441):

```tsx
{/* Modal Mobile Propositions */}
{showMobileProposalModal && selectedSecteur && (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center md:hidden">
    <div className="absolute inset-0 bg-black/60" onClick={() => setShowMobileProposalModal(false)} />
    <div className="relative w-full sm:w-[640px] max-h-[90vh] overflow-hidden rounded-t-2xl sm:rounded-2xl bg-slate-900 border border-white/10 shadow-2xl">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-2 text-white/90">
          <Lightbulb className="w-5 h-5 text-yellow-400" />
          <span className="font-semibold">{selectedSecteur.nom}</span>
        </div>
        <button aria-label="Fermer" onClick={() => setShowMobileProposalModal(false)} className="text-white/70 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 sm:p-6 overflow-y-auto" style={{ maxHeight: '70vh' }}>
        {!proposals || proposals.length === 0 && !isLoadingProposals ? (
          <div>
            <div className="text-white/90 font-medium mb-4">Personnalisez votre contexte</div>
            <PersonalizationFormInline
              budgetOptions={budgetLevels as any}
              onSubmit={handleInlinePersonalizationSubmit}
              isLoading={isLoadingProposals}
              userId={user?.id}
            />
          </div>
        ) : null}

        {isLoadingProposals && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-400 mx-auto mb-4"></div>
            <div className="text-white/90">Génération des propositions...</div>
          </div>
        )}

        {proposals && proposals.length > 0 && !isLoadingProposals && (
          <div className="space-y-4">
            {proposals.map((proposal, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-4 bg-white/5 rounded-xl border border-white/10"
              >
                {/* Contenu proposition complet - voir /run/page.tsx lignes 410-544 */}
                <div className="flex items-start justify-between mb-3">
                  <h5 className="font-semibold text-white">{proposal.titre}</h5>
                  <div className="text-yellow-400 font-bold text-sm">
                    {proposal.score_faisabilite}%
                  </div>
                </div>
                
                <p className="text-gray-300 text-sm mb-4">
                  {proposal.description}
                </p>
                
                {/* ... reste du contenu ... */}
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => saveProject(index)}
                    className="flex-1 py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 bg-white/10 text-white hover:bg-white/20"
                  >
                    <Bookmark className="w-4 h-4" />
                    Sauvegarder
                  </button>
                  <button 
                    onClick={() => {
                      const newExpanded = new Set(expandedProposals)
                      if (newExpanded.has(index)) {
                        newExpanded.delete(index)
                      } else {
                        newExpanded.add(index)
                      }
                      setExpandedProposals(newExpanded)
                    }}
                    className="flex-1 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-semibold rounded-lg hover:from-yellow-500 hover:to-orange-600 transition-all flex items-center justify-center gap-2"
                  >
                    Aller + Loin
                    <ChevronDown className={`w-4 h-4 transition-transform ${expandedProposals.has(index) ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {/* Dropdown Aller + Loin */}
                <AnimatePresence>
                  {expandedProposals.has(index) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="mt-4 overflow-hidden"
                    >
                      <div className="border-t border-white/10 pt-4">
                        <h6 className="text-white font-semibold mb-3 text-center">
                          🚀 Accélérez votre réussite
                        </h6>
                        <div className="space-y-3">
                          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                            <div className="flex items-start gap-3">
                              <span className="text-xl">📋</span>
                              <div className="flex-1">
                                <div className="text-white font-medium text-sm">Plan d'action personnalisé</div>
                                <p className="text-gray-300 text-xs mt-1">Étapes détaillées pour lancer votre projet</p>
                              </div>
                              <div className="text-center">
                                <p className="text-orange-400 font-bold text-sm">15</p>
                                <p className="text-gray-400 text-xs">crédits</p>
                              </div>
                            </div>
                          </div>
                          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                            <div className="flex items-start gap-3">
                              <span className="text-xl">🎓</span>
                              <div className="flex-1">
                                <div className="text-white font-medium text-sm">Formation personnalisée</div>
                                <p className="text-gray-300 text-xs mt-1">Programme adapté à vos compétences</p>
                              </div>
                              <div className="text-center">
                                <p className="text-orange-400 font-bold text-sm">20</p>
                                <p className="text-gray-400 text-xs">crédits</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
)}
```

## 🔧 Imports Nécessaires

Vérifier que ces imports sont présents (ligne ~7):

```typescript
import { Bookmark, ChevronDown, CheckCircle, X } from 'lucide-react'
```

## 🎨 Workflow Final

### Mobile (< 768px):
```
1. Clic secteur → Ouvre modal
2. Formulaire personnalisation dans modal
3. Submit → Génération dans modal (spinner)
4. Affichage propositions dans modal
5. Boutons "Sauvegarder" + "Aller + Loin"
```

### Desktop (>= 768px):
```
1. Clic secteur → handleSelectSecteur()
2. Affichage inline formulaire
3. Submit → Génération inline
4. Affichage propositions inline
5. Workflow actuel conservé
```

## ✅ Checklist

- [ ] State `showMobileProposalModal` ajouté
- [ ] Clic secteur modifié avec détection mobile
- [ ] Modal ajouté à la fin du fichier
- [ ] Imports `X`, `Bookmark`, `ChevronDown` présents
- [ ] Test mobile: clic secteur ouvre modal
- [ ] Test mobile: formulaire s'affiche
- [ ] Test mobile: génération fonctionne
- [ ] Test mobile: propositions s'affichent
- [ ] Test mobile: boutons fonctionnent
- [ ] Test desktop: workflow inline conservé

## 🚀 Déploiement

```bash
git add -A
git commit -m "feat: Modal mobile pour propositions avec formulaire personnalisation

- Ajout modal dédié mobile pour workflow propositions
- Détection mobile/desktop pour clic secteur
- Formulaire personnalisation dans modal
- Affichage propositions avec boutons Sauvegarder et Aller + Loin
- Workflow desktop inline conservé

Résout: Ancien workflow inline sur mobile, propositions non affichées"
git push origin main
```

## 📝 Notes

- Le modal utilise `md:hidden` pour être visible uniquement sur mobile
- Le workflow desktop reste inchangé (inline)
- Les propositions sont générées via `handleInlinePersonalizationSubmit` existant
- Le state `proposals` est partagé entre desktop et mobile
