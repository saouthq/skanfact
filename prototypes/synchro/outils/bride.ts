// Une connexion bridée, pour mesurer « sur une connexion de 4 Mbit/s » (04 § 9.3) avec de vrais
// octets, et pas avec un calcul : un relais TCP qui ne laisse passer que N octets par seconde dans
// chaque sens, et ajoute un délai de trajet. Les deux candidats passent par le même relais.

import net from 'node:net';

export function brider(portEcoute: number, portCible: number, octetsParSeconde: number, delaiMs = 40) {
  let transferes = 0;
  const serveur = net.createServer((entree) => {
    const sortie = net.connect(portCible, '127.0.0.1');
    const tuyau = (de: net.Socket, vers: net.Socket) => {
      let dispo = 0;
      let enAttente = 0;   // octets arrivés mais pas encore passés
      let fini = false;
      const file: Buffer[] = [];
      const minuterie = setInterval(() => {
        dispo = Math.min(dispo + octetsParSeconde / 20, octetsParSeconde / 10); // un seau, 20 fois par seconde
        while (file.length && dispo >= 1) {
          const b = file[0];
          const n = Math.min(b.length, Math.floor(dispo));
          vers.write(b.subarray(0, n));
          transferes += n;
          dispo -= n;
          enAttente -= n;
          if (n === b.length) file.shift(); else file[0] = b.subarray(n);
        }
        if (fini && enAttente === 0 && !file.length) { clearInterval(minuterie); vers.end(); }
      }, 50);
      de.on('data', (b) => { enAttente += b.length; setTimeout(() => file.push(b), delaiMs); });
      de.on('end', () => setTimeout(() => { fini = true; }, delaiMs + 1));
      de.on('error', () => { clearInterval(minuterie); vers.destroy(); });
    };
    tuyau(entree, sortie);
    tuyau(sortie, entree);
  });
  return {
    ecouter: () => new Promise<void>(ok => serveur.listen(portEcoute, '127.0.0.1', () => ok())),
    fermer: () => new Promise(ok => serveur.close(() => ok(null))),
    octets: () => transferes,
    remettreAZero: () => { transferes = 0; },
  };
}
