const { rpc } = require('./rpc.cjs');

(async () => {
  try {
    await rpc('unloadwallet', ['escrow1']);
    console.log('✓ Wallet escrow1 scaricato');
  } catch (e) {
    console.log('Wallet non caricato:', e.message);
  }
})().catch((e) => {
  console.error('ERRORE:', e.message);
  process.exit(1);
});
