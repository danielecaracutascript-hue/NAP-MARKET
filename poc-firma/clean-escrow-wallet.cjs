const { rpc } = require('./rpc.cjs');

(async () => {
  console.log('Pulizia wallet escrow1...\n');

  try {
    // Rimuovi tutti i descriptor dal wallet escrow1
    const descriptors = await rpc('listdescriptors', [], 'escrow1');
    console.log('Descriptor attuali:', descriptors.length);

    for (const desc of descriptors) {
      if (desc.desc) {
        console.log('Rimozione:', desc.desc.substring(0, 50) + '...');
        await rpc('removedescriptor', [desc.desc], 'escrow1');
      }
    }

    console.log('\n✓ Wallet escrow1 pulito');
  } catch (e) {
    console.log('Errore o wallet vuoto:', e.message);
  }

  // Verifica
  const after = await rpc('listdescriptors', [], 'escrow1');
  console.log('\nDescriptor rimanenti:', after.length);
})().catch((e) => {
  console.error('ERRORE:', e.message);
  process.exit(1);
});
