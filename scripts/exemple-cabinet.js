#!/usr/bin/env node
// Les vrais journaux du jeu d'exemple du Cabinet (9.2.2).
//
// Le Cabinet n'embarque pas `core.js` — exprès : l'application gratuite du comptable ne doit pas
// emporter le produit qu'on vend (un test le tient). Ses paquets d'exemple n'avaient donc aucun
// fichier : des chiffres inventés, et « aucun paquet ne contient d'écritures » sur la page qui doit
// justement montrer un exercice ouvert. Skander, devant son vrai dossier : « ton jeu d'exemple ne
// montre pas le vrai écran ».
//
// Ce script calcule ICI, avec le moteur de l'application entreprise, les journaux de huit mois du
// jeu de démonstration — écritures en partie double, ventes, achats, encaissements, trésorerie,
// balance, TVA — exactement comme `pack:build` les produirait, et les range en JSON dans le
// Cabinet. Au chargement de l'exemple, le Cabinet en fait de vrais `.skanpack` recalés sur le mois
// courant (`cabcore.rebaserPaquet`), scellés pour sa propre clé, et les importe par la même porte
// qu'un paquet reçu par mail.
//
// La date de référence est FIXE : le jeu de démonstration est relatif à aujourd'hui, et ce fichier
// ne doit pas changer à chaque fois qu'on le régénère. Le recalage sur le calendrier réel se fait à
// l'usage, pas ici. Un test vérifie que le fichier commité est bien ce que ce script produit.
//
//   node scripts/exemple-cabinet.js
const path = require('path');
const fs = require('fs');
const C = require('../src/renderer/core.js');
const { buildDemoData } = require('../src/renderer/demo.js');

const REFERENCE = '2026-09-16';
const MOIS = 8;
const SORTIE = path.join(__dirname, '..', 'src', 'cabinet', 'exemple-paquets.json');

function ajouterMois(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

function fabriquer() {
  const data = buildDemoData({ name: 'Entreprise d\'exemple', currency: 'TND' }, REFERENCE);
  const company = data.company;
  const mois = [];
  for (let k = 1; k <= MOIS; k++) {
    const m = ajouterMois(REFERENCE.slice(0, 7), -k);
    const [y, mm] = m.split('-');
    const period = C.packPeriod(y, mm);
    // Le paquet se fabrique le 6 du mois suivant à 8 h 15 : jamais pendant le mois qu'il couvre.
    const plan = C.packPlan(data, company, period, { at: `${ajouterMois(m, 1)}-06T08:15:00.000Z`, device: 'poste-exemple' });
    // Le fichier doit être IDENTIQUE d'une passe à l'autre, sinon le test qui le compare à sa source
    // ne prouve rien. La seule chose qui variait : les identifiants tirés au hasard des salariés,
    // recopiés dans la déclaration CNSS. Ils deviennent « salarie-1 », « salarie-2 »… dans l'ordre
    // d'apparition — un identifiant interne n'a aucun sens hors de l'application qui l'a tiré.
    const ids = new Map();
    const stable = texte => texte.replace(/"employeeId": "([^"]+)"/g, (_, id) => {
      if (!ids.has(id)) ids.set(id, 'salarie-' + (ids.size + 1));
      return `"employeeId": "${ids.get(id)}"`;
    });
    const fichiers = plan.entries.filter(e => e.kind === 'text').map(e => ({ chemin: e.path, texte: stable(String(e.text == null ? '' : e.text)) }));
    // L'entreprise et les fichiers (avec leurs empreintes) sont posés par le Cabinet au chargement :
    // ici on ne garde que ce qui vient des DONNÉES.
    const { entreprise, fichiers: _f, genereLe: _g, poste: _p, ...manifest } = plan.manifest;
    void entreprise; void _f; void _g; void _p;
    mois.push({ offset: k, mois: m, manifest, fichiers,
      lignes: Object.fromEntries(plan.entries.filter(e => e.kind === 'text' && e.rows != null).map(e => [e.path, e.rows])) });
  }
  return { reference: REFERENCE, source: 'scripts/exemple-cabinet.js', mois };
}

if (require.main === module) {
  const out = fabriquer();
  fs.writeFileSync(SORTIE, JSON.stringify(out, null, 1) + '\n');
  const ko = Math.round(fs.statSync(SORTIE).size / 1024);
  console.log(`${SORTIE} : ${out.mois.length} mois, ${ko} Ko`);
  out.mois.forEach(m => console.log(`  ${m.mois}  ${m.fichiers.length} fichiers · ${m.lignes['journaux/ecritures.csv'] || 0} écritures · CA ${m.manifest.chiffres.ca}`));
}

module.exports = { fabriquer, REFERENCE, MOIS, SORTIE, ajouterMois };
