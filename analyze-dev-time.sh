#!/bin/bash

echo "📊 ANALYSE DU TEMPS DE DÉVELOPPEMENT - GABON24-7"
echo "=================================================="
echo ""

# Premier commit
echo "🚀 PREMIER COMMIT:"
FIRST_COMMIT=$(git log --all --pretty=format:"%ai|%s" --reverse | head -1)
echo "$FIRST_COMMIT"
echo ""

# Dernier commit
echo "🏁 DERNIER COMMIT:"
LAST_COMMIT=$(git log --all --pretty=format:"%ai|%s" -1)
echo "$LAST_COMMIT"
echo ""

# Calcul de la durée
FIRST_DATE=$(git log --all --pretty=format:"%at" --reverse | head -1)
LAST_DATE=$(git log --all --pretty=format:"%at" -1)
DURATION=$((LAST_DATE - FIRST_DATE))
DAYS=$((DURATION / 86400))
HOURS=$(((DURATION % 86400) / 3600))

echo "⏱️  DURÉE TOTALE:"
echo "   $DAYS jours et $HOURS heures"
echo ""

# Nombre de commits
TOTAL_COMMITS=$(git rev-list --count HEAD)
echo "📝 NOMBRE DE COMMITS: $TOTAL_COMMITS"
echo ""

# Commits par auteur
echo "👥 COMMITS PAR AUTEUR:"
git shortlog -sn --all
echo ""

# Commits par jour
echo "📅 ACTIVITÉ PAR JOUR (derniers 30 jours):"
git log --all --pretty=format:"%ad" --date=short --since="30 days ago" | sort | uniq -c | sort -rn
echo ""

# Statistiques de code
echo "💻 STATISTIQUES DE CODE:"
echo "   Lignes ajoutées/supprimées:"
git log --all --pretty=tformat: --numstat | awk '{ add += $1; subs += $2; loc += $1 - $2 } END { printf "   +%s -%s (net: %s)\n", add, subs, loc }'
echo ""

# Commits par heure de la journée
echo "🕐 COMMITS PAR HEURE DE LA JOURNÉE:"
git log --all --pretty=format:"%ad" --date=format:"%H" | sort | uniq -c | sort -k2n | awk '{printf "   %02d:00 - %s commits\n", $2, $1}'
echo ""

# Estimation heures de travail (basée sur commits groupés)
echo "⏰ ESTIMATION HEURES DE TRAVAIL:"
echo "   (Basée sur sessions de commits espacés de moins de 3h)"
git log --all --pretty=format:"%at" | sort -n | awk '
BEGIN { 
    session_gap = 10800  # 3 heures en secondes
    total_hours = 0
    session_count = 0
}
{
    if (prev_time != "") {
        gap = $1 - prev_time
        if (gap < session_gap) {
            session_time += gap
        } else {
            if (session_time > 0) {
                total_hours += (session_time / 3600)
                session_count++
            }
            session_time = 0
        }
    }
    prev_time = $1
}
END {
    if (session_time > 0) {
        total_hours += (session_time / 3600)
        session_count++
    }
    printf "   Sessions de travail: %d\n", session_count
    printf "   Heures estimées: %.1f heures\n", total_hours
    printf "   Moyenne par session: %.1f heures\n", total_hours/session_count
}
'
echo ""

echo "=================================================="
echo "✅ Analyse terminée!"
