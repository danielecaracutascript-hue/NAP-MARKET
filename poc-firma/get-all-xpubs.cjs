const { loadKeys, accountKey } = require('./common.cjs');

const keys = loadKeys();

console.log('=== CHIAVI PER IL FRONTEND ===\n');
console.log('PLATFORM_XPUB=' + accountKey(keys.platform));
console.log('\nBUYER_MNEMONIC=' + keys.buyer);
console.log('SELLER_MNEMONIC=' + keys.seller);
console.log('\nSalva queste chiavi per usarle nel marketplace!');
