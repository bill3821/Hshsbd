const web3 = require('@solana/web3.js');
const nacl = require('tweetnacl');
const fx = require('./fixture.json');
const sent = require('./sent.json');   // legacy run (last written)

console.log('captured transactions:', sent.length);
sent.forEach((b64, i) => {
  const raw = Uint8Array.from(Buffer.from(b64, 'base64'));
  const msgStart = 1 + raw[0] * 64;
  const versioned = (raw[msgStart] & 0x80) !== 0;
  const sig = raw.slice(1, 65);
  const msg = raw.slice(msgStart);
  const pk = new web3.PublicKey(fx.pubkey).toBytes();
  const valid = nacl.sign.detached.verify(msg, sig, pk);
  const allZero = sig.every(b => b === 0);
  console.log(`  tx#${i + 1}: versioned=${versioned} signaturePresent=${!allZero} ed25519Valid=${valid} signer=${fx.pubkey.slice(0,8)}…`);
  if (!valid) process.exitCode = 1;
});
