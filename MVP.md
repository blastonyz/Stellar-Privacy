Create a comprehensive, modern dashboard UI for a B2B Institutional Confidential Payments Platform built on the Stellar network (Soroban) using Tailwind CSS, Radix UI, and Lucid React icons. 

The application acts as a secure enterprise web interface where companies connect via their Freighter Wallet to execute private transactions, manage shielded corporate balances, and verify Zero-Knowledge proofs. The aesthetic should be highly professional, trustworthy, and clean (Midnight Slate/Dark Obsidian or clean Enterprise Light mode, use subtle gradients and sharp borders).

Please include the following core views and components in a unified, single-page application layout with a sidebar navigation:

1. Sidebar Navigation:
- Brand Logo: "StellarShield" or "Aegis Ledger"
- Links: Dashboard (Overview), Confidential Transfer, Corporate Balances, Compliance & Audits.
- Bottom: Wallet Connection Status ("Connected via Freighter: GD3V...4Z2R" with a subtle green dot badge).

2. Dashboard Overview (Main View):
- Quick Stats Row: 
  * Total Shielded Value (Value hidden by default with a "Click to Reveal" eye icon, e.g., ••••••• USD).
  * Pending Verifications (Number of ZK-proofs in queue).
  * Last Tx Status (Success/Verified badge).
- Recent Corporate Activity Table: Columns for Timestamp, Counterparty Address (Publicly visible Stellar Alpha-numeric addresses), Encrypted Amount (Shows a padlock icon and text like "Encrypted via Twisted ElGamal / BN254"), and Proof Status (Badges for "ZK-Verified", "Generating Client-side Proof").

3. Confidential Transfer Form (Interactive Component):
- Card Title: "Initiate Shielded B2B Settlement"
- Fields: 
  * Sender Address (Pre-filled from Freighter).
  * Receiver Stellar Address (Input).
  * Asset Selector (Dropdown: USDC, EURC, Native Token).
  * Amount to Send (Plaintext input field, with a disclaimer: "Amount will be homomorphically encrypted. Never exposed on-chain.").
- ZK Generation Indicator: A subtle client-side processing state or banner that explains "Generating Groth16 proof over BN254 curve via client browser prior to Freighter signature."
- Primary CTA Button: "Generate Proof & Sign with Freighter"

4. Corporate Balances View (Shielded Ledger):
- A clean list showing specific asset accounts.
- Instead of open numbers, balances should have an option to toggled visible/invisible. 
- Technical metadata pill badges next to accounts: "Twisted ElGamal Curve", "BN254 Optimised".

5. Technical & Compliance Sidebar or Overlay (Crucial for Hackathon Presentation):
- A small expandable widget or section showing "Live Cryptographic Proof Status".
- Mock data showing: Constraints Checked (11/11), Circuit Verification Key ID, and a mock JSON code block snippet representing the public inputs submitted on-chain (old_from_hash, new_from_hash, old_to_hash, new_to_hash).

Ensure the interface feels fast, responsive, utilizing realistic corporate financial placeholders, and leverages beautiful UI micro-interactions (hover states, visible focus states). Do not include actual wallet logic, only beautiful visual mocks and state structures.
