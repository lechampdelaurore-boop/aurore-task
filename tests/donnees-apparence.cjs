// Données inventées (« Ferme du Petit Pré ») pour les tests et les captures de l'apparence (étape 53) :
// sept jours bien remplis comme une vraie semaine, encarts, sous-tâches, séparateur, couleurs, personnes, agenda,
// astreintes (dont une en pause), une liste à ses propres encarts, une liste verrouillée, des tâches faites récemment.
// Rien de la vraie ferme. Heure figée : les « faites » sont datées par rapport à t0.
module.exports = function donnees(t0 = Date.now()) {
  const IDS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  const listes = {}, t = {};
  IDS.forEach((id, j) => { listes[id] = { nom: JOURS[j], type: 'jour', jour: j, ordre: j + 1, by: 'francois', at: t0 }; });
  listes.astreintes = { nom: 'Astreintes', type: 'astreintes', ordre: 8, by: 'francois', at: t0 };
  listes.courses = { nom: 'Liste de courses', type: 'simple', ordre: 9, by: 'francois', at: t0,
    encartsPropres: { quinc: { nom: 'Quincaillerie', couleur: 'bleu', ordre: 1 }, coop: { nom: 'Coopérative', couleur: 'orange', ordre: 2 }, pharma: { nom: 'Pharmacie vétérinaire', couleur: 'gris', ordre: 3 } } };
  listes.idees = { nom: 'Idées pour l\'hiver', type: 'simple', ordre: 10, by: 'francois', at: t0 };
  listes.archives = { nom: 'Archives', type: 'simple', ordre: 11, by: 'francois', at: t0, verrou: { by: 'francois', at: t0 } };
  let o = 0;
  const T = (id, liste, texte, plus = {}) => { t[id] = { liste, parent: '', encart: '', ordre: ++o, texte, by: 'francois', at: t0, ...plus }; };
  // Lundi
  T('l1', 'lundi', 'Vétérinaire, vaccins des brebis', { encart: 'rdv', heure: '09:30', pour: 'max' });
  T('l2', 'lundi', 'Livraison du foin chez Dubois', { encart: 'rdv', heure: '14:00', origine: 'g:abc' });
  T('l3', 'lundi', 'Récoltes pour l\'AMAP', { encart: 'p1', couleur: 'rouge', origine: 'a:a1' });
  T('l3a', 'lundi', 'Prévenir Théo des quantités de poireaux', { parent: 'l3', couleur: 'rouge' });
  T('l3b', 'lundi', 'Peser les paniers', { parent: 'l3', couleur: 'rouge' });
  T('l4', 'lundi', 'Réparer la clôture du pré nord', { encart: 'p1', pour: 'max' });
  T('l5', 'lundi', 'Appeler le garage pour le tracteur', { encart: 'p1', pour: 'lea' });
  T('l5a', 'lundi', 'Demander un devis', { parent: 'l5' });
  T('l5s', 'lundi', '', { parent: 'l5', sep: true });
  T('l5b', 'lundi', 'Date de passage possible ?', { parent: 'l5' });
  T('l6', 'lundi', 'Irrigation des plants', { encart: 'p1', origine: 'a:a2' });
  T('l7', 'lundi', 'Ranger l\'atelier', { encart: 'p2' });
  T('l8', 'lundi', 'Désherber les carottes à la main, planches 3 à 6', { encart: 'p2', couleur: 'vert' });
  T('l9', 'lundi', 'Mettre à jour les prix du marché', { encart: 'p2', pour: 'theo' });
  // Mardi
  T('m1', 'mardi', 'Mercuriale de la coopérative avant 13 h 30', { encart: 'rdv', heure: '13:00', pour: 'theo' });
  T('m2', 'mardi', 'Semer les mâches sous tunnel', { encart: 'p1', pour: 'theo' });
  T('m2a', 'mardi', 'Rangs 1 à 4', { parent: 'm2' });
  T('m2b', 'mardi', 'Arroser après le semis', { parent: 'm2' });
  T('m3', 'mardi', 'Nettoyer les caisses', { encart: 'p1', couleur: 'vert' });
  T('m4', 'mardi', 'Commander le terreau', { encart: 'p2', couleur: 'violet' });
  T('m5', 'mardi', 'Trier les factures du mois', { encart: 'p2' });
  // Mercredi
  T('w1', 'mercredi', 'Livraison au magasin', { encart: 'rdv', heure: '16:30', pour: 'lea' });
  T('w2', 'mercredi', 'Préparer les commandes', { encart: 'p1' });
  T('w2a', 'mercredi', 'Bons de livraison', { parent: 'w2' });
  T('w3', 'mercredi', 'Contrôle de l\'irrigation des endives', { encart: 'p1', origine: 'a:a2' });
  T('w4', 'mercredi', 'Voir s\'il reste des navets', { encart: 'p2' });
  // Jeudi
  T('j1', 'jeudi', 'Formation sur la vente directe', { encart: 'rdv', heure: '08:15', origine: 'g:def' });
  T('j2', 'jeudi', 'Plantation des endives, semaine 48', { encart: 'rdv', origine: 'g:ghi' });
  T('j3', 'jeudi', 'Saisie des apports du mois', { encart: 'p1', pour: 'lea', couleur: 'bleu' });
  T('j4', 'jeudi', 'Pilotage (une fois par mois)', { encart: 'p1', pour: 'lea' });
  T('j5', 'jeudi', 'Tailler la haie du chemin', { encart: 'p2' });
  // Vendredi
  T('v1', 'vendredi', 'Marché du village', { encart: 'rdv', heure: '16:00', pour: 'max' });
  T('v2', 'vendredi', 'Chasser les rats du hangar', { encart: 'p1', origine: 'a:a1' });
  T('v3', 'vendredi', 'Tour des cultures', { encart: 'p1' });
  T('v4', 'vendredi', 'Comptabilité', { encart: 'p2', pour: 'lea' });
  T('v4a', 'vendredi', 'Refaire la fiche de la pompe', { parent: 'v4' });
  T('v4a1', 'vendredi', 'Purger et amorcer la pompe du forage', { parent: 'v4a' });
  // Samedi, dimanche
  T('s1', 'samedi', 'Trouver une balance de marché', { encart: 'p1' });
  T('s2', 'samedi', 'Faire le point de la semaine ensemble', { encart: 'p2' });
  T('d1', 'dimanche', 'Repas chez Esteban à 14 h', { encart: 'rdv' });
  // Astreintes
  T('a1', 'astreintes', 'Traite du soir', { jours: '012', zone: 'rdv', heure: '18:00', pour: 'theo' });
  T('a2', 'astreintes', 'Tour des animaux', { jours: '56', zone: 'p1', pause: true });
  T('a3', 'astreintes', 'Irrigation des plants', { jours: '0246', zone: 'p1' });
  // Liste de courses : ses propres encarts, une tâche hors encart.
  T('c0', 'courses', 'Penser au pain');
  T('c1', 'courses', 'Fil de clôture, 200 m', { encart: 'quinc' });
  T('c2', 'courses', 'Piquets acacia ×20', { encart: 'quinc' });
  T('c3', 'courses', 'Sacs de granulés ×10', { encart: 'coop' });
  T('c4', 'courses', 'Antiparasitaire', { encart: 'pharma' });
  T('i1', 'idees', 'Construire une serre à semis');
  T('i2', 'idees', 'Essayer la patate douce');
  T('x1', 'archives', 'Vieille tâche gardée pour mémoire');
  const faites = {
    f1: { at: t0 - 3600e3, by: 'francois', liste: 'samedi', texte: 'Commander les plants', t: { f1: { liste: 'samedi', parent: '', ordre: 50, texte: 'Commander les plants' } } },
    f2: { at: t0 - 7200e3, by: 'francois', liste: 'dimanche', texte: 'Fermer les poules', t: { f2: { liste: 'dimanche', parent: '', ordre: 51, texte: 'Fermer les poules' } } },
  };
  const reglages = { nom: 'Ferme du Petit Pré', encarts: { rdv: 'RDV', p1: 'P1', p2: 'P2' },
    personnes: { francois: { nom: 'François', initiale: 'F', couleur: 'rouge', ordre: 1 }, theo: { nom: 'Théo', initiale: 'T', couleur: 'bleu', ordre: 2 }, lea: { nom: 'Léa', initiale: 'L', couleur: 'rose', ordre: 3 }, max: { nom: 'Max', initiale: 'M', couleur: 'vert', ordre: 4 } } };
  return { listes, t, faites, reglages };
};
