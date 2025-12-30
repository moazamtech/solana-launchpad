# Solana Launchpad

A modern, production-ready SPL token launch platform built with Next.js and Solana. Create your own tokens on Solana blockchain with immutable supply, on-chain metadata, and seamless Raydium DEX integration.

![Solana Launchpad](https://img.shields.io/badge/Solana-Launchpad-9945FF?style=for-the-badge&logo=solana&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)

---

## Features

- **One-Click Token Creation** - Create SPL tokens with customizable name, symbol, decimals, and supply
- **On-Chain Metadata** - Upload token images and metadata to IPFS via Pinata, stored permanently on-chain using Metaplex standard
- **Social Links** - Add website, X (Twitter), and Telegram links to your token metadata
- **Authority Revocation** - Automatically revokes mint and freeze authorities for trustless, immutable tokens
- **Real-Time Balance** - Live wallet balance updates using Solana account subscriptions
- **Raydium Integration** - Direct links to add liquidity and trade on Raydium DEX
- **Multi-Network Support** - Works on Mainnet, Testnet, and Devnet
- **Modern UI** - Beautiful, responsive design with glassmorphic aesthetics
- **No Platform Fees** - Only pay Solana network fees (~0.015 SOL)

---

## Screenshots

```
┌─────────────────────────────────────────────────────────────┐
│  Sol Launchpad                              [19.127 SOL]    │
│  Solana Token Launch Console                [Connect Wallet]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────┐  ┌─────────────────────────────┐  │
│  │ Create Your Token   │  │ Launch Checklist            │  │
│  │                     │  │ ✓ Connect Phantom wallet    │  │
│  │ Token Name: [____]  │  │ ✓ Fill token details        │  │
│  │ Symbol:     [____]  │  │ ○ Upload metadata           │  │
│  │ Decimals:   [9   ]  │  │ ○ Create token mint         │  │
│  │ Supply:     [____]  │  │ ○ Add liquidity on Raydium  │  │
│  │                     │  └─────────────────────────────┘  │
│  │ [Upload Image]      │                                   │
│  │ Description: [____] │  ┌─────────────────────────────┐  │
│  │                     │  │ What Happens When You Create│  │
│  │ Website:  [_______] │  │ ● New SPL token mint        │  │
│  │ Twitter:  [_______] │  │ ● Full supply to wallet     │  │
│  │ Telegram: [_______] │  │ ● Metadata stored on IPFS   │  │
│  │                     │  │ ● Authorities revoked       │  │
│  │ [Create Token]      │  └─────────────────────────────┘  │
│  └─────────────────────┘                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **Next.js 16** | React framework with App Router |
| **TypeScript** | Type-safe development |
| **Tailwind CSS 4** | Utility-first styling |
| **@solana/web3.js** | Solana blockchain interaction |
| **@solana/spl-token** | SPL token operations |
| **@solana/wallet-adapter** | Phantom wallet integration |
| **@metaplex-foundation/mpl-token-metadata** | On-chain metadata |
| **Pinata** | IPFS storage for images & metadata |

---

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Phantom Wallet browser extension
- Pinata account (free tier works)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/moazamtech/solana-launchpad.git
   cd solana-launchpad
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` with your settings:
   ```env
   # Network: devnet, testnet, or mainnet-beta
   NEXT_PUBLIC_SOLANA_NETWORK=devnet
   NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
   
   # Pinata IPFS (get keys at https://app.pinata.cloud/developers/api-keys)
   PINATA_API_KEY=your_api_key
   PINATA_API_SECRET=your_api_secret
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:3000
   ```

---

## Usage

### Creating a Token

1. **Connect Wallet** - Click "Connect Wallet" and select Phantom
2. **Fill Token Details**
   - Token Name (e.g., "Moon Rocket")
   - Symbol (e.g., "MOON")
   - Decimals (0-9, typically 9)
   - Total Supply (e.g., 1000000000)
3. **Add Metadata** (Optional)
   - Upload token image (JPEG, PNG, GIF, WebP)
   - Add description
   - Add social links (Website, X, Telegram)
   - Click "Upload to IPFS"
4. **Create Token** - Click "Create Token" and sign transactions in Phantom
5. **Add Liquidity** - Use the Raydium link to create a liquidity pool

### Cost Breakdown

| Component | Cost (SOL) |
|-----------|------------|
| Mint Account | ~0.00145 |
| Token Account | ~0.00204 |
| Metadata Account | ~0.01 |
| Transaction Fees | ~0.00015 |
| **Total** | **~0.015 SOL** |

*No platform fees - only Solana network costs*

---

## Project Structure

```
solana-launchpad/
├── app/
│   ├── api/
│   │   └── upload/
│   │       └── route.ts      # Pinata IPFS upload endpoint
│   ├── page.tsx              # Main launch interface
│   ├── layout.tsx            # Root layout with providers
│   ├── globals.css           # Global styles
│   └── wallet-adapter.css    # Wallet UI customization
├── components/
│   └── providers.tsx         # Solana wallet providers
├── lib/
│   └── utils.ts              # Utility functions
├── .env.example              # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

---

## Network Configuration

### Devnet (Testing)
```env
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
```
Get free devnet SOL: https://faucet.solana.com

### Testnet
```env
NEXT_PUBLIC_SOLANA_NETWORK=testnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.testnet.solana.com
```

### Mainnet (Production)
```env
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```
*For production, consider using a dedicated RPC provider like Helius, QuickNode, or Alchemy*

---

## Token Metadata Standard

Tokens created follow the [Metaplex Token Metadata Standard](https://developers.metaplex.com/token-metadata):

```json
{
  "name": "Token Name",
  "symbol": "SYMBOL",
  "description": "Token description",
  "image": "https://gateway.pinata.cloud/ipfs/...",
  "external_url": "https://yourwebsite.com",
  "attributes": [],
  "properties": {
    "files": [{ "uri": "...", "type": "image/png" }],
    "category": "image"
  },
  "extensions": {
    "website": "https://yourwebsite.com",
    "twitter": "https://x.com/yourtoken",
    "telegram": "https://t.me/yourtoken"
  }
}
```

---

## Security Features

- **Authority Revocation** - Mint and freeze authorities are permanently revoked after token creation
- **Immutable Supply** - No one can mint additional tokens after creation
- **No Freeze Risk** - Tokens cannot be frozen by anyone
- **Client-Side Signing** - Private keys never leave your wallet
- **Decentralized Storage** - Metadata stored on IPFS

---

## Scripts

```bash
# Development
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is open source and available under the [MIT License](LICENSE).

---

## Acknowledgments

- [Solana](https://solana.com) - High-performance blockchain
- [Metaplex](https://metaplex.com) - NFT & token metadata standard
- [Raydium](https://raydium.io) - Leading Solana DEX
- [Pinata](https://pinata.cloud) - IPFS pinning service
- [Phantom](https://phantom.app) - Solana wallet

---

## Support

If you find this project useful, consider giving it a star on GitHub!

[![GitHub stars](https://img.shields.io/github/stars/moazamtech/solana-launchpad?style=social)](https://github.com/moazamtech/solana-launchpad)

---

<p align="center">
  Built with love for the Solana ecosystem
</p>
