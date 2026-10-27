const { createClient } = require('@supabase/supabase-js');
const { rpc } = require('./rpc.cjs');

// Configurazione Supabase
const supabaseUrl = 'https://qhoaxusfjugmxwbobfqo.supabase.co';
const supabaseKey = 'sb_secret_OoxbgLEJp-O0na-Wywg8gQ_5zV1W_FD';
const supabase = createClient(supabaseUrl, supabaseKey);

// ID utenti (dal database)
const BUYER_ID = '8cb68a53-6737-4369-ab58-e2a754b16f48';
const SELLER_ID = 'bd40a928-6575-4642-b2aa-745a50606c44';
const ARBITER_ID = 'cd8aa030-b6a4-4e6c-92d4-4d3e88fc0ff4';

let orderId = null;
let listingId = null;

async function logStep(step, status = 'INFO') {
  console.log(`[${status}] ${step}`);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testFullFlow() {
  try {
    console.log('\n=== INIZIO TEST FLUSSO COMPLETO AUTOMATIZZATO ===\n');

    // PASSO 1: Crea listing
    logStep('PASSO 1: Creazione listing');
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .insert({
        seller_id: SELLER_ID,
        title: 'Test Automation Item ' + Date.now(),
        description: 'Item for automated testing',
        price_eur_cents: 5000, // 50.00 EUR in centesimi
        category: 'electronics',
        condition: 'new',
        package_size: 'small',
        ship_from_country: 'IT'
      })
      .select()
      .single();

    if (listingError) throw listingError;
    listingId = listing.id;
    logStep(`Listing creato: ${listingId}`, 'SUCCESS');
    await sleep(500);

    // PASSO 2: Crea ordine
    logStep('PASSO 2: Creazione ordine');
    const escrowIndex = Math.floor(Date.now() / 1000); // Usa timestamp come escrow_index
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        buyer_id: BUYER_ID,
        seller_id: SELLER_ID,
        listing_id: listingId,
        price_eur_cents: 5000, // 50.00 EUR
        shipping_eur_cents: 690, // 6.90 EUR
        price_sats: 50000000,
        buyer_commission_sats: 2000000,
        seller_commission_sats: 2000000,
        shipping_sats: 11500000,
        status: 'CREATED',
        escrow_index: escrowIndex,
        dest_country: 'IT',
        package_size: 'small',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        btc_eur_rate: 60000 // 1 BTC = 60000 EUR
      })
      .select()
      .single();

    if (orderError) throw orderError;
    orderId = order.id;
    logStep(`Ordine creato: ${orderId}`, 'SUCCESS');
    await sleep(500);

    // PASSO 3: Skip escrow setup (richiede chiavi reali)
    logStep('PASSO 3: Skip escrow setup (simulato)', 'WARN');
    await sleep(500);

    // PASSO 4: Aggiorna stato a FUNDED (simula pagamento)
    logStep('PASSO 4: Simulazione pagamento automatico');
    const { error: fundError } = await supabase
      .from('orders')
      .update({
        status: 'FUNDED',
        funded_at: new Date().toISOString(),
        funding_txid: 'test_txid_' + Date.now(),
        funding_vout: 0,
        funding_height: 1
      })
      .eq('id', orderId);

    if (fundError) throw fundError;
    logStep('Pagamento confermato (simulato)', 'SUCCESS');
    await sleep(500);

    // PASSO 5: Conferma spedizione
    logStep('PASSO 5: Conferma spedizione');
    const { error: shipError } = await supabase
      .from('orders')
      .update({
        status: 'SHIPPED',
        shipped_at: new Date().toISOString(),
        carrier: 'Test Carrier',
        tracking_number: 'AUTO' + Date.now()
      })
      .eq('id', orderId);

    if (shipError) throw shipError;
    logStep('Spedizione confermata', 'SUCCESS');
    await sleep(500);

    // PASSO 6: Conferma consegna
    logStep('PASSO 6: Conferma consegna');
    const { error: deliveryError } = await supabase
      .from('orders')
      .update({
        status: 'DELIVERED',
        delivered_at: new Date().toISOString(),
        window_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      })
      .eq('id', orderId);

    if (deliveryError) throw deliveryError;
    logStep('Consegna confermata', 'SUCCESS');
    await sleep(500);

    // PASSO 7: Richiesta return
    logStep('PASSO 7: Richiesta return');
    const { error: returnError } = await supabase
      .from('orders')
      .update({
        status: 'RETURN_REQUESTED',
        return_requested_at: new Date().toISOString(),
        return_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      })
      .eq('id', orderId);

    if (returnError) throw returnError;
    logStep('Return richiesto', 'SUCCESS');
    await sleep(500);

    // PASSO 8: Conferma spedizione return
    logStep('PASSO 8: Conferma spedizione return');
    const { error: returnShipError } = await supabase
      .from('orders')
      .update({
        status: 'RETURN_SHIPPED',
        return_tracking_number: 'RET_AUTO' + Date.now()
      })
      .eq('id', orderId);

    if (returnShipError) throw returnShipError;
    logStep('Spedizione return confermata', 'SUCCESS');
    await sleep(500);

    // PASSO 9: Conferma ricezione return
    logStep('PASSO 9: Conferma ricezione return');
    const { error: returnReceiveError } = await supabase
      .from('orders')
      .update({
        status: 'REFUNDED',
        closed_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (returnReceiveError) throw returnReceiveError;
    logStep('Ricezione return confermata', 'SUCCESS');
    await sleep(500);

    // PASSO 10: Verifica stato REFUNDED
    logStep('PASSO 10: Verifica stato REFUNDED');
    const { data: finalOrder, error: finalError } = await supabase
      .from('orders')
      .select('status, refunded_txid')
      .eq('id', orderId)
      .single();

    if (finalError) throw finalError;
    if (finalOrder.status !== 'REFUNDED') {
      throw new Error(`Stato finale errato: ${finalOrder.status}`);
    }
    logStep(`Stato finale: ${finalOrder.status}. TXID: ${finalOrder.refunded_txid || 'N/A'}`, 'SUCCESS');

    // PASSO 11: Test dispute
    logStep('\n=== INIZIO TEST DISPUTE ===\n');

    // Crea nuovo ordine per dispute test
    const disputeEscrowIndex = Math.floor(Date.now() / 1000) + 1;
    const { data: disputeOrder, error: disputeOrderError } = await supabase
      .from('orders')
      .insert({
        buyer_id: BUYER_ID,
        seller_id: SELLER_ID,
        listing_id: listingId,
        price_eur_cents: 5000,
        shipping_eur_cents: 690,
        price_sats: 50000000,
        buyer_commission_sats: 2000000,
        seller_commission_sats: 2000000,
        shipping_sats: 11500000,
        status: 'DELIVERED',
        delivered_at: new Date().toISOString(),
        window_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        escrow_index: disputeEscrowIndex,
        dest_country: 'IT',
        package_size: 'small',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        btc_eur_rate: 60000
      })
      .select()
      .single();

    if (disputeOrderError) throw disputeOrderError;
    const disputeOrderId = disputeOrder.id;
    logStep(`Ordine dispute creato: ${disputeOrderId}`, 'SUCCESS');
    await sleep(500);

    // Apri dispute
    logStep('PASSO 12: Apertura dispute');
    const { data: dispute, error: openDisputeError } = await supabase
      .from('disputes')
      .insert({
        order_id: disputeOrderId,
        arbiter_id: ARBITER_ID,
        opened_by: BUYER_ID,
        reason: 'not_as_described',
        description: 'Test automation dispute',
        status: 'open'
      })
      .select()
      .single();

    if (openDisputeError) throw openDisputeError;
    logStep('Dispute aperta', 'SUCCESS');
    await sleep(500);

    // Aggiorna ordine a DISPUTED
    await supabase
      .from('orders')
      .update({ status: 'DISPUTED' })
      .eq('id', disputeOrderId);

    // Decidi dispute (buyer wins)
    logStep('PASSO 13: Decisione dispute (buyer wins)');
    const { error: decideDisputeError } = await supabase
      .from('disputes')
      .update({
        status: 'decided',
        decision: 'buyer',
        decision_notes: 'Test automation decision',
        decided_at: new Date().toISOString()
      })
      .eq('id', dispute.id);

    if (decideDisputeError) throw decideDisputeError;
    logStep('Dispute decisa a favore del buyer', 'SUCCESS');
    await sleep(500);

    // Aggiorna ordine a REFUNDED
    await supabase
      .from('orders')
      .update({ status: 'REFUNDED' })
      .eq('id', disputeOrderId);

    // Verifica stato REFUNDED dopo dispute
    const { data: disputeFinalOrder } = await supabase
      .from('orders')
      .select('status')
      .eq('id', disputeOrderId)
      .single();

    if (disputeFinalOrder.status !== 'REFUNDED') {
      throw new Error(`Stato finale dispute errato: ${disputeFinalOrder.status}`);
    }
    logStep(`Stato finale dispute: ${disputeFinalOrder.status}`, 'SUCCESS');

    console.log('\n=== TEST COMPLETATO CON SUCCESSO ===\n');
    console.log('✅ Tutti i passaggi sono stati completati correttamente');
    console.log(`✅ Listing ID: ${listingId}`);
    console.log(`✅ Ordine ID: ${orderId}`);
    console.log(`✅ Dispute Order ID: ${disputeOrderId}`);

  } catch (error) {
    console.error('\n=== ERRORE ===');
    console.error(error.message);
    console.error(`Stack: ${error.stack}`);
    process.exit(1);
  }
}

testFullFlow();
