// A toy Stellar-flavored API for exercising the API analytics path.
const http = require('node:http');
const express = require('express');

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const jitter = (min, max) => min + Math.random() * (max - min);

// Port 3100: Express. The instrumentation sets http.route, e.g. /accounts/:account.
const app = express();

app.get('/health', (req, res) => res.json({ ok: true }));

app.get('/accounts/:account', async (req, res) => {
  await wait(jitter(15, 60));
  res.json({ account: req.params.account, balances: [] });
});

app.get('/tx/:hash', async (req, res) => {
  await wait(jitter(20, 90));
  res.json({ hash: req.params.hash, successful: true });
});

app.post('/bounties/:id/submissions', async (req, res) => {
  await wait(jitter(40, 160));
  res.status(201).json({ bounty: req.params.id });
});

app.get('/slow', async (req, res) => {
  await wait(jitter(400, 900));
  res.json({ slow: true });
});

app.get('/boom', (req, res) => res.status(500).json({ error: 'boom' }));

app.listen(3100, () => console.log('express API on :3100'));

// Port 3101: a plain node:http server with no router, so spans carry only the raw
// path. The SCF writer's default rules normalize it (Stellar addresses, ids, hashes).
http
  .createServer(async (req, res) => {
    await wait(jitter(5, 30));
    const path = (req.url || '/').split('?')[0];
    res.writeHead(path.startsWith('/legacy/') ? 200 : 404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ path }));
  })
  .listen(3101, () => console.log('raw http API on :3101'));
