const { loadKeys, accountKey } = require('./common.cjs');

// Export only public extended keys. Never print wallet recovery phrases to the terminal.
const keys = loadKeys();

console.log('=== CHIAVI PUBBLICHE PER IL TEST ===\n');
console.log('PLATFORM_XPUB=' + accountKey(keys.platform));
console.log('BUYER_XPUB=' + accountKey(keys.buyer));
console.log('SELLER_XPUB=' + accountKey(keys.seller));
console.log('\nLe mnemonic restano nel file locale keys.json (ignorato da Git). Non copiarle nel frontend o nel repository.');
