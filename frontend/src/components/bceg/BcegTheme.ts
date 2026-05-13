// Thème BCEG centralisé — réutilisable sur toutes les pages du process d'analyse
// Vert BCEG: #697357

export const BCEG_GREEN = '#697357'
export const BCEG_GREEN_LIGHT = '#8a9576'
export const BCEG_GREEN_DARK = '#4d553e'
export const BCEG_BACKDROP_IMAGE = '/imgi_5_back3.png'
export const BCEG_LOGO = '/646710125_122187790628463229_813105913342150168_n.jpg'

// Classes Tailwind pré-faites pour usage rapide
export const bcegClasses = {
  titleGradient: 'bg-gradient-to-r from-[#697357] via-[#8a9576] to-[#697357] bg-clip-text text-transparent',
  textPrimary: 'text-[#697357]',
  textPrimaryDark: 'text-[#4d553e]',

  btnPrimary: 'bg-[#697357] hover:bg-[#4d553e] text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all',
  btnPrimaryGradient: 'bg-gradient-to-br from-[#697357] to-[#4d553e] hover:from-[#4d553e] hover:to-[#3a4030] text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all',
  btnSecondary: 'bg-white/80 hover:bg-white text-[#697357] border border-[#697357]/30 hover:border-[#697357]/60 font-medium rounded-xl transition-all',

  ring: 'ring-[#697357]/30',
  border: 'border-[#697357]/30',

  cardSubtle: 'bg-white/85 backdrop-blur-md border border-slate-200 hover:border-[#697357]/40',
  cardAccent: 'bg-gradient-to-br from-[#697357]/10 to-[#8a9576]/5 border border-[#697357]/20',
}
