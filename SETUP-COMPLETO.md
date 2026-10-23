# Setup Completo - Bitcoin Marketplace

## ✅ Fatto automaticamente

1. **Wallet Bitcoin Core creati** sul nodo regtest:
   - miner, buyer, seller, platform, escrow1, shipping
   - Balance miner: 6598+ BTC

2. **Chiavi generate** per il test:
   - PLATFORM_XPUB: `[da318210/84'/1'/0']tpubDCqFfjsRMVjzxiDQ7qKNBe7wwj8cXUHA9p1EdfiuhwtapfVhjwHCsc6dU9Eg2ao5UHu56eWbzrch1wu2yASzDPKyJ6zE5cG5KaHqePZGS4o`
   - BUYER_MNEMONIC: `valid innocent cargo crucial conduct animal wink timber exclude accident uncover fee`
   - SELLER_MNEMONIC: `clog claim napkin dignity follow seven dutch cigar later stereo scene odor`

3. **Script di test creati**:
   - `poc-firma/init-wallets.cjs` - inizializza wallet Bitcoin Core
   - `poc-firma/get-platform-xpub.cjs` - ottiene la chiave piattaforma
   - `poc-firma/get-all-xpubs.cjs` - ottiene tutte le chiavi
   - `marketplace/test-bitcoin.js` - verifica connessione RPC

## 🔵 Azioni richieste (da fare manualmente)

### 1. Aggiorna .env.local del marketplace

Apri `marketplace/.env.local` e aggiungi:

```env
BITCOIN_RPC_URL=http://127.0.0.1:18443
BITCOIN_RPC_COOKIE_PATH=C:\btc-poc\regtest\.cookie
PLATFORM_XPUB=[da318210/84'/1'/0']tpubDCqFfjsRMVjzxiDQ7qKNBe7wwj8cXUHA9p1EdfiuhwtapfVhjwHCsc6dU9Eg2ao5UHu56eWbzrch1wu2yASzDPKyJ6zE5cG5KaHqePZGS4o
ESCROW_CONCORDATA_BLOCKS=5
ESCROW_BUYER_TIMELOCK_BLOCKS=10
```

### 2. Riavvia il dev server

```bash
cd marketplace
npm run dev
```

### 3. Crea account Buyer

1. Vai su http://localhost:3000
2. Sign up con email/password
3. Vai su http://localhost:3000/protected/wallet
4. Clicca "Restore from 12 words"
5. Inserisci: `valid innocent cargo crucial conduct animal wink timber exclude accident uncover fee`
6. Imposta password
7. Clicca "Register public key"

### 4. Crea account Seller

1. Logout
2. Sign up con email/password diversa
3. Vai su http://localhost:3000/protected/wallet
4. Clicca "Restore from 12 words"
5. Inserisci: `clog claim napkin dignity follow seven dutch cigar later stereo scene odor`
6. Imposta password
7. Clicca "Register public key"

### 5. Crea listing (come Seller)

1. Vai su http://localhost:3000/protected/listings
2. Crea un nuovo listing
3. Imposta prezzo e dettagli

### 6. Acquista (come Buyer)

1. Logout seller, login buyer
2. Vai su listings
3. Acquista il listing
4. Quando vedi l'ordine, clicca "Get payment details"
5. **Non dovrebbe più dare errore!**

## 🔧 Troubleshooting

Se ricevi ancora errore "Requested wallet does not exist":

```bash
cd poc-firma
node init-wallets.cjs
```

Per verificare la connessione:

```bash
cd marketplace
node test-bitcoin.js
```

## 📝 Note

- Il nodo Bitcoin Core deve essere in esecuzione su regtest (porta 18443)
- I wallet sono persistenti, non ricrearli
- Le mnemonic sono salvate in `poc-firma/keys.json` per riferimento
