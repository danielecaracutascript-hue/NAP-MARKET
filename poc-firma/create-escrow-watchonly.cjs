const { rpc } = require('./rpc.cjs');

(async () => {
  console.log('Creazione wallet escrow1 (watch-only)...\n');

  // Crea wallet watch-only (senza chiavi private)
  // createwallet "walletname" disable_private_keys blank passphrase avoid_reuse
  await rpc('createwallet', ['escrow1', true, false, '', false]);
  console.log('✓ Wallet escrow1 creato come watch-only');

  // Verifica
  const wallets = await rpc('listwallets');
  console.log('\nWallet caricati:', wallets.join(', '));
  console.log('\n✓ Completato!');
})().catch((e) => {
  console.error('ERRORE:', e.message);
  process.exit(1);
});
