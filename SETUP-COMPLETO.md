# Setup ambiente di test - Bitcoin Marketplace

Queste istruzioni sono per un ambiente locale **regtest**. Non inserire mai seed, mnemonic, chiavi private o credenziali Supabase nei file versionati.

## Configurazione locale

1. Avvia Bitcoin Core in regtest e crea/carica i wallet di test necessari.
2. Crea `marketplace/.env.local` copiando le variabili necessarie da `marketplace/.env.example` e `marketplace/.env.bitcoin.example`.
3. Inserisci i valori segreti solo nel file locale `.env.local`, che non deve essere versionato.
4. Per l'RPC locale, verifica che URL e percorso del cookie corrispondano alla configurazione effettiva di Bitcoin Core.
5. Avvia i controlli dalla cartella `marketplace` con `npm ci`, `npm run lint` e `npm run build`.

## Sicurezza

- Non conservare mnemonic in `poc-firma/keys.json` o in altri file del repository.
- Non usare credenziali reali in test o documentazione.
- Le chiavi pubbliche estese (xpub) non consentono di spendere fondi, ma possono esporre informazioni sulla cronologia degli indirizzi.
- Rimuovere un segreto dal file corrente non lo rimuove dalla cronologia Git. Per segreti già pubblicati, ruotare/revocare le credenziali e valutare la riscrittura della cronologia.
- Tutti i test di firma e transazione devono usare regtest/signet e fondi di test.

## Script utili

- `poc-firma/init-wallets.cjs`: inizializzazione dei wallet Bitcoin Core di test.
- `poc-firma/get-platform-xpub.cjs`: recupero della chiave pubblica estesa della piattaforma.
- `poc-firma/get-all-xpubs.cjs`: recupero delle chiavi pubbliche estese dei wallet.
- `marketplace/test-bitcoin.js`: verifica della connessione RPC.
