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
  isDecrypted?: boolean; // Flag to indicate if this todo has been decrypted
}

interface UseTodoListState {
  contractAddress: string | undefined;
  todos: Todo[];
  isLoading: boolean;
  isDecrypting: boolean;
  message: string | undefined;
  createTodo: (text: string) => Promise<void>;
  toggleTodo: (index: number) => Promise<void>;
  loadTodos: () => Promise<void>;
  decryptTodos: () => Promise<void>;
}

// Local storage key for text mapping
const TEXT_MAP_KEY = "todo_text_map";
// Local storage key for completed status mapping (decrypted)
const COMPLETED_MAP_KEY = "todo_completed_map";

export function useTodoList(contractAddress: string | undefined): UseTodoListState {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();
  const { storage: fhevmDecryptionSignatureStorage } = useInMemoryStorage();

  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
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
    if (typeof window === "undefined" || !address) {
      console.log("[useTodoList] getTextMap: no window or address", { hasWindow: typeof window !== "undefined", address });
      return {};
    }
    const storageKey = `${TEXT_MAP_KEY}_${address}`;
    const stored = localStorage.getItem(storageKey);
    const map = stored ? JSON.parse(stored) : {};
    console.log("[useTodoList] getTextMap:", {
      address,
      storageKey,
      stored,
      map,
      mapKeys: Object.keys(map),
    });
    return map;
  }, [address]);

  // Save text mapping to local storage
  const saveTextMap = useCallback((map: Record<string, string>) => {
    if (typeof window === "undefined" || !address) return;
    localStorage.setItem(`${TEXT_MAP_KEY}_${address}`, JSON.stringify(map));
  }, [address]);

  // Get completed status mapping from local storage
  const getCompletedMap = useCallback((): Record<string, boolean> => {
    if (typeof window === "undefined" || !address) return {};
    const stored = localStorage.getItem(`${COMPLETED_MAP_KEY}_${address}`);
    return stored ? JSON.parse(stored) : {};
  }, [address]);

  // Save completed status mapping to local storage
  const saveCompletedMap = useCallback((map: Record<string, boolean>) => {
    if (typeof window === "undefined" || !address) return;
    localStorage.setItem(`${COMPLETED_MAP_KEY}_${address}`, JSON.stringify(map));
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
        // Ensure handle is a proper hex string and convert to lowercase
        const handleValue: unknown = encryptedId.handles[0];
        let handle: string;
        
        if (typeof handleValue === 'string') {
          handle = handleValue.toLowerCase();
        } else if (handleValue instanceof Uint8Array || Array.isArray(handleValue)) {
          // Convert Uint8Array or array to hex string
          const bytes = handleValue instanceof Uint8Array ? Array.from(handleValue) : handleValue;
          handle = '0x' + bytes.map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
        } else {
          // Try to convert to string first, then to hex if needed
          const str = String(handleValue || '');
          if (str.startsWith('0x')) {
            handle = str.toLowerCase();
          } else {
            // If it's already a hex string without 0x, add it
            handle = '0x' + str.toLowerCase();
          }
        }
        
        console.log("[useTodoList] Saving text mapping:", {
          handle,
          handleValue,
          handleValueType: typeof handleValue,
          text,
          address,
          textMapBefore: { ...textMap },
        });
        
        if (handle && handle.length > 0 && handle.startsWith('0x')) {
          textMap[handle] = text;
          saveTextMap(textMap);
          console.log("[useTodoList] Text mapping saved:", {
            handle,
            text,
            textMapAfter: { ...textMap },
          });
        } else {
          console.warn("[useTodoList] Could not save text mapping: invalid handle", handleValue, handle);
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

  const decryptTodo = useCallback(
    async (
      encryptedId: string, 
      encryptedCompleted: string, 
      contractAddress: string, 
      index: number
    ): Promise<{ id: number; completed: boolean }> => {
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

      // Build handle-contract pairs (only include non-empty handles)
      const handleContractPairs: Array<{ handle: string; contractAddress: `0x${string}` }> = [];
      if (encryptedId && encryptedId.length > 0) {
        handleContractPairs.push({ 
          handle: encryptedId, 
          contractAddress: contractAddress as `0x${string}` 
        });
      }
      if (encryptedCompleted && encryptedCompleted.length > 0) {
        handleContractPairs.push({ 
          handle: encryptedCompleted, 
          contractAddress: contractAddress as `0x${string}` 
        });
      }

      if (handleContractPairs.length === 0) {
        throw new Error("No handles to decrypt");
      }

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

      const id = encryptedId && encryptedId.length > 0 
        ? Number(decryptedResult[encryptedId] || 0) 
        : 0;
      const completed = encryptedCompleted && encryptedCompleted.length > 0
        ? Number(decryptedResult[encryptedCompleted] || 0) === 1
        : false;

      return { id, completed };
    },
    [fhevmInstance, ethersSigner, address, chainId]
  );

  const toggleTodo = useCallback(
    async (contractIndex: number) => {
      if (!contractAddress || !ethersSigner || !fhevmInstance || !address || !ethersProvider) {
        setMessage("Missing requirements for toggling todo");
        return;
      }

      try {
        setIsLoading(true);
        setMessage("Fetching current todo status...");

        // Get current todo from contract (don't rely on todos array state)
        const contract = new ethers.Contract(contractAddress, PrivateTodoListABI, ethersProvider);
        const [encryptedId, currentEncryptedCompleted, timestamp] = await contract.getTodo(address, contractIndex);
        
        const completedHandle = typeof currentEncryptedCompleted === "string" 
          ? currentEncryptedCompleted 
          : ethers.hexlify(currentEncryptedCompleted);

        // Decrypt current completion status
        setMessage("Decrypting current status...");
        const { completed: currentCompleted } = await decryptTodo(
          "", // We don't need to decrypt ID for toggle
          completedHandle.toLowerCase(),
          contractAddress,
          contractIndex
        );

        // Encrypt new completion status (toggle: 1 if was 0, 0 if was 1)
        const newCompleted = currentCompleted ? 0 : 1;
        setMessage("Encrypting new status...");
        const encryptedCompletedInput = fhevmInstance.createEncryptedInput(
          contractAddress as `0x${string}`,
          address as `0x${string}`
        );
        encryptedCompletedInput.add32(newCompleted);
        const newEncryptedCompleted = await encryptedCompletedInput.encrypt();

        const contractWithSigner = new ethers.Contract(contractAddress, PrivateTodoListABI, ethersSigner);

        setMessage("Submitting to blockchain...");
        const tx = await contractWithSigner.toggleTodo(
          contractIndex,
          newEncryptedCompleted.handles[0],
          newEncryptedCompleted.inputProof,
          {
            gasLimit: 5000000,
          }
        );

        await tx.wait();
        setMessage("Todo toggled successfully!");

        // Update the todo in local state immediately (optimistic update)
        const newCompletedStatus = !todos.find(t => t.index === contractIndex)?.completed;
        const completedMap = getCompletedMap();
        setTodos(prevTodos => prevTodos.map(todo => {
          if (todo.index === contractIndex) {
            // Also save to completed map
            if (todo.encryptedId) {
              completedMap[todo.encryptedId.toLowerCase()] = newCompletedStatus;
              saveCompletedMap(completedMap);
            }
            return {
              ...todo,
              completed: newCompletedStatus, // Toggle the completed status
            };
          }
          return todo;
        }));

        // Reload todos after a delay to sync with contract
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
    [contractAddress, ethersSigner, fhevmInstance, address, ethersProvider, decryptTodo]
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

      // Collect all handles first
      const todoData: Array<{
        index: number;
        idHandle: string;
        completedHandle: string;
        timestamp: number;
      }> = [];

      for (let i = 0; i < Number(count); i++) {
        try {
          const [encryptedId, encryptedCompleted, timestamp] = await contract.getTodo(address, i);
          const idHandle = typeof encryptedId === "string" ? encryptedId : ethers.hexlify(encryptedId);
          const completedHandle = typeof encryptedCompleted === "string" ? encryptedCompleted : ethers.hexlify(encryptedCompleted);

          todoData.push({
            index: i,
            idHandle: idHandle.toLowerCase(),
            completedHandle: completedHandle.toLowerCase(),
            timestamp: Number(timestamp),
          });
        } catch (error) {
          console.error(`Error fetching todo ${i}:`, error);
        }
      }

      // Load todos without decrypting (show encrypted state)
      // Text and completed status will be loaded from local storage if available
      const completedMap = getCompletedMap();
      for (const todo of todoData) {
        // Get text from mapping (if available)
        const textFromMap = textMap[todo.idHandle];
        const text = textFromMap || `Encrypted Todo #${todo.index + 1}`;

        // Get completed status from mapping (if available, from previous decryption)
        const completedFromMap = completedMap[todo.idHandle] || false;

        loadedTodos.push({
          id: `todo-${todo.index}`,
          text,
          encryptedId: todo.idHandle,
          encryptedCompleted: todo.completedHandle,
          completed: completedFromMap, // Use saved completed status if available
          timestamp: todo.timestamp,
          index: todo.index,
          isDecrypted: !!textFromMap, // Mark as decrypted if text is available
        });
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
  }, [contractAddress, ethersProvider, address, fhevmInstance, ethersSigner, getTextMap]);

  const decryptTodos = useCallback(async () => {
    if (!contractAddress || !ethersProvider || !address || !fhevmInstance || !ethersSigner) {
      setMessage("Missing requirements for decryption");
      return;
    }

    if (todos.length === 0) {
      setMessage("No todos to decrypt");
      return;
    }

    try {
      setIsDecrypting(true);
      setMessage("Decrypting todos...");

      // Collect all handles for batch decryption
      const handleContractPairs: Array<{ handle: string; contractAddress: `0x${string}` }> = [];
      for (const todo of todos) {
        if (todo.encryptedId && todo.encryptedId.length > 0) {
          handleContractPairs.push({
            handle: todo.encryptedId,
            contractAddress: contractAddress as `0x${string}`,
          });
        }
        if (todo.encryptedCompleted && todo.encryptedCompleted.length > 0) {
          handleContractPairs.push({
            handle: todo.encryptedCompleted,
            contractAddress: contractAddress as `0x${string}`,
          });
        }
      }

      if (handleContractPairs.length === 0) {
        throw new Error("No handles to decrypt");
      }

      // Generate keypair once
      const keypair = (fhevmInstance as any).generateKeypair?.() || {
        publicKey: new Uint8Array(32).fill(0),
        privateKey: new Uint8Array(32).fill(0),
      };

      // Create EIP712 signature once
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

      // Sign once for all decryptions
      const signature = await ethersSigner.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message
      );

      const signatureForDecrypt = chainId === 31337 ? signature.replace("0x", "") : signature;

      // Batch decrypt all handles at once
      console.log("[useTodoList] Decrypting handles:", handleContractPairs.map(h => h.handle));
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

      console.log("[useTodoList] Decryption result:", decryptedResult);
      console.log("[useTodoList] Decryption result keys:", Object.keys(decryptedResult));

      // Update todos with decrypted values
      const textMap = getTextMap();
      const completedMap = getCompletedMap();
      console.log("[useTodoList] Text map:", textMap);
      console.log("[useTodoList] Text map keys:", Object.keys(textMap));
      console.log("[useTodoList] Completed map:", completedMap);
      
      const updatedTodos = todos.map(todo => {
        // Ensure handles are in the same format (lowercase)
        const idHandle = todo.encryptedId?.toLowerCase() || '';
        const completedHandle = todo.encryptedCompleted?.toLowerCase() || '';
        
        // Try different handle formats to find the decrypted value
        const idValue = decryptedResult[idHandle] || decryptedResult[todo.encryptedId] || 0;
        const completedValue = decryptedResult[completedHandle] || decryptedResult[todo.encryptedCompleted] || 0;
        
        const id = Number(idValue || 0);
        const completed = Number(completedValue || 0) === 1;

        // Get text from mapping (should exist from when todo was created)
        // Try multiple handle formats to find the text
        // Also try to convert handle to array string format (for old data compatibility)
        let textFromMap = textMap[idHandle] 
          || textMap[todo.encryptedId] 
          || textMap[todo.encryptedId.toLowerCase()]
          || textMap[todo.encryptedId.toUpperCase()];
        
        // If not found, try array string format (for old incorrectly saved data)
        if (!textFromMap && todo.encryptedId.startsWith('0x')) {
          try {
            // Convert hex string to bytes array string format
            const hexWithoutPrefix = todo.encryptedId.slice(2);
            const bytes: number[] = [];
            for (let i = 0; i < hexWithoutPrefix.length; i += 2) {
              bytes.push(parseInt(hexWithoutPrefix.substr(i, 2), 16));
            }
            const arrayStringKey = bytes.join(',');
            textFromMap = textMap[arrayStringKey];
          } catch (e) {
            // Ignore conversion errors
          }
        }
        
        // If text not found in map, we need to use the decrypted ID to look it up
        // But since we don't have a reverse mapping, we'll show a generic text
        const text = textFromMap || (todo.text.startsWith('Encrypted Todo') ? `Todo #${todo.index + 1}` : todo.text);
        
        console.log("[useTodoList] Looking for text:", {
          idHandle,
          encryptedId: todo.encryptedId,
          textMapKeys: Object.keys(textMap),
          textFromMap,
          finalText: text,
        });

        console.log("[useTodoList] Decrypting todo:", {
          index: todo.index,
          encryptedId: todo.encryptedId,
          idHandle,
          textFromMap,
          currentText: todo.text,
          finalText: text,
          completed,
          id,
          idValue,
          completedValue,
        });

        // Save completed status to mapping
        if (todo.encryptedId) {
          completedMap[todo.encryptedId.toLowerCase()] = completed;
        }

        return {
          ...todo,
          text,
          completed,
          isDecrypted: true, // Mark as decrypted
        };
      });

      // Save completed status mapping
      saveCompletedMap(completedMap);

      console.log("[useTodoList] Updated todos after decryption:", updatedTodos);
      setTodos(updatedTodos);
      setMessage("Todos decrypted successfully!");
    } catch (error: any) {
      const errorMessage = error.reason || error.message || String(error);
      setMessage(`Error decrypting todos: ${errorMessage}`);
      console.error("[useTodoList] Error decrypting todos:", error);
      throw error;
    } finally {
      setIsDecrypting(false);
    }
  }, [contractAddress, ethersProvider, address, fhevmInstance, ethersSigner, todos, chainId, getTextMap]);

  useEffect(() => {
    if (contractAddress && ethersProvider && address && fhevmInstance && ethersSigner) {
      loadTodos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractAddress, ethersProvider, address, fhevmInstance, ethersSigner]);

  return {
    contractAddress,
    todos,
    isLoading,
    isDecrypting,
    message,
    createTodo,
    toggleTodo,
    loadTodos,
    decryptTodos,
  };
}

