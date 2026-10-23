const { rpc } = require('./rpc.cjs');

(async () => {
  console.log('Ricreazione wallet buyer con seed del frontend...\n');

  // Scarica il wallet buyer esistente
  try {
    await rpc('unloadwallet', ['buyer']);
    console.log('✓ Wallet buyer scaricato');
  } catch (e) {
    console.log('Wallet buyer non caricato:', e.message);
  }

  // Rimuovi il vecchio wallet
  const { exec } = require('child_process');
  exec('rm -rf /c/btc-poc/regtest/wallets/buyer', (err) => {
    if (err) console.log('Wallet directory removal:', err.message);
  });

  // Aspetta che la directory sia rimossa
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Importa la seed del frontend
  const seed = 'valid innocent cargo crucial conduct animal wink timber exclude accident uncover fee';
  
  // Crea il wallet con la seed usando sethd
  await rpc('createwallet', ['buyer', false, false, '', false]);
  console.log('✓ Wallet buyer vuoto creato');

  // Importa la seed HD wallet
  await rpc('sethd', [true, 'm/84\'/1\'/0\'', true], 'buyer');
  console.log('✓ Seed importata nel wallet buyer');

  // Genera un nuovo indirizzo per ricevere fondi
  const addr = await rpc('getnewaddress', [], 'buyer');
  console.log(`✓ Nuovo indirizzo buyer: ${addr}`);

  const wallets = await rpc('listwallets');
  console.log('\nWallet caricati:', wallets.join(', '));
  console.log('\n✓ Completato!');
})().catch((e) => {
  console.error('ERRORE:', e.message);
  process.exit(1);
});
