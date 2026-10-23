const fs = require('fs');
const bip39 = require('bip39');
const { networks } = require('bitcoinjs-lib');
const lib = require('@bitcoinerlab/descriptors');

const { Output, BIP32 } = lib;
if (!Output || !BIP32) {
  console.log('Mancano Output o BIP32. Esportazioni trovate:', Object.keys(lib).join(', '));
  process.exit(1);
}

const NETWORK = networks.regtest;
const T1 = 5;   // ritardo di prova dell'uscita concordata (blocchi)
const T2 = 10;  // ritardo di prova della scadenza del compratore (blocchi)
const KEYFILE = 'keys.json';

function loadKeys() {
  if (fs.existsSync(KEYFILE)) return JSON.parse(fs.readFileSync(KEYFILE, 'utf8'));
  const keys = {
    buyer: bip39.generateMnemonic(),
    seller: bip39.generateMnemonic(),
    platform: bip39.generateMnemonic(),
  };
  fs.writeFileSync(KEYFILE, JSON.stringify(keys, null, 2));
  return keys;
}

function masterNode(mnemonic) {
  return BIP32.fromSeed(bip39.mnemonicToSeedSync(mnemonic), NETWORK);
}

// chiave pubblica estesa a livello di conto, con impronta e percorso: [fp/84'/1'/0']tpub...
function accountKey(mnemonic) {
  const m = masterNode(mnemonic);
  const fp = Buffer.from(m.fingerprint).toString('hex');
  const acct = m.derivePath("m/84'/1'/0'");
  return `[${fp}/84'/1'/0']${acct.neutered().toBase58()}`;
}

// lo stesso script dell'app: piattaforma+una parte, uscita concordata, scadenza del compratore
function buildDescriptor() {
  const k = loadKeys();
  const B = accountKey(k.buyer);
  const S = accountKey(k.seller);
  const P = accountKey(k.platform);
  const key = (x, b) => `${x}/${b}/*`;
  return (
    `wsh(or_i(and_v(v:pk(${key(P, 0)}),or_d(pk(${key(B, 0)}),pk(${key(S, 0)}))),` +
    `or_i(and_v(v:multi(2,${key(B, 2)},${key(S, 2)}),older(${T1})),` +
    `and_v(v:pk(${key(B, 1)}),older(${T2})))))`
  );
}

module.exports = { lib, NETWORK, T1, T2, loadKeys, masterNode, accountKey, buildDescriptor };
