const { loadKeys, accountKey } = require('./common.cjs');

const keys = loadKeys();
const platformXpub = accountKey(keys.platform);

console.log('PLATFORM_XPUB=' + platformXpub);
console.log('\nCopia questo valore nel .env.local del marketplace');
