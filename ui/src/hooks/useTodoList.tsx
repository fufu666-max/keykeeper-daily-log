import { useCallback, useEffect, useState } from "react";
import { useAccount, useChainId, useWalletClient } from "wagmi";
import { ethers } from "ethers";
import { useFhevm } from "@/fhevm/useFhevm";
import { useInMemoryStorage } from "./useInMemoryStorage";

// Contract ABI
const PrivateTodoListABI = [
  "function createTodo(bytes32 encryptedId, bytes32 encryptedCompleted, bytes calldata idProof, bytes calldata completedProof) external",
  "function toggleTodo(uint256 todoIndex, bytes32 encryptedCompleted, bytes calldata completedProof) external",
  "function getTodo(address user, uint256 index) external view returns (bytes32 encryptedId, bytes32 encryptedCompleted, uint256 timestamp)",
  "function getTodoCount(address user) external view returns (uint256)",
  "function getTodoTimestamps(address user) external view returns (uint256[])",
  "event TodoCreated(address indexed user, uint256 indexed todoIndex, uint256 timestamp)",
  "event TodoToggled(address indexed user, uint256 indexed todoIndex, uint256 timestamp)",
];

interface Todo {
  id: string; // Local ID for UI
  text: string; // Plaintext todo text (stored locally)
  encryptedId: string; // Encrypted hash of text
  encryptedCompleted: string; // Encrypted completion status
  completed: boolean; // Decrypted completion status
  timestamp: number;
  index: number; // Contract index
}

interface UseTodoListState {
  contractAddress: string | undefined;
  todos: Todo[];
  isLoading: boolean;
  message: string | undefined;
  createTodo: (text: string) => Promise<void>;
  toggleTodo: (index: number) => Promise<void>;
  loadTodos: () => Promise<void>;
}

// Local storage key for text mapping
const TEXT_MAP_KEY = "todo_text_map";

