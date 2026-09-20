const web3 = require('@solana/web3.js');
const fx = require('./fixture.json');

// exactly the app's branch logic from Index.html signAndSend()
function appDetect(b64) {
  const raw = Uint8Array.from(Buffer.from(b64, 'base64'));
  return { firstByte: raw[0], isVersioned: (raw[0] & 0x80) !== 0, raw };
}

for (const [name, b64] of [['legacy', fx.legacyB64], ['versioned(v0)', fx.versionedB64]]) {
  const d = appDetect(b64);
  let result;
  try {
    if (d.isVersioned) {
      web3.VersionedTransaction.deserialize(d.raw);
      result = 'parsed as VERSIONED -> ok';
    } else {
      web3.Transaction.from(d.raw);
      result = 'parsed as LEGACY -> ok';
    }
  } catch (e) {
    result = 'THREW: ' + e.message;
  }
  console.log(`${name.padEnd(14)} firstByte=${d.firstByte} app says versioned=${d.isVersioned} => ${result}`);
}

// what the correct check looks like: the version bit lives on the MESSAGE,
// after the compact-u16 signature array, not on byte 0 of the transaction.
console.log('\n--- correct detection ---');
for (const [name, b64] of [['legacy', fx.legacyB64], ['versioned(v0)', fx.versionedB64]]) {
  const raw = Uint8Array.from(Buffer.from(b64, 'base64'));
  const sigCount = raw[0];              // compact-u16, <128 here
  const msgStart = 1 + sigCount * 64;
  const versioned = (raw[msgStart] & 0x80) !== 0;
  console.log(`${name.padEnd(14)} sigCount=${sigCount} msgPrefix=${raw[msgStart]} versioned=${versioned}`);
}
