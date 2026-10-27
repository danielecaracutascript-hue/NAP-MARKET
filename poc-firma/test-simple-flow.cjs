const { createClient } = require('@supabase/supabase-js');
const { rpc } = require('./rpc.cjs');

// Configurazione Supabase
const supabaseUrl = 'https://qhoaxusfjugmxwbobfqo.supabase.co';
const supabaseKey = 'sb_secret_OoxbgLEJp-O0na-Wywg8gQ_5zV1W_FD';
const supabase = createClient(supabaseUrl, supabaseKey);

let orderId = null;
let listingId = null;

async function logStep(step, status = 'INFO') {
  console.log(`[${status}] ${step}`);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testFlow() {
  try {
    console.log('\n=== TEST AUTOMATIZZATO ===\n');

    // PASSO 1: Verifica listing esistente
    logStep('PASSO 1: Verifica listing esistente');
    const { data: listings, error: listingsError } = await supabase
      .from('listings')
      .select('id, title')
      .limit(10);

    if (listingsError) throw listingsError;
    if (!listings || listings.length === 0) {
      throw new Error('Nessun listing trovato. Creane uno dal browser prima.');
    }
    listingId = listings[0].id;
    logStep(`Listing ID: ${listingId} (${listings[0].title})`, 'SUCCESS');

    // PASSO 2: Verifica ordine esistente
    logStep('PASSO 2: Verifica ordine esistente');
    const { data: orders } = await supabase
      .from('orders')
      .select('id, status')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!orders || orders.length === 0) {
      throw new Error('Nessun ordine trovato. Crea un ordine dal browser prima.');
    }
    orderId = orders[0].id;
    logStep(`Ordine ID: ${orderId}, Status: ${orders[0].status}`, 'SUCCESS');

    // PASSO 3: Test check-payment (se status è CREATED)
    if (orders[0].status === 'CREATED') {
      logStep('PASSO 3: Ordine in CREATED - richiede pagamento', 'WARN');
      logStep('Usa "Pay from wallet" dal browser per continuare', 'INFO');
      return;
    }

    // PASSO 4: Test transizioni stato
    logStep('PASSO 4: Verifica transizioni stato');
    const { data: order } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    logStep(`Status corrente: ${order.status}`, 'INFO');
    logStep(`Created: ${order.created_at}`, 'INFO');
    logStep(`Escrow: ${order.escrow_address || 'N/A'}`, 'INFO');
    logStep(`Shipping: ${order.shipping_address || 'N/A'}`, 'INFO');

    if (order.funding_txid) {
      logStep(`Funding TXID: ${order.funding_txid}`, 'SUCCESS');
    }

    if (order.refunded_txid) {
      logStep(`Refund TXID: ${order.refunded_txid}`, 'SUCCESS');
    }

    // PASSO 5: Verifica eventi
    logStep('PASSO 5: Verifica eventi ordine');
    const { data: events } = await supabase
      .from('order_events')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (events) {
      events.forEach(event => {
        logStep(`  - ${event.type} (${event.actor_role})`, 'INFO');
      });
    }

    console.log('\n=== TEST COMPLETATO ===\n');
    console.log('Per testare il flusso completo:');
    console.log('1. Crea un nuovo ordine dal browser');
    console.log('2. Usa "Pay from wallet"');
    console.log('3. Conferma spedizione come seller');
    console.log('4. Conferma consegna come buyer');
    console.log('5. Richiedi return');
    console.log('6. Conferma return');
    console.log('7. Esegui refund');
    console.log('8. Riesegui questo script per verificare');

  } catch (error) {
    console.error('\n=== ERRORE ===');
    console.error(error.message);
    process.exit(1);
  }
}

testFlow();
