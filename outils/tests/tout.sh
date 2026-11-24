#!/bin/bash
# Lance tous les lots de tests (4 à la fois) et range la sortie de chacun dans un dossier.
# Usage : bash outils/tests/tout.sh <dossier de l'appli> <dossier des résultats>
# Pour comparer deux versions : lancer sur chacune, puis « diff -r resultats_avant resultats_apres ».
# Résumé affiché : une ligne par lot avec son verdict et ses erreurs JS.
APP=$(cd "${1:-.}" && pwd); OUT=$(mkdir -p "${2:-resultats}" && cd "${2:-resultats}" && pwd); T=$(cd "$(dirname "$0")" && pwd)
ls "$T"/*.js | grep -v -e '/base.js$' -e '/releve.js$' | xargs -P 4 -I{} bash -c '
  f={}; n=$(basename $f .js); case $n in jeu*) a="$0/index.html";; *) a="$0";; esac
  cd "$0" && timeout 900 node "$f" "$a" > "$1/$n.txt" 2>&1; code=$?
  v=$(grep -h -e "VERDICT" -e "TOUT VERT" "$1/$n.txt" | tail -1); e=$(grep -h -e "ERREURS JS" -e "^ERREURS:" "$1/$n.txt" | tail -1)
  echo "$n · sortie $code · ${v:-—} · ${e:-—}"' "$APP" "$OUT" | sort
bash "$T/generer.sh" "$APP/.." > "$OUT/generer.txt" 2>&1; echo "generer · $(tail -1 "$OUT/generer.txt")"
node "$T/releve.js" "$APP/index.html" "$OUT/releve.txt" > /dev/null 2>&1 && echo "releve · écrit"
