const { rpc } = require('./rpc.cjs');

(async () => {
  console.log('Caricamento tutti i wallet...\n');

  const wallets = ['miner', 'buyer', 'seller', 'platform', 'shipping', 'escrow1'];

  for (const wallet of wallets) {
    try {
      await rpc('loadwallet', [wallet]);
      console.log(`✓ ${wallet} caricato`);
    } catch (e) {
      // Già caricato o errore
      console.log(`- ${wallet}: ${e.message.substring(0, 50)}...`);
    }
  }

  const loaded = await rpc('listwallets');
  console.log('\nWallet caricati:', loaded.join(', '));
  console.log('\n✓ Completato!');
})().catch((e) => {
  console.error('ERRORE:', e.message);
  process.exit(1);
});
