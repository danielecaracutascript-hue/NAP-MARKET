const { rpc } = require('./rpc.cjs');

(async () => {
  console.log('Controllo wallet utenti...\n');

  const wallets = ['buyer', 'seller', 'platform'];

  for (const wallet of wallets) {
    try {
      const balance = await rpc('getbalance', [], wallet);
      const addr = await rpc('getnewaddress', [], wallet);
      console.log(`✓ ${wallet}: ${balance} BTC (addr: ${addr})`);
    } catch (e) {
      console.log(`- ${wallet}: non caricato o errore - ${e.message}`);
    }
  }
})().catch((e) => {
  console.error('ERRORE:', e.message);
  process.exit(1);
});
