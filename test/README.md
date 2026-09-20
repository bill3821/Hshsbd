# Tests

End-to-end test of the whole bot loop — load wallet, scan, buy, monitor,
take-profit sell — driving the real UI in a real browser. Every outbound call
(Helius RPC, DexScreener, Jupiter) is intercepted and answered with fixtures,
so **no network access and no real funds are involved**. The signing path is
not mocked: the app signs genuine Solana transactions with a throwaway keypair,
and the test verifies the ed25519 signatures afterwards.

## Run it

```bash
cd test
npm install
npx playwright install chromium     # skip if you already have it

node fixture.cjs                    # generate keypair + transaction fixtures

# in another terminal, serve the app:
#   python3 launcher/fly_trader.py --no-browser --port 8920
node e2e.mjs                        # versioned (v0) transactions — Jupiter's default
TX_MODE=legacy node e2e.mjs         # legacy transactions
node verifysig.cjs                  # check the captured signatures are valid
```

If your machine or CI image already ships a Chromium and you can't run
`playwright install`, point the test at it instead:

```bash
CHROMIUM_PATH=/path/to/chromium node e2e.mjs
```

`e2e.mjs` exits non-zero on failure, so it works in CI. It asserts one closed
trade, exactly two Jupiter swap calls (buy + sell), and zero page errors.

## `sigcheck.cjs`

A focused regression test for transaction-version detection. Jupiter returns v0
versioned transactions by default; the original code read the version bit from
byte 0 of the serialized transaction, which is actually the signature count, so
every swap was handed to the legacy parser and threw:

```
✗ Sign/send: Versioned messages must be deserialized with VersionedMessage.deserialize()
```

The version bit lives on the message, which starts after the signature array.
`sigcheck.cjs` asserts both flavours are classified correctly.