export function useTodoList(contractAddress: string | undefined): UseTodoListState {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();
  const { storage: fhevmDecryptionSignatureStorage } = useInMemoryStorage();

  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [ethersSigner, setEthersSigner] = useState<ethers.JsonRpcSigner | undefined>(undefined);
  const [ethersProvider, setEthersProvider] = useState<ethers.JsonRpcProvider | undefined>(undefined);

  // Get EIP1193 provider
  const eip1193Provider = useCallback(() => {
    if (chainId === 31337) {
      return "http://localhost:8545";
    }
    if (walletClient?.transport) {
      const transport = walletClient.transport as any;
      if (transport.value && typeof transport.value.request === "function") {
        return transport.value;
      }
      if (typeof transport.request === "function") {
        return transport;
      }
    }
    if (typeof window !== "undefined" && (window as any).ethereum) {
      return (window as any).ethereum;
    }
    return undefined;
  }, [chainId, walletClient]);

  // Initialize FHEVM
  const { instance: fhevmInstance, status: fhevmStatus } = useFhevm({
    provider: eip1193Provider(),
    chainId,
    initialMockChains: { 31337: "http://localhost:8545" },
    enabled: isConnected && !!contractAddress,
  });

  // Convert walletClient to ethers signer
  useEffect(() => {
    if (!walletClient || !chainId) {
      setEthersSigner(undefined);
      setEthersProvider(undefined);
      return;
    }

    const setupEthers = async () => {
      try {
        const provider = new ethers.BrowserProvider(walletClient as any);
        const signer = await provider.getSigner();
        setEthersProvider(provider as any);
        setEthersSigner(signer);
      } catch (error) {
        console.error("Error setting up ethers:", error);
        setEthersSigner(undefined);
        setEthersProvider(undefined);
      }
    };

    setupEthers();
  }, [walletClient, chainId]);

  // Get text mapping from local storage
  const getTextMap = useCallback((): Record<string, string> => {
    if (typeof window === "undefined" || !address) return {};
    const stored = localStorage.getItem(`${TEXT_MAP_KEY}_${address}`);
    return stored ? JSON.parse(stored) : {};
  }, [address]);

  // Save text mapping to local storage
  const saveTextMap = useCallback((map: Record<string, string>) => {
    if (typeof window === "undefined" || !address) return;
    localStorage.setItem(`${TEXT_MAP_KEY}_${address}`, JSON.stringify(map));
  }, [address]);

  // Hash text to uint32
  const hashTextToUint32 = useCallback((text: string): number => {
    const hash = ethers.id(text);
    const uint32 = BigInt(hash) & BigInt("0xFFFFFFFF");
    return Number(uint32);
  }, []);

  const createTodo = useCallback(
    async (text: string) => {
      if (!text.trim()) {
        setMessage("Todo text cannot be empty");
        return;
      }

      if (!contractAddress) {
        const error = new Error("Contract address not configured. Please set VITE_CONTRACT_ADDRESS in .env.local");
        setMessage(error.message);
        throw error;
      }

      if (!ethersSigner || !fhevmInstance || !address || !ethersProvider) {
        const error = new Error("Wallet not connected or FHEVM not initialized");
        setMessage(error.message);
        throw error;
      }

      try {
        setIsLoading(true);
        setMessage("Encrypting todo...");

        // Hash text to uint32
        const todoIdUint32 = hashTextToUint32(text);

        // Encrypt todo ID
        const encryptedIdInput = fhevmInstance.createEncryptedInput(
          contractAddress as `0x${string}`,
          address as `0x${string}`
        );
        encryptedIdInput.add32(todoIdUint32);
        const encryptedId = await encryptedIdInput.encrypt();
        
        // Validate encrypted result
        if (!encryptedId || !encryptedId.handles || !Array.isArray(encryptedId.handles) || encryptedId.handles.length === 0) {
          throw new Error("Encryption failed: Invalid handle returned");
        }

        // Encrypt completion status (0 = not completed)
        const encryptedCompletedInput = fhevmInstance.createEncryptedInput(
          contractAddress as `0x${string}`,
          address as `0x${string}`
        );
        encryptedCompletedInput.add32(0);
        const encryptedCompleted = await encryptedCompletedInput.encrypt();
        
        // Validate encrypted result
        if (!encryptedCompleted || !encryptedCompleted.handles || !Array.isArray(encryptedCompleted.handles) || encryptedCompleted.handles.length === 0) {
          throw new Error("Encryption failed: Invalid completion handle returned");
        }

        setMessage("Submitting to blockchain...");

        const contract = new ethers.Contract(contractAddress, PrivateTodoListABI, ethersSigner);

        const tx = await contract.createTodo(
          encryptedId.handles[0],
          encryptedCompleted.handles[0],
          encryptedId.inputProof,
          encryptedCompleted.inputProof,
          {
            gasLimit: 5000000,
          }
        );

        const receipt = await tx.wait();
        const todoIndex = Number(receipt.logs[0]?.args?.[1] || todos.length);

        // Save text mapping
        const textMap = getTextMap();
        // Ensure handle is a string and convert to lowercase
        const handleValue: unknown = encryptedId.handles[0];
        const handle = String(handleValue || '').toLowerCase();
        
        if (handle && handle.length > 0) {
          textMap[handle] = text;
          saveTextMap(textMap);
        } else {
          console.warn("[useTodoList] Could not save text mapping: invalid handle", handleValue);
        }

        setMessage("Todo created successfully!");
        
        // Reload todos after a delay
        setTimeout(() => {
          loadTodos();
        }, 2000);
      } catch (error: any) {
        const errorMessage = error.reason || error.message || String(error);
        setMessage(`Error: ${errorMessage}`);
        console.error("[useTodoList] Error creating todo:", error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [contractAddress, ethersSigner, fhevmInstance, address, ethersProvider, hashTextToUint32, getTextMap, saveTextMap]
  );

  const toggleTodo = useCallback(
    async (contractIndex: number) => {
      if (!contractAddress || !ethersSigner || !fhevmInstance || !address) {
        setMessage("Missing requirements for toggling todo");
        return;
      }

      try {
        setIsLoading(true);
        setMessage("Toggling todo...");

        // Find todo by contract index (not array index, as todos may be sorted)
        const todo = todos.find(t => t.index === contractIndex);
        if (!todo) {
          throw new Error(`Todo not found at contract index ${contractIndex}`);
        }

        // Encrypt new completion status (toggle: 1 if was 0, 0 if was 1)
        const newCompleted = todo.completed ? 0 : 1;
        const encryptedCompletedInput = fhevmInstance.createEncryptedInput(
          contractAddress as `0x${string}`,
          address as `0x${string}`
        );
        encryptedCompletedInput.add32(newCompleted);
        const encryptedCompleted = await encryptedCompletedInput.encrypt();

        const contract = new ethers.Contract(contractAddress, PrivateTodoListABI, ethersSigner);

        const tx = await contract.toggleTodo(
          contractIndex,
          encryptedCompleted.handles[0],
          encryptedCompleted.inputProof,
          {
            gasLimit: 5000000,
          }
        );

        await tx.wait();
        setMessage("Todo toggled successfully!");

        // Reload todos after a delay
        setTimeout(() => {
          loadTodos();
        }, 2000);
      } catch (error: any) {
        const errorMessage = error.reason || error.message || String(error);
        setMessage(`Error: ${errorMessage}`);
        console.error("[useTodoList] Error toggling todo:", error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [contractAddress, ethersSigner, fhevmInstance, address]
  );

  const decryptTodo = useCallback(
    async (encryptedId: string, encryptedCompleted: string, contractAddress: string, index: number): Promise<{ id: number; completed: boolean }> => {
      if (!fhevmInstance || !ethersSigner || !address) {
        throw new Error("FHEVM not initialized");
      }

      // Generate keypair
      const keypair = (fhevmInstance as any).generateKeypair?.() || {
        publicKey: new Uint8Array(32).fill(0),
        privateKey: new Uint8Array(32).fill(0),
      };

      // Create EIP712 signature
      const contractAddresses = [contractAddress as `0x${string}`];
      const startTimestamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = "10";

      const eip712 = (fhevmInstance as any).createEIP712?.(
        keypair.publicKey,
        contractAddresses,
        startTimestamp,
        durationDays
      ) || {
        domain: { name: "FHEVM", version: "1", chainId, verifyingContract: contractAddresses[0] },
        types: { UserDecryptRequestVerification: [] },
        message: {},
      };

      const signature = await ethersSigner.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message
      );

      const signatureForDecrypt = chainId === 31337 ? signature.replace("0x", "") : signature;

      // Decrypt both values
      const handleContractPairs = [
        { handle: encryptedId, contractAddress: contractAddress as `0x${string}` },
        { handle: encryptedCompleted, contractAddress: contractAddress as `0x${string}` },
      ];

      const decryptedResult = await (fhevmInstance as any).userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signatureForDecrypt,
        contractAddresses,
        address as `0x${string}`,
        startTimestamp,
        durationDays
      );

      const id = Number(decryptedResult[encryptedId] || 0);
      const completed = Number(decryptedResult[encryptedCompleted] || 0) === 1;

      return { id, completed };
    },
    [fhevmInstance, ethersSigner, address, chainId]
  );

  const loadTodos = useCallback(async () => {
    if (!contractAddress || !ethersProvider || !address || !fhevmInstance || !ethersSigner) {
      return;
    }

    try {
      setIsLoading(true);

      const contract = new ethers.Contract(contractAddress, PrivateTodoListABI, ethersProvider);
      const count = await contract.getTodoCount(address);

      if (count === 0n) {
        setTodos([]);
        return;
      }

      const textMap = getTextMap();
      const loadedTodos: Todo[] = [];

      for (let i = 0; i < Number(count); i++) {
        try {
          const [encryptedId, encryptedCompleted, timestamp] = await contract.getTodo(address, i);
          const idHandle = typeof encryptedId === "string" ? encryptedId : ethers.hexlify(encryptedId);
          const completedHandle = typeof encryptedCompleted === "string" ? encryptedCompleted : ethers.hexlify(encryptedCompleted);

          // Decrypt
          const { id, completed } = await decryptTodo(
            idHandle.toLowerCase(),
            completedHandle.toLowerCase(),
            contractAddress,
            i
          );

          // Get text from mapping
          const text = textMap[idHandle.toLowerCase()] || `Todo #${i + 1}`;

          loadedTodos.push({
            id: `todo-${i}`,
            text,
            encryptedId: idHandle.toLowerCase(),
            encryptedCompleted: completedHandle.toLowerCase(),
            completed,
            timestamp: Number(timestamp),
            index: i,
          });
        } catch (error) {
          console.error(`Error loading todo ${i}:`, error);
        }
      }

      // Sort by timestamp (newest first)
      loadedTodos.sort((a, b) => b.timestamp - a.timestamp);
      setTodos(loadedTodos);
    } catch (error: any) {
      console.error("[useTodoList] Error loading todos:", error);
      setMessage(`Error loading todos: ${error.message || String(error)}`);
    } finally {
      setIsLoading(false);
    }
  }, [contractAddress, ethersProvider, address, fhevmInstance, ethersSigner, getTextMap, decryptTodo]);

  useEffect(() => {
    if (contractAddress && ethersProvider && address && fhevmInstance && ethersSigner) {
      loadTodos();
    }
  }, [contractAddress, ethersProvider, address, fhevmInstance, ethersSigner, loadTodos]);

  return {
    contractAddress,
    todos,
    isLoading,
    message,
    createTodo,
    toggleTodo,
    loadTodos,
  };
}

