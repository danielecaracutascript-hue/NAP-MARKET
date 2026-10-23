const fs = require('fs');
const { lib, NETWORK, T1, T2, loadKeys, accountKey, buildDescriptor } = require('./common.cjs');
const { rpc } = require('./rpc.cjs');
const { Output, Psbt, BIP32 } = lib;

(async () => {
  const index = Number(process.argv[2]);
  const pathName = process.argv[3];
  const esc = JSON.parse(fs.readFileSync(`escrow-${index}.json`, 'utf8'));
  const desc = buildDescriptor();
  const keys = loadKeys();

  // il coordinatore usa solo le chiavi PUBBLICHE estese
  const pub = (who, branch) => {
    const xpub = accountKey(keys[who]).replace(/^\[[^\]]+\]/, '');
    return BIP32.fromBase58(xpub, NETWORK).derive(branch).derive(index).publicKey;
  };

  const FEE = 1000n;
  const total = BigInt(esc.sats);
  const cfg = {
    release:    { signers: [pub('platform', 0), pub('seller', 0)], seq: null },
    refund:     { signers: [pub('platform', 0), pub('buyer', 0)], seq: null },
    concordata: { signers: [pub('buyer', 2), pub('seller', 2)], seq: T1 },
    timelock:   { signers: [pub('buyer', 1)], seq: T2 },
  }[pathName];
  if (!cfg) throw new Error('Percorso sconosciuto: ' + pathName);

  const psbt = new Psbt({ network: NETWORK });
  const out = new Output({ descriptor: desc, index, network: NETWORK, signersPubKeys: cfg.signers });
  out.updatePsbtAsInput({ psbt, txHex: esc.txHex, vout: esc.vout });
  if (cfg.seq) psbt.setInputSequence(0, cfg.seq);

  const dest = {};
  if (pathName === 'release') {
    dest.seller = await rpc('getnewaddress', ['seller-dest'], 'miner');
    dest.platform = await rpc('getnewaddress', ['platform-fee'], 'miner');
    psbt.addOutput({ address: dest.seller, value: 96000000n - FEE });
    psbt.addOutput({ address: dest.platform, value: 8000000n });
  } else {
    const who = pathName === 'concordata' ? 'seller' : 'buyer';
    dest[who] = await rpc('getnewaddress', [who + '-dest'], 'miner');
    psbt.addOutput({ address: dest[who], value: total - FEE });
  }

  const file = `psbt-${index}-${pathName}.txt`;
  fs.writeFileSync(file, psbt.toBase64());
  fs.writeFileSync(`dest-${index}-${pathName}.json`, JSON.stringify(dest, null, 2));
  console.log(`PSBT creato: ${file}  (ricevono: ${Object.keys(dest).join(', ')})`);
})().catch((e) => { console.error('ERRORE:', e.message); process.exit(1); });
