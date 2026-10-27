const { bip39 } = require('bip39');
const { networks } = require('bitcoinjs-lib');
const lib = require('@bitcoinerlab/descriptors');

const { rpc } = require('./rpc.cjs');

(async () => {
  console.log('Sincronizzazione wallet buyer con seed frontend...\n');

  const seed = 'valid innocent cargo crucial conduct animal wink timber exclude accident uncover fee';
  const network = networks.regtest;

  // Scarica il wallet buyer esistente
  try {
    await rpc('unloadwallet', ['buyer']);
    console.log('✓ Wallet buyer scaricato');
  } catch (e) {
    console.log('Wallet buyer non caricato:', e.message);
  }

  // Rimuovi la vecchia directory
  const { exec } = require('child_process');
  exec('rm -rf /c/btc-poc/regtest/wallets/buyer', (err) => {
    if (err) console.log('Directory removal:', err.message);
  });

  // Aspetta
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Crea wallet vuoto
  await rpc('createwallet', ['buyer', false, false, '', false]);
  console.log('✓ Wallet buyer vuoto creato');

  // Importa la seed HD wallet
  await rpc('sethd', [true, "m/84'/1'/0'", true], 'buyer');
  console.log('✓ Seed importata nel wallet buyer');

  // Genera un nuovo indirizzo
  const addr = await rpc('getnewaddress', [], 'buyer');
  console.log(`✓ Nuovo indirizzo buyer: ${addr}`);

  // Distribuire fondi se necessario
  const balance = await rpc('getbalance', [], 'buyer');
  console.log(`Balance wallet buyer: ${balance} BTC`);

  if (balance < 1) {
    console.log('\nDistribuzione fondi al wallet buyer...');
    const minerAddr = await rpc('getnewaddress', [], 'miner');
    const txid = await rpc('sendtoaddress', [addr, 1], 'miner');
    await rpc('generatetoaddress', [6, minerAddr], 'miner');
    console.log(`✓ Inviati 1 BTC a buyer: ${txid}`);
  }

  const wallets = await rpc('listwallets');
  console.log('\nWallet caricati:', wallets.join(', '));
  console.log('\n✓ Completato!');
})().catch((e) => {
  console.error('ERRORE:', e.message);
  process.exit(1);
});
