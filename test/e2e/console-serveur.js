// Le serveur de la console, PARTAGÉ par les deux parcours qui l'ouvrent : `e2e:console` (qui
// clique) et `e2e:console-rendu` (qui mesure). Il vivait dans console.js ; l'instrument de rendu
// en avait besoin à l'identique, et une seconde copie aurait divergé au premier ajustement —
// c'est la règle qui a sorti les sondes dans harnais.js (9.4.3), appliquée au décor.
//
// Ce n'est PAS une imitation : c'est `plateforme/skanfact-api.mjs`, le fichier déployé sur
// Cloudflare, posé derrière un `http.createServer` avec une vraie base SQLite sur le vrai schéma.

const http = require('http');
const path = require('path');
const L = require('../../src/licence.js');
const { baseD1 } = require('../d1-sqlite');

const MODULE = path.join(__dirname, '..', '..', 'plateforme', 'skanfact-api.mjs');
const SECRET = 'un-secret-d-administration-bien-assez-long';

async function servir() {
  const P = await import('file://' + MODULE);
  const master = L.generateKeys();
  const srv = L.generateKeys();
  const mails = [];
  // Resend, et lui seul, est intercepté. Tout autre appel sortant du worker serait une faute — et
  // il passerait par le vrai réseau, donc échouerait bruyamment.
  const vraiFetch = globalThis.fetch;
  globalThis.fetch = async (url, o) => {
    if (String(url) === P.MAIL_API) { mails.push(JSON.parse(o.body)); return new Response(JSON.stringify({ id: 'm_' + mails.length }), { status: 200 }); }
    return vraiFetch(url, o);
  };
  const env = {
    DB: baseD1(), ADMIN_SECRET: SECRET, APP_SECRET: 'secret-de-test-' + 'x'.repeat(20),
    SRV_PRIVATE_KEY: srv.privateKey, RESEND_API_KEY: 're_test',
    LICENCE_PUBLIC_KEYS: JSON.stringify([{ kid: 'master', publicKey: master.publicKey }, { kid: 'srv-1', publicKey: srv.publicKey }])
  };
  const cles = [{ kid: 'master', publicKey: master.publicKey }, { kid: 'srv-1', publicKey: srv.publicKey }];

  const srvHttp = http.createServer((req, res) => {
    const morceaux = [];
    req.on('data', c => morceaux.push(c));
    req.on('end', async () => {
      let rep;
      try {
        rep = await P.default.fetch(new Request('https://api.exemple.tn' + req.url, {
          method: req.method, headers: req.headers, body: morceaux.length ? Buffer.concat(morceaux) : undefined
        }), env);
      } catch (e) { res.writeHead(500); return res.end(String(e && e.message)); }
      const texte = await rep.text();
      res.writeHead(rep.status, { 'Content-Type': rep.headers.get('Content-Type') || 'application/json' });
      res.end(texte);
    });
  });
  await new Promise(r => srvHttp.listen(0, '127.0.0.1', r));
  return { srv: srvHttp, base: 'http://127.0.0.1:' + srvHttp.address().port, mails, cles, db: env.DB, restaurer: () => { globalThis.fetch = vraiFetch; } };
}


module.exports = { servir, SECRET };
