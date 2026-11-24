#!/bin/bash
# Test du fabricant de copies (commun/generer.py), surtout du mode « --une » utilisé chaque nuit par le robot
# des personnes qui hébergent elles-mêmes leur appli (Clément après le 25/11/2026). Ne touche pas aux vrais dépôts.
# Usage : bash outils/tests/generer.sh [dossier contenant 02, 05 et 06]   → « VERDICT: OK » attendu
R=$(cd "${1:-$(dirname "$0")/../../..}" && pwd); T=$(mktemp -d); KO=0
for d in 02_Suivi_budget_moi 05_Suivi_budget_Clement 06_Suivi_budget_Devlin; do [ -d "$R/$d" ] || { echo "non concerné : $R/$d absent"; exit 0; }; done
ok() { echo "OK    · $1"; }; ko() { echo "ÉCHEC · $1"; KO=1; }
cp -r "$R/02_Suivi_budget_moi" "$R/05_Suivi_budget_Clement" "$R/06_Suivi_budget_Devlin" "$T/"
G="$T/02_Suivi_budget_moi/commun/generer.py"; C="$T/05_Suivi_budget_Clement"
FICH="index.html sw.js manifest.json apps-script/Code.js apps-script/appsscript.json apps-script/.clasp.json"
# (a) mode --une avec le reglages.json de Clément : sa copie actuelle ne bouge pas
mkdir "$T/a" && python3 "$G" --une "$C/reglages.json" "$T/a" > /dev/null && for f in $FICH; do cmp -s "$T/a/$f" "$C/$f" || ko "--une : $f différent de la copie de Clément"; done && ok "--une redonne exactement la copie de Clément"
# (b) le mode habituel donne le même résultat que --une
python3 "$G" "$T" > /dev/null && for f in $FICH; do cmp -s "$T/a/$f" "$C/$f" || ko "mode habituel ≠ --une : $f"; done && ok "mode habituel = --une"
# (c) réglages contenant une valeur de Théo → refus, rien d'écrit
for cas in "lien_script|https://script.google.com/macros/s/AKfycbzdbw1TzpRU16ftWHzSf04CE_Y6lfvfH08uuHF1na_uz97gCLdYr5fylt8F_QvUQBwRzQ/exec" "prefixe_stockage|jauge." "prefixe_cache|jauge-v"; do
  k=${cas%%|*}; v=${cas#*|}; mkdir -p "$T/c" && rm -rf "$T/c"/*
  python3 -c "import json,sys; d=json.load(open(sys.argv[1])); d[sys.argv[2]]=sys.argv[3]; json.dump(d,open(sys.argv[4],'w'))" "$C/reglages.json" "$k" "$v" "$T/r.json"
  python3 "$G" --une "$T/r.json" "$T/c" > /dev/null 2>&1; code=$?
  [ $code -ne 0 ] && [ -z "$(ls -A "$T/c")" ] && ok "refus si $k = valeur de Théo (rien d'écrit)" || ko "$k = valeur de Théo accepté (code $code)"
done
# (d) réglage manquant → refus propre, rien d'écrit
python3 -c "import json,sys; d=json.load(open(sys.argv[1])); d.pop('titre'); json.dump(d,open(sys.argv[2],'w'))" "$C/reglages.json" "$T/r2.json"
rm -rf "$T/d" && mkdir "$T/d" && python3 "$G" --une "$T/r2.json" "$T/d" > /dev/null 2>&1; [ $? -ne 0 ] && [ -z "$(ls -A "$T/d")" ] && ok "réglage manquant : arrêt sans rien écrire" || ko "réglage manquant mal géré"
rm -rf "$T"; [ $KO = 0 ] && echo "VERDICT: OK" || { echo "VERDICT: ÉCHEC"; exit 1; }
