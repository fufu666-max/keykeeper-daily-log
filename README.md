# Keykeeper - Private Encrypted To-do List

A privacy-first encrypted to-do list application built with FHEVM (Fully Homomorphic Encryption Virtual Machine) and React. Your todos are encrypted on-chain and only you can decrypt them.

## Features

- 🔒 **End-to-End Encryption**: All todo items are encrypted using FHE before being stored on-chain
- 🔐 **Private by Design**: Only you can decrypt your todos using your wallet
- 📝 **Simple Interface**: Clean, modern UI for managing your encrypted todos
- 🌐 **Blockchain Storage**: Todos are stored on-chain with encrypted data
- 🎨 **Rainbow Wallet Integration**: Seamless wallet connection with RainbowKit

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **UI**: shadcn/ui + Tailwind CSS
- **Blockchain**: Hardhat + Ethers.js
- **Encryption**: FHEVM (Zama)
- **Wallet**: RainbowKit + Wagmi

## Prerequisites

- Node.js >= 20
- npm >= 7.0.0
- Hardhat node running on localhost:8545 (for local development)

## Setup

### 1. Install Dependencies

```bash
# Install contract dependencies
npm install

# Install UI dependencies
cd ui
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the `ui` directory:

```env
VITE_CONTRACT_ADDRESS=your_contract_address_here
VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

### 3. Deploy Contracts

#### Local Network

1. Start Hardhat node:
```bash
npx hardhat node
```

2. Deploy contracts:
```bash
npx hardhat deploy --network localhost
```

3. Copy the deployed contract address to your `.env.local` file.

#### Sepolia Testnet

1. Configure your `.env` file with:
   - `MNEMONIC`: Your wallet mnemonic
   - `INFURA_API_KEY`: Your Infura API key
   - `ETHERSCAN_API_KEY`: Your Etherscan API key (optional)

2. Deploy:
```bash
npx hardhat deploy --network sepolia
```

### 4. Run Tests

#### Local Tests
```bash
npx hardhat test
```

#### Sepolia Tests
```bash
npx hardhat test --network sepolia test/PrivateTodoListSepolia.ts
```

### 5. Start Development Server

```bash
cd ui
npm run dev
```

## Contract Overview

### PrivateTodoList.sol

The main contract that stores encrypted todos on-chain.

**Key Functions:**
- `createTodo()`: Create a new encrypted todo item
- `toggleTodo()`: Toggle the completion status of a todo
- `getTodo()`: Retrieve an encrypted todo by index
- `getTodoCount()`: Get the total number of todos for a user

**Data Structure:**
- `id` (euint32): Encrypted hash of the todo text
- `completed` (euint32): Encrypted completion status (0 = incomplete, 1 = complete)
- `timestamp` (uint256): Plaintext timestamp for sorting

## How It Works

1. **Creating a Todo**:
   - User enters todo text (e.g., "Buy medicine")
   - Text is hashed to a uint32 value
   - Both the hash and completion status (0) are encrypted using FHEVM
   - Encrypted data is sent to the contract
   - Plaintext text is stored locally in browser storage (mapped to the encrypted hash)

2. **Viewing Todos**:
   - Encrypted todos are fetched from the contract
   - Each todo is decrypted using FHEVM
   - Plaintext text is retrieved from local storage using the decrypted hash
   - Todos are displayed to the user

3. **Toggling Completion**:
   - New completion status (0 or 1) is encrypted
   - Encrypted value is sent to the contract
   - Contract updates the todo's completion status

## Project Structure

```
keykeeper-daily-log/
├── contracts/
│   └── PrivateTodoList.sol      # Main contract
├── test/
│   ├── PrivateTodoList.ts       # Local tests
│   └── PrivateTodoListSepolia.ts # Sepolia tests
├── tasks/
│   └── PrivateTodoList.ts       # Hardhat tasks
├── ui/
│   ├── src/
│   │   ├── components/          # React components
│   │   ├── hooks/
│   │   │   └── useTodoList.tsx  # Main hook for todo operations
│   │   ├── fhevm/               # FHEVM utilities
│   │   └── pages/
│   │       └── Index.tsx        # Main page
│   └── public/
│       └── favicon.svg          # App icon
└── README.md
```

## Development

### Compile Contracts
```bash
npx hardhat compile
```

### Run Tests
```bash
npx hardhat test
```

### Type Generation
```bash
npx hardhat typechain
```

## Git and GitHub

### Initial Setup

The repository is already configured with:
- Remote: `https://github.com/UlaMacAdam/keykeeper-daily-log.git`
- User: `UlaMacAdam`
- Email: `xpmrgq3126972@outlook.com`

### Pushing Changes to GitHub

#### Option 1: Using PowerShell Script (Windows)

```powershell
.\push-to-github.ps1 "Your commit message"
```

#### Option 2: Using Bash Script (Linux/Mac)

```bash
chmod +x push-to-github.sh
./push-to-github.sh "Your commit message"
```

#### Option 3: Manual Git Commands

```bash
git add .
git commit -m "Your commit message"
git push origin main
```

### Automatic Push

The repository includes a GitHub Actions workflow (`.github/workflows/auto-push.yml`) that will automatically build the project when changes are pushed to the main branch.

**Important Security Note**: The GitHub token in the remote URL is exposed. For security, you should:
1. Revoke the current token: https://github.com/settings/tokens
2. Generate a new token with appropriate permissions
3. Update the remote URL: `git remote set-url origin https://YOUR_NEW_TOKEN@github.com/UlaMacAdam/keykeeper-daily-log.git`

## License

MIT
