const fs = require('fs');
const { lib, NETWORK, loadKeys, masterNode } = require('./common.cjs');
const { Psbt, signers } = lib;

const who = process.argv[2];
const file = process.argv[3];
if (!signers || !signers.signBIP32) {
  console.log('signers.signBIP32 non esiste. Esportazioni trovate:', Object.keys(lib).join(', '));
  process.exit(1);
}
const psbt = Psbt.fromBase64(fs.readFileSync(file, 'utf8').trim(), { network: NETWORK });
signers.signBIP32({ psbt, masterNode: masterNode(loadKeys()[who]) });
fs.writeFileSync(file, psbt.toBase64());
const sigs = psbt.data.inputs[0].partialSig ? psbt.data.inputs[0].partialSig.length : 0;
console.log(`${who} ha firmato. Firme presenti nell'input: ${sigs}`);
