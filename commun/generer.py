#!/usr/bin/env python3
"""Fabrique les applis de Clément et Devlin à partir de l'appli de Théo (le modèle).

Usage : python3 commun/generer.py [chemin_du_dossier_des_depots]
   ou : python3 commun/generer.py --une <reglages.json> <dossier_de_sortie>
        (une seule copie, réglages lus dans un fichier : utilisé par la mise à jour automatique
         du dépôt d'une personne qui héberge elle-même son appli, voir commun/mise-a-jour.yml)
Chaque remplacement doit trouver exactement le nombre attendu d'occurrences, sinon rien n'est écrit.
Les deux copies sont fabriquées en mémoire et contrôlées (plus aucune trace des réglages de Théo)
avant d'écrire le moindre fichier : si l'une échoue, aucune n'est écrite.
"""
import json, os, re, sys

ICI = os.path.dirname(os.path.abspath(__file__))
MODELE = os.path.dirname(ICI)                       # dépôt de Théo
UNE = len(sys.argv) == 4 and sys.argv[1] == '--une'
if UNE:   # une seule personne : ses réglages, écrits directement dans le dossier de sortie
    P = {'une': json.load(open(sys.argv[2], encoding='utf-8'))}
    RACINE = None
else:
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
    html = remplacer(html, "'jauge.' + k", f"'{p['prefixe_stockage']}' + k", n=4)
    html = remplacer(html, r'const HEURES_SEMAINE_DEFAUT = [0-9.]+;', f'const HEURES_SEMAINE_DEFAUT = {p.get("heures_semaine", 35)};', regex=True)
    jd = '[' + ', '.join(f"['{a}', '{b}']" for a, b in p['jd_defaut']) + ']'   # jours avec dépenses non saisies (voyage)
    html = remplacer(html, "const JD_DEFAUT = [['2026-11-07', '2026-11-15']];", f'const JD_DEFAUT = {jd};')
    jr = '[' + ', '.join(f"['{a}', '{b}']" for a, b in p.get('jd_retires', [])) + ']'   # périodes à retirer une seule fois de la préférence
    html = remplacer(html, "const JD_RETIRES = [];", f'const JD_RETIRES = {jr};')
    html = remplacer(html, 'const TEL_DISPO = true;', 'const TEL_DISPO = false;')   # mode téléphone : seulement Théo pour l'instant (24/11)
    sw = remplacer(lire('sw.js'), "const PREFIXE = 'jauge-v';", f"const PREFIXE = '{p['prefixe_cache']}';")
    man = remplacer(lire('manifest.json'), '"name": "Jauge · mon budget"', f'"name": "{p["nom_appli"]}"')
    man = remplacer(man, '"short_name": "Jauge",', f'"short_name": "{p["nom_court"]}",')
    gs = lire('apps-script/Code.js')
    gs = remplacer(gs, ' * BUDGET · API du budget (Apps Script)', f' * BUDGET · API {p["nom_script"]} (Apps Script)')
    gs = remplacer(gs, "const ID_FICHIER = '';", f"const ID_FICHIER = '{p['id_fichier']}'; // {p['commentaire_fichier']}")
    clasp = remplacer(lire('apps-script/.clasp.json'), r'"scriptId": "[^"]*"', f'"scriptId": "{p["script_id"]}"', regex=True)
    return {'index.html': html, 'sw.js': sw, 'moteur.js': lire('moteur.js'), 'sauvegarde.js': lire('sauvegarde.js'), 'manifest.json': man, 'apps-script/Code.js': gs,
            'apps-script/appsscript.json': lire('apps-script/appsscript.json'), 'apps-script/.clasp.json': clasp}

# Valeurs propres à Théo qui ne doivent JAMAIS rester dans une copie
TRACES = [(r"""['"]jauge\.""", "préfixe de stockage de Théo (jauge.)"),
          (r'38\.67', "heures par semaine de Théo (38.67)"),
          (re.escape('AKfycbzdbw1TzpRU16ftWHzSf04CE_Y6lfvfH08uuHF1na_uz97gCLdYr5fylt8F_QvUQBwRzQ'), "id de déploiement du script de Théo"),
          (r"'jauge-v'", "préfixe de cache de Théo (jauge-v)"),
          (re.escape('1yoZbbWBADnowe6eiwLnk_D5wMIkyAEFNrRtombhPq8qKs5PKRv1CQaGl'), "scriptId du script de Théo")]

def controler(cle, fichiers):
    for nom, txt in fichiers.items():
        for motif, quoi in TRACES:
            t = re.search(motif, txt)
            if t:
                ligne = txt.count('\n', 0, t.start()) + 1
                raise SystemExit(f'Copie {cle} : il reste une trace de Théo ({quoi}) dans {nom}, ligne {ligne}. Rien n\'a été écrit.')

COPIES = []
for cle, p in P.items():
    if cle.startswith('_'): continue
    fichiers = fabriquer(p)
    controler(cle, fichiers)
    COPIES.append((cle, p, fichiers))
# Tout est vérifié pour les deux copies : on peut écrire.
for cle, p, fichiers in COPIES:
    dest = os.path.abspath(sys.argv[3]) if UNE else os.path.join(RACINE, p['depot'])
    for nom, txt in fichiers.items():
        chemin = os.path.join(dest, nom); os.makedirs(os.path.dirname(chemin), exist_ok=True)
        open(chemin, 'w', encoding='utf-8').write(txt)
    print(f'{cle} : {len(fichiers)} fichiers écrits dans {dest}')
