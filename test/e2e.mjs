import { chromium } from 'playwright';
import fs from 'fs';

const fx = JSON.parse(fs.readFileSync('./fixture.json', 'utf8'));
const APP = process.env.APP_URL || 'http://127.0.0.1:8920/';
const MINT = 'AbcWhaleMint1111111111111111111111111111111';
const SOL = 'So11111111111111111111111111111111111111112';

// which tx flavour the swap mock hands back this run
const TX_MODE = process.env.TX_MODE || 'versioned';
const SWAP_TX = TX_MODE === 'legacy' ? fx.legacyB64 : fx.versionedB64;

const seen = { rpc: [], quotes: [], swaps: 0, sentTxB64: [] };
let sellProfitable = false;   // flipped on after the buy so take-profit fires

const b = await chromium.launch();
const page = await b.newPage();
const logs = [];
page.on('pageerror', e => logs.push('PAGEERROR ' + e.message));

// ---- Helius RPC -----------------------------------------------------------
await page.route('**mainnet.helius-rpc.com**', async route => {
  const body = JSON.parse(route.request().postData() || '{}');
  const reqs = Array.isArray(body) ? body : [body];
  const reply = reqs.map(r => {
    seen.rpc.push(r.method);
    switch (r.method) {
      case 'getBalance':
        return { jsonrpc: '2.0', id: r.id, result: { context: { slot: 1 }, value: 2_000_000_000 } };
      case 'sendTransaction':
        seen.sentTxB64.push(r.params[0]);
        return { jsonrpc: '2.0', id: r.id, result: '5' + 'z'.repeat(86) };
      case 'getLatestBlockhash':
        return { jsonrpc: '2.0', id: r.id, result: { context: { slot: 1 }, value: { blockhash: fx.pubkey, lastValidBlockHeight: 999 } } };
      case 'getVersion':
        return { jsonrpc: '2.0', id: r.id, result: { 'solana-core': '1.18.23' } };
      default:
        return { jsonrpc: '2.0', id: r.id, result: null };
    }
  });
  await route.fulfill({ contentType: 'application/json', body: JSON.stringify(Array.isArray(body) ? reply : reply[0]) });
});

// ---- DexScreener ----------------------------------------------------------
await page.route('**api.dexscreener.com/token-boosts/**', route =>
  route.fulfill({ contentType: 'application/json', body: JSON.stringify([
    { chainId: 'solana', tokenAddress: MINT },
    { chainId: 'ethereum', tokenAddress: '0xdeadbeef' },       // must be skipped
    { chainId: 'solana', tokenAddress: 'LowLiqMint111111111111111111111111111111' },
  ]) }));

await page.route('**api.dexscreener.com/token-pairs/**', route => {
  const url = route.request().url();
  if (url.includes(MINT)) {
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify([{
      baseToken: { address: MINT, symbol: 'WHALE' },
      liquidity: { usd: 120_000 },      // inside 10k..500k
      volume: { m5: 60_000 },
      txns: { m5: { buys: 12 } },       // avg buy 5000 >= 3000
      priceUsd: '0.00042',
      priceChange: { m5: '8.5' },       // >= 3
    }]) });
  }
  // decoy that must be filtered out: liquidity too low, no momentum
  return route.fulfill({ contentType: 'application/json', body: JSON.stringify([{
    baseToken: { address: 'LowLiqMint111111111111111111111111111111', symbol: 'DECOY' },
    liquidity: { usd: 4_000 }, volume: { m5: 200 }, txns: { m5: { buys: 1 } },
    priceUsd: '0.001', priceChange: { m5: '0.2' },
  }]) });
});

// ---- Jupiter --------------------------------------------------------------
await page.route('**public.jupiterapi.com/quote**', route => {
  const u = new URL(route.request().url());
  const inputMint = u.searchParams.get('inputMint');
  const amount = u.searchParams.get('amount');
  seen.quotes.push({ inputMint: inputMint === SOL ? 'SOL' : 'TOKEN', amount, slippageBps: u.searchParams.get('slippageBps') });
  const isBuy = inputMint === SOL;
  const outAmount = isBuy
    ? '119047619'                                    // tokens received for 0.05 SOL
    : (sellProfitable ? '52000000' : '50100000');    // lamports back: +4% vs +0.2%
  return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    inputMint, outAmount, outputMint: isBuy ? MINT : SOL, routePlan: [], slippageBps: 200,
  }) });
});

await page.route('**public.jupiterapi.com/swap**', route => {
  seen.swaps++;
  return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ swapTransaction: SWAP_TX }) });
});

// ---- drive the UI ---------------------------------------------------------
const step = (m) => console.log('  ' + m);
console.log(`\n=== TX_MODE=${TX_MODE} ===`);

await page.goto(APP, { waitUntil: 'networkidle' });
step('page loaded, solanaWeb3 present: ' + await page.evaluate(() => typeof window.solanaWeb3?.Keypair));

await page.fill('#keyInput', fx.secretB58);
await page.click('#btnKey');
await page.waitForFunction(() => document.getElementById('btnBot') && !document.getElementById('btnBot').disabled, { timeout: 15000 });
const header = await page.textContent('#headerStatus');
step('wallet loaded -> ' + header.replace(/\s+/g, ' ').trim());

await page.click('#btnBot');
step('bot started');

// wait for the buy to land
await page.waitForFunction(() => document.getElementById('logScroll').innerText.includes('Buy TX:'), { timeout: 30000 });
step('buy executed');

sellProfitable = true;   // next sell quote is +4%, above the 3% take-profit

await page.waitForFunction(() => document.getElementById('logScroll').innerText.includes('PnL:'), { timeout: 40000 });
step('take-profit sell executed');

await page.click('#btnBot');   // stop

const state = await page.evaluate(() => ({
  open: document.getElementById('statOpen').textContent,
  closed: document.getElementById('statClosed').textContent,
  pnl: document.getElementById('statPnl').textContent,
  log: document.getElementById('logScroll').innerText.split('\n').filter(Boolean),
}));

console.log('\n  --- app log (oldest last) ---');
state.log.slice(0, 22).forEach(l => console.log('  | ' + l));
console.log(`\n  stats: open=${state.open} closed=${state.closed} pnl=${state.pnl}`);
console.log('  rpc methods called :', [...new Set(seen.rpc)].join(', '));
console.log('  jupiter quotes     :', JSON.stringify(seen.quotes));
console.log('  jupiter swaps      :', seen.swaps);
console.log('  page errors        :', logs.length ? logs : 'none');

// ---- verify the transactions we "sent" were really signed -----------------
fs.writeFileSync('./sent.json', JSON.stringify(seen.sentTxB64, null, 2));
console.log('  signed txs captured:', seen.sentTxB64.length);

await page.screenshot({ path: `/tmp/claude-0/e2e-${TX_MODE}.png` });
await b.close();

const ok = state.closed === '1' && seen.swaps === 2 && logs.length === 0;
console.log('\n  RESULT: ' + (ok ? 'PASS' : 'FAIL'));
process.exit(ok ? 0 : 1);
