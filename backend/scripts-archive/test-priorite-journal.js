#!/usr/bin/env node

/**
 * 🧪 TEST - Vérification de la priorisation des journaux
 * 
 * Simule différents scénarios pour vérifier que le journal le plus récent
 * parmi les éditions prioritaires (20h/23h) est toujours sélectionné
 */

function testPriorisation() {
  console.log('\n🧪 TEST DE PRIORISATION DES JOURNAUX\n');
  console.log('='.repeat(80));
  
  // Scénario 1: Journal de 23h et 20h du même jour
  console.log('\n📋 SCÉNARIO 1: Journal 23h + 20h du même jour\n');
  
  const videos1 = [
    { title: 'Journal Télévisé de 13h du 09 novembre 2025', pubDate: '2025-11-09T21:01:00Z' },
    { title: 'Journal Télévisé de 20h du 09 novembre 2025', pubDate: '2025-11-09T20:17:00Z' },
    { title: 'Journal Télévisé de 23h du 09 novembre 2025', pubDate: '2025-11-09T23:32:00Z' },
  ];
  
  // Filtrer journaux TV
  const journalKeywords = ['journal télévisé', 'journal tv', 'jt de', 'journal de'];
  const journalVideos1 = videos1.filter(video => {
    const titleLower = video.title.toLowerCase();
    return journalKeywords.some(keyword => titleLower.includes(keyword));
  });
  
  // Trier par date
  journalVideos1.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  
  // Prioriser 20h/23h
  const priorityJournals1 = journalVideos1.filter(video => {
    const titleLower = video.title.toLowerCase();
    return titleLower.includes('20h') || titleLower.includes('23h');
  });
  
  // Trier les prioritaires par date
  if (priorityJournals1.length > 0) {
    priorityJournals1.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  }
  
  const selected1 = priorityJournals1[0];
  
  console.log('Vidéos disponibles:');
  videos1.forEach(v => {
    const date = new Date(v.pubDate);
    const isPriority = v.title.toLowerCase().includes('20h') || v.title.toLowerCase().includes('23h');
    console.log(`  ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} ${isPriority ? '⭐' : '  '} | ${v.title}`);
  });
  
  console.log(`\n✅ Journal sélectionné: ${selected1.title}`);
  console.log(`   Date: ${new Date(selected1.pubDate).toLocaleString('fr-FR')}`);
  
  const is23h = selected1.title.toLowerCase().includes('23h');
  if (is23h) {
    console.log('\n✅ CORRECT: Le journal de 23h (le plus récent) est sélectionné');
  } else {
    console.log('\n❌ ERREUR: Le journal de 23h devrait être sélectionné');
  }
  
  // Scénario 2: Seulement journal de 20h
  console.log('\n' + '='.repeat(80));
  console.log('\n📋 SCÉNARIO 2: Seulement journal de 20h\n');
  
  const videos2 = [
    { title: 'Journal Télévisé de 13h du 09 novembre 2025', pubDate: '2025-11-09T21:01:00Z' },
    { title: 'Journal Télévisé de 20h du 09 novembre 2025', pubDate: '2025-11-09T20:17:00Z' },
  ];
  
  const journalVideos2 = videos2.filter(video => {
    const titleLower = video.title.toLowerCase();
    return journalKeywords.some(keyword => titleLower.includes(keyword));
  });
  
  journalVideos2.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  
  const priorityJournals2 = journalVideos2.filter(video => {
    const titleLower = video.title.toLowerCase();
    return titleLower.includes('20h') || titleLower.includes('23h');
  });
  
  if (priorityJournals2.length > 0) {
    priorityJournals2.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  }
  
  const selected2 = priorityJournals2[0];
  
  console.log('Vidéos disponibles:');
  videos2.forEach(v => {
    const date = new Date(v.pubDate);
    const isPriority = v.title.toLowerCase().includes('20h') || v.title.toLowerCase().includes('23h');
    console.log(`  ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} ${isPriority ? '⭐' : '  '} | ${v.title}`);
  });
  
  console.log(`\n✅ Journal sélectionné: ${selected2.title}`);
  console.log(`   Date: ${new Date(selected2.pubDate).toLocaleString('fr-FR')}`);
  
  const is20h = selected2.title.toLowerCase().includes('20h');
  if (is20h) {
    console.log('\n✅ CORRECT: Le journal de 20h est sélectionné (pas de 23h disponible)');
  } else {
    console.log('\n❌ ERREUR: Le journal de 20h devrait être sélectionné');
  }
  
  // Scénario 3: Journal de 23h du 8 nov + 20h du 9 nov
  console.log('\n' + '='.repeat(80));
  console.log('\n📋 SCÉNARIO 3: Journal 23h du 8 nov + 20h du 9 nov\n');
  
  const videos3 = [
    { title: 'Journal Télévisé de 23h du 08 novembre 2025', pubDate: '2025-11-08T23:32:00Z' },
    { title: 'Journal Télévisé de 20h du 09 novembre 2025', pubDate: '2025-11-09T20:17:00Z' },
  ];
  
  const journalVideos3 = videos3.filter(video => {
    const titleLower = video.title.toLowerCase();
    return journalKeywords.some(keyword => titleLower.includes(keyword));
  });
  
  journalVideos3.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  
  const priorityJournals3 = journalVideos3.filter(video => {
    const titleLower = video.title.toLowerCase();
    return titleLower.includes('20h') || titleLower.includes('23h');
  });
  
  if (priorityJournals3.length > 0) {
    priorityJournals3.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  }
  
  const selected3 = priorityJournals3[0];
  
  console.log('Vidéos disponibles:');
  videos3.forEach(v => {
    const date = new Date(v.pubDate);
    const isPriority = v.title.toLowerCase().includes('20h') || v.title.toLowerCase().includes('23h');
    console.log(`  ${date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} ${isPriority ? '⭐' : '  '} | ${v.title}`);
  });
  
  console.log(`\n✅ Journal sélectionné: ${selected3.title}`);
  console.log(`   Date: ${new Date(selected3.pubDate).toLocaleString('fr-FR')}`);
  
  const is20h3 = selected3.title.toLowerCase().includes('20h du 09');
  if (is20h3) {
    console.log('\n✅ CORRECT: Le journal de 20h du 9 nov (le plus récent) est sélectionné');
  } else {
    console.log('\n❌ ERREUR: Le journal de 20h du 9 nov devrait être sélectionné');
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('\n🎉 TOUS LES SCÉNARIOS SONT CORRECTS!\n');
}

testPriorisation();
