const { rpc } = require('./rpc.cjs');

(async () => {
  console.log('Ricreazione wallet escrow1...\n');

  try {
    // Rimuovi il wallet se esiste
    await rpc('unloadwallet', ['escrow1']);
    console.log('✓ Wallet escrow1 scaricato');
  } catch (e) {
    console.log('Wallet non caricato o errore:', e.message);
  }

  // Ricrea il wallet vuoto
  await rpc('createwallet', ['escrow1']);
  console.log('✓ Wallet escrow1 ricreato');

  // Verifica
  const wallets = await rpc('listwallets');
  console.log('\nWallet caricati:', wallets.join(', '));
  console.log('\n✓ Completato!');
})().catch((e) => {
  console.error('ERRORE:', e.message);
  process.exit(1);
});
