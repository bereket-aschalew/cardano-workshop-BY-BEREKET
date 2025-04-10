const bip39 = require("bip39");
const axios = require("axios");
const Cardano = require("@emurgo/cardano-serialization-lib-nodejs");

// === CONFIG ===
const BLOCKFROST_API_KEY = "preprodICVgzN7ScdgUN3BUZRtRhwmlspwN6HE0"; // 🔑 Get it from https://blockfrost.io
const BLOCKFROST_BASE_URL = "https://cardano-testnet.blockfrost.io/api/v0";

// === 1. Generate a 24-word seed phrase ===
function generateSeedPhrase() {
  return bip39.generateMnemonic(256); // 24 words
}

// === 2. Derive Cardano address from seed phrase ===
function deriveAddressFromMnemonic(mnemonic) {
  const entropy = bip39.mnemonicToEntropy(mnemonic);
  const rootKey = Cardano.Bip32PrivateKey.from_bip39_entropy(
    Buffer.from(entropy, "hex"),
    Buffer.from("")
  );

  // Derive path m/1852'/1815'/0'/0/0 (Shelley-era payment address)
  const accountKey = rootKey
    .derive(1852 | 0x80000000)
    .derive(1815 | 0x80000000)
    .derive(0 | 0x80000000);

  const utxoKey = accountKey.derive(0).derive(0);
  const stakeKey = accountKey.derive(2).derive(0);

  const baseAddr = Cardano.BaseAddress.new(
    Cardano.NetworkInfo.new(0, 1), // 👈 0 = testnet, 1 = preprod protocol magic
    Cardano.StakeCredential.from_keyhash(
      utxoKey.to_public().to_raw_key().hash()
    ),
    Cardano.StakeCredential.from_keyhash(
      stakeKey.to_public().to_raw_key().hash()
    )
  );

  return baseAddr.to_address().to_bech32();
}

// === 3. Check assets on Cardano testnet address ===
async function checkAssets(address) {
  try {
    const res = await axios.get(`${BLOCKFROST_BASE_URL}/addresses/${address}`, {
      headers: {
        project_id: BLOCKFROST_API_KEY,
      },
    });
    console.log(res);
    const amounts = res.data.amount;

    if (!amounts || amounts.length === 0) {
      console.log(`❌ No assets found at address ${address}`);
    } else {
      console.log(`📦 Assets at ${address}:`);
      for (const asset of amounts) {
        const unit = asset.unit === "lovelace" ? "ADA" : asset.unit;
        const quantity =
          asset.unit === "lovelace"
            ? Number(asset.quantity) / 1_000_000
            : asset.quantity;
        console.log(`- ${unit}: ${quantity}`);
      }
    }
  } catch (err) {
    console.error(
      "❗ Failed to fetch assets:",
      err.response?.data || err.message
    );
  }
}

// === Example Usage ===
(async () => {
  const mnemonic = generateSeedPhrase();
  console.log("🧠 Seed Phrase:", mnemonic);

  const address = deriveAddressFromMnemonic(mnemonic);
  console.log("🏠 Cardano Testnet Address:", address);

  await checkAssets(
    "addr_test1vzpwq95z3xyum8vqndgdd9mdnmafh3djcxnc6jemlgdmswcve6tkw"
  );
})();
