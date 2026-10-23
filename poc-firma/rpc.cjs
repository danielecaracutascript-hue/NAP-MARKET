const fs = require('fs');

const URL = process.env.RPC_URL || 'http://127.0.0.1:18443';
const COOKIE = process.env.RPC_COOKIE || 'C:\\btc-poc\\regtest\\.cookie';

async function rpc(method, params = [], wallet) {
  const cookie = fs.readFileSync(COOKIE, 'utf8').trim();
  const res = await fetch(wallet ? `${URL}/wallet/${wallet}` : URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + Buffer.from(cookie).toString('base64'),
    },
    body: JSON.stringify({ jsonrpc: '1.0', id: 'poc', method, params }),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error('Bitcoin node answered HTTP ' + res.status); }
  if (json.error) throw new Error(method + ': ' + json.error.message);
  return json.result;
}

module.exports = { rpc };
