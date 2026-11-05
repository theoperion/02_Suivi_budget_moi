#!/usr/bin/env python3
"""Fabrique les applis de Clément et Devlin à partir de l'appli de Théo (le modèle).

Usage : python3 commun/generer.py [chemin_du_dossier_des_depots]
Chaque remplacement doit trouver exactement le nombre attendu d'occurrences, sinon rien n'est écrit.
"""
import json, os, re, sys

ICI = os.path.dirname(os.path.abspath(__file__))
MODELE = os.path.dirname(ICI)                       # dépôt de Théo
RACINE = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(MODELE)
P = json.load(open(os.path.join(ICI, 'personnes.json'), encoding='utf-8'))

def lire(nom): return open(os.path.join(MODELE, nom), encoding='utf-8').read()

def remplacer(txt, motif, rempl, n=1, regex=False):
    trouve = len(re.findall(motif, txt)) if regex else txt.count(motif)
    if trouve != n: raise SystemExit(f'Modèle inattendu : « {motif[:60]} » trouvé {trouve} fois au lieu de {n}')
    return re.sub(motif, lambda m: rempl, txt) if regex else txt.replace(motif, rempl)

def fabriquer(p):
    html = lire('index.html')
    html = remplacer(html, '<title>Budget</title>', f'<title>{p["titre"]}</title>')
    html = remplacer(html, r"const API_DEFAUT = '[^']*';", f"const API_DEFAUT = '{p['lien_script']}';", regex=True)
    html = remplacer(html, "'jauge.' + k", f"'{p['prefixe_stockage']}' + k", n=3)
    html = remplacer(html, 'const ACCES_ANTICIPE = true;', f'const ACCES_ANTICIPE = {"true" if p["acces_anticipe"] else "false"};')
    sw = remplacer(lire('sw.js'), "const PREFIXE = 'jauge-v';", f"const PREFIXE = '{p['prefixe_cache']}';")
    man = remplacer(lire('manifest.json'), '"name": "Jauge · mon budget"', f'"name": "{p["nom_appli"]}"')
    gs = lire('apps-script/Code.js')
    gs = remplacer(gs, ' * BUDGET · API du budget (Apps Script)', f' * BUDGET · API {p["nom_script"]} (Apps Script)')
    gs = remplacer(gs, "const ID_FICHIER = '';", f"const ID_FICHIER = '{p['id_fichier']}'; // {p['commentaire_fichier']}")
    clasp = remplacer(lire('apps-script/.clasp.json'), r'"scriptId": "[^"]*"', f'"scriptId": "{p["script_id"]}"', regex=True)
    return {'index.html': html, 'sw.js': sw, 'manifest.json': man, 'apps-script/Code.js': gs,
            'apps-script/appsscript.json': lire('apps-script/appsscript.json'), 'apps-script/.clasp.json': clasp}

for cle, p in P.items():
    if cle.startswith('_'): continue
    fichiers = fabriquer(p)                          # tout est vérifié avant d'écrire quoi que ce soit
    dest = os.path.join(RACINE, p['depot'])
    for nom, txt in fichiers.items():
        chemin = os.path.join(dest, nom); os.makedirs(os.path.dirname(chemin), exist_ok=True)
        open(chemin, 'w', encoding='utf-8').write(txt)
    print(f'{cle} : {len(fichiers)} fichiers écrits dans {dest}')
