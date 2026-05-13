// Thème BCEG centralisé — réutilisable sur toutes les pages du process d'analyse
// Vert BCEG: #4d553e

export const BCEG_GREEN = '#4d553e'
export const BCEG_GREEN_LIGHT = '#6a7556'
export const BCEG_GREEN_DARK = '#3a4030'
export const BCEG_BACKDROP_IMAGE = '/imgi_5_back3.png'
export const BCEG_LOGO = '/646710125_122187790628463229_813105913342150168_n.jpg'

// Classes Tailwind pré-faites pour usage rapide
export const bcegClasses = {
  titleGradient: 'bg-gradient-to-r from-[#4d553e] via-[#6a7556] to-[#4d553e] bg-clip-text text-transparent',
  textPrimary: 'text-[#4d553e]',
  textPrimaryDark: 'text-[#3a4030]',

  btnPrimary: 'bg-[#4d553e] hover:bg-[#3a4030] text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all',
  btnPrimaryGradient: 'bg-gradient-to-br from-[#4d553e] to-[#3a4030] hover:from-[#3a4030] hover:to-[#2c3324] text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all',
  btnSecondary: 'bg-white/80 hover:bg-white text-[#4d553e] border border-[#4d553e]/30 hover:border-[#4d553e]/60 font-medium rounded-xl transition-all',

  ring: 'ring-[#4d553e]/30',
  border: 'border-[#4d553e]/30',

  cardSubtle: 'bg-white/85 backdrop-blur-md border border-slate-200 hover:border-[#4d553e]/40',
  cardAccent: 'bg-gradient-to-br from-[#4d553e]/10 to-[#6a7556]/5 border border-[#4d553e]/20',
}
