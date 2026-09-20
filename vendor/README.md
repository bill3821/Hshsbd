# vendor/

`solana-web3.iife.min.js` is `lib/index.iife.min.js` from the npm package
`@solana/web3.js@1.95.8`, copied verbatim.

Tarball shasum `2d49abda23f7a79a3cc499ab6680f7be11786ee1`, matching npm's
published `dist.shasum` for that version.

It's vendored so the app keeps working when unpkg is slow, blocked or down —
a missing bundle means the wallet can't load and the bot can't sign anything.
`Index.html` falls back to the unpkg copy if this file is ever absent.

To refresh it:

    npm pack @solana/web3.js@<version>
    tar xzf solana-web3.js-<version>.tgz
    cp package/lib/index.iife.min.js vendor/solana-web3.iife.min.js
