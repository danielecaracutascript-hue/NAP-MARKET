const { lib, NETWORK, buildDescriptor } = require('./common.cjs');
const { rpc } = require('./rpc.cjs');
const { Output } = lib;

(async () => {
  const desc = buildDescriptor();
  const coreDesc = desc.replace(/'/g, 'h');   // Bitcoin Core preferisce la "h"

  const info = await rpc('getdescriptorinfo', [coreDesc]);
  console.log('Bitcoin Core accetta lo script. Solvibile:', info.issolvable);
  const coreAddrs = await rpc('deriveaddresses', [info.descriptor, [0, 4]]);

  let ok = true;
  for (let i = 0; i <= 4; i++) {
    const out = new Output({ descriptor: desc, index: i, network: NETWORK });
    const libAddr = out.getAddress();
    const same = libAddr === coreAddrs[i];
    if (!same) ok = false;
    console.log(i, same ? 'UGUALI ' : 'DIVERSI', libAddr, same ? '' : ' | core: ' + coreAddrs[i]);
  }
  console.log(ok
    ? 'RISULTATO: la libreria e Bitcoin Core costruiscono gli stessi indirizzi.'
    : 'RISULTATO: ATTENZIONE, gli indirizzi sono diversi.');
})().catch((e) => { console.error('ERRORE:', e.message); process.exit(1); });
