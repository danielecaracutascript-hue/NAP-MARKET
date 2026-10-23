const fs = require('fs');
const { lib, NETWORK, T1, T2, loadKeys, accountKey, buildDescriptor } = require('./common.cjs');
const { rpc } = require('./rpc.cjs');
const { Output, Psbt, BIP32 } = lib;

(async () => {
  const index = Number(process.argv[2]);
  const pathName = process.argv[3];
  const file = process.argv[4];
  const desc = buildDescriptor();
  const keys = loadKeys();
  const pub = (who, branch) => {
    const xpub = accountKey(keys[who]).replace(/^\[[^\]]+\]/, '');
    return BIP32.fromBase58(xpub, NETWORK).derive(branch).derive(index).publicKey;
  };
  const signersFor = {
    release: [pub('platform', 0), pub('seller', 0)],
    refund: [pub('platform', 0), pub('buyer', 0)],
    concordata: [pub('buyer', 2), pub('seller', 2)],
    timelock: [pub('buyer', 1)],
  }[pathName];

  const psbt = Psbt.fromBase64(fs.readFileSync(file, 'utf8').trim(), { network: NETWORK });
  const out = new Output({ descriptor: desc, index, network: NETWORK, signersPubKeys: signersFor });

  let hex = null;
  let how = '';
  try {
    if (typeof lib.finalizePsbt === 'function') {
      lib.finalizePsbt({ psbt, outputs: [out] });
      how = 'libreria (finalizePsbt)';
    } else {
      out.finalizePsbtInput({ index: 0, psbt });
      how = 'libreria (finalizePsbtInput)';
    }
    hex = psbt.extractTransaction().toHex();
  } catch (e) {
    console.log('Finalizzazione con la libreria non riuscita:', e.message);
    const info = await rpc('getdescriptorinfo', [desc.replace(/'/g, 'h')]);
    const r = await rpc('descriptorprocesspsbt', [psbt.toBase64(), [{ desc: info.descriptor, range: [index, index] }]]);
    if (r.complete && r.hex) { hex = r.hex; how = 'Bitcoin Core (descriptorprocesspsbt)'; }
    else console.log('Neanche Bitcoin Core riesce a completarla: complete =', r.complete);
  }
  if (!hex) { console.log('RISULTATO: la transazione NON si puo completare con le firme presenti.'); process.exit(2); }

  console.log('Transazione completata con:', how);
  const txid = await rpc('sendrawtransaction', [hex]);
  console.log('Accettata dalla rete. txid', txid);
  const mineTo = await rpc('getnewaddress', [], 'miner');
  await rpc('generatetoaddress', [1, mineTo]);
  const dest = JSON.parse(fs.readFileSync(`dest-${index}-${pathName}.json`, 'utf8'));
  for (const [who, addr] of Object.entries(dest)) {
    const got = await rpc('getreceivedbyaddress', [addr, 1], 'miner');
    console.log(`  ${who} ha ricevuto ${got} BTC (confermati)`);
  }
})().catch((e) => { console.error('ERRORE:', e.message); process.exit(1); });
