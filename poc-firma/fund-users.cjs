const { rpc } = require('./rpc.cjs');

(async () => {
  console.log('Distribuzione fondi agli utenti...\n');

  const amount = 1; // 1 BTC per utente
  const users = ['buyer', 'seller'];

  for (const user of users) {
    const addr = await rpc('getnewaddress', [], user);
    const txid = await rpc('sendtoaddress', [addr, amount], 'miner');
    console.log(`✓ Inviati ${amount} BTC a ${user}: ${txid}`);
  }

  // Genera blocchi per confermare
  const mineTo = await rpc('getnewaddress', [], 'miner');
  await rpc('generatetoaddress', [6, mineTo], 'miner');
  console.log('\n✓ Generati 6 blocchi per conferma');

  // Verifica bilanci
  console.log('\nNuovi bilanci:');
  for (const user of users) {
    const balance = await rpc('getbalance', [], user);
    console.log(`  ${user}: ${balance} BTC`);
  }

  console.log('\n✓ Completato!');
})().catch((e) => {
  console.error('ERRORE:', e.message);
  process.exit(1);
});
