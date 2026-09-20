// Build a real, valid unsigned Solana transaction for the Jupiter swap mock.
const web3 = require('@solana/web3.js');

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function bs58Encode(bytes) {
  let digits = [0];
  for (const b of bytes) {
    let carry = b;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) { digits.push(carry % 58); carry = (carry / 58) | 0; }
  }
  let out = '';
  for (const b of bytes) { if (b === 0) out += '1'; else break; }
  for (let i = digits.length - 1; i >= 0; i--) out += B58[digits[i]];
  return out;
}

const kp = web3.Keypair.generate();
const secretB58 = bs58Encode(kp.secretKey);
const blockhash = web3.Keypair.generate().publicKey.toBase58(); // any valid 32-byte b58

// legacy transaction, fee payer = our wallet, so tx.sign(keypair) satisfies it
const legacy = new web3.Transaction({ recentBlockhash: blockhash, feePayer: kp.publicKey })
  .add(web3.SystemProgram.transfer({
    fromPubkey: kp.publicKey, toPubkey: kp.publicKey, lamports: 1,
  }));
const legacyB64 = legacy.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');

// versioned (v0) transaction to exercise the other branch of signAndSend
const msg = new web3.TransactionMessage({
  payerKey: kp.publicKey,
  recentBlockhash: blockhash,
  instructions: [web3.SystemProgram.transfer({
    fromPubkey: kp.publicKey, toPubkey: kp.publicKey, lamports: 1,
  })],
}).compileToV0Message();
const versionedB64 = Buffer.from(new web3.VersionedTransaction(msg).serialize()).toString('base64');

const out = {
  pubkey: kp.publicKey.toBase58(),
  secretB58,
  legacyB64,
  versionedB64,
  legacyFirstByte: Buffer.from(legacyB64, 'base64')[0],
  versionedFirstByte: Buffer.from(versionedB64, 'base64')[0],
};
require('fs').writeFileSync(__dirname + '/fixture.json', JSON.stringify(out, null, 2));
console.log('pubkey            ', out.pubkey);
console.log('secret b58 length ', secretB58.length);
console.log('legacy   1st byte ', out.legacyFirstByte, '(versioned bit set:', (out.legacyFirstByte & 0x80) !== 0, ')');
console.log('versioned 1st byte', out.versionedFirstByte, '(versioned bit set:', (out.versionedFirstByte & 0x80) !== 0, ')');
