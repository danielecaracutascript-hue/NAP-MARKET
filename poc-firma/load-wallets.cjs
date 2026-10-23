const { rpc } = require('./rpc.cjs');

(async () => {
  console.log('Caricamento wallet...\n');

  try {
    await rpc('loadwallet', ['shipping']);
    console.log('✓ Wallet shipping caricato');
  } catch (e) {
    console.log('Wallet shipping già caricato o errore:', e.message);
  }

  const wallets = await rpc('listwallets');
  console.log('\nWallet caricati:', wallets.join(', '));
  console.log('\n✓ Completato!');
})().catch((e) => {
  console.error('ERRORE:', e.message);
  process.exit(1);
});
