const { rpc } = require('./rpc.cjs');

(async () => {
  const escrowAddress = process.argv[2];
  const shippingAddress = process.argv[3];
  const escrowAmount = parseFloat(process.argv[4]);
  const shippingAmount = parseFloat(process.argv[5]);

  console.log('Pagamento ordine...');
  console.log('Escrow:', escrowAddress, escrowAmount, 'BTC');
  console.log('Shipping:', shippingAddress, shippingAmount, 'BTC');

  // Invia a escrow
  const txid1 = await rpc('sendtoaddress', [escrowAddress, escrowAmount], 'miner');
  console.log('✓ Escrow txid:', txid1);

  // Invia a shipping
  const txid2 = await rpc('sendtoaddress', [shippingAddress, shippingAmount], 'miner');
  console.log('✓ Shipping txid:', txid2);

  // Genera blocchi per confermare
  const mineTo = await rpc('getnewaddress', [], 'miner');
  await rpc('generatetoaddress', [6, mineTo], 'miner');
  console.log('✓ Generati 6 blocchi per conferma');

  console.log('\n✓ Pagamento completato!');
  console.log('Torna al marketplace e clicca "Check payment"');
})().catch((e) => {
  console.error('ERRORE:', e.message);
  process.exit(1);
});
