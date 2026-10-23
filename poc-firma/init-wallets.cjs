const { rpc } = require('./rpc.cjs');

(async () => {
  console.log('Inizializzazione wallet Bitcoin Core regtest...\n');

  // Crea i wallet necessari
  const wallets = ['miner', 'buyer', 'seller', 'platform', 'escrow1', 'shipping'];

  for (const wallet of wallets) {
    try {
      // Tenta di caricare il wallet se esiste
      await rpc('loadwallet', [wallet]);
      console.log(`✓ Wallet '${wallet}' caricato`);
    } catch (e) {
      // Se non esiste, crealo
      try {
        await rpc('createwallet', [wallet]);
        console.log(`✓ Wallet '${wallet}' creato`);
      } catch (err) {
        console.log(`- Wallet '${wallet}' già esiste o errore: ${err.message}`);
      }
    }
  }

  // Genera 101 blocchi sul wallet miner per ottenere coinbase
  try {
    const minerAddr = await rpc('getnewaddress', [], 'miner');
    await rpc('generatetoaddress', [101, minerAddr], 'miner');
    console.log(`\n✓ Generati 101 blocchi su wallet miner`);
    const balance = await rpc('getbalance', [], 'miner');
    console.log(`✓ Balance miner: ${balance} BTC`);
  } catch (e) {
    console.log(`\nErrore generazione blocchi: ${e.message}`);
  }

  // Verifica tutti i wallet
  console.log('\n--- Wallet caricati ---');
  const loaded = await rpc('listwallets');
  console.log(loaded.join(', '));

  console.log('\n✓ Inizializzazione completata!');
})().catch((e) => {
  console.error('ERRORE:', e.message);
  process.exit(1);
});
