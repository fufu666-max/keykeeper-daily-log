// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title PrivateTodoList - Encrypted To-do List
/// @notice Allows users to create and manage encrypted to-do items privately
/// @dev Uses FHE to store encrypted to-do items on-chain
/// @dev Uses euint32 for todo ID (hash of text) and euint32 for completion status (0=incomplete, 1=complete)
contract PrivateTodoList is SepoliaConfig {
    // Struct to store encrypted todo item
    struct EncryptedTodo {
        euint32 id;           // Encrypted todo ID (hash of text content)
        euint32 completed;    // Encrypted completion status (0 = not completed, 1 = completed)
        uint256 timestamp;   // Plaintext timestamp for sorting
    }

    // Mapping from user address to their encrypted todos
    mapping(address => EncryptedTodo[]) private _userTodos;
    
    // Mapping to track todo count per user
    mapping(address => uint256) private _todoCount;

    event TodoCreated(address indexed user, uint256 indexed todoIndex, uint256 timestamp);
    event TodoToggled(address indexed user, uint256 indexed todoIndex, uint256 timestamp);

    /// @notice Create a new encrypted todo item
    /// @param encryptedId The encrypted todo ID (hash of text content)
    /// @param encryptedCompleted The encrypted completion status (0 = not completed, 1 = completed)
    /// @param idProof The FHE input proof for encryptedId
    /// @param completedProof The FHE input proof for encryptedCompleted
    function createTodo(
        externalEuint32 encryptedId,
        externalEuint32 encryptedCompleted,
        bytes calldata idProof,
        bytes calldata completedProof
    ) external {
        euint32 id = FHE.fromExternal(encryptedId, idProof);
        euint32 completed = FHE.fromExternal(encryptedCompleted, completedProof);

        EncryptedTodo memory newTodo = EncryptedTodo({
            id: id,
            completed: completed,
            timestamp: block.timestamp
        });

        _userTodos[msg.sender].push(newTodo);
        _todoCount[msg.sender]++;

        // Grant decryption permissions to the user
        FHE.allowThis(id);
        FHE.allow(id, msg.sender);
        FHE.allowThis(completed);
        FHE.allow(completed, msg.sender);

        emit TodoCreated(msg.sender, _todoCount[msg.sender] - 1, block.timestamp);
    }

    /// @notice Toggle the completion status of a todo item
    /// @param todoIndex The index of the todo item to toggle
    /// @param encryptedCompleted The new encrypted completion status (0 = not completed, 1 = completed)
    /// @param completedProof The FHE input proof for encryptedCompleted
    function toggleTodo(
        uint256 todoIndex,
        externalEuint32 encryptedCompleted,
        bytes calldata completedProof
    ) external {
        require(todoIndex < _userTodos[msg.sender].length, "Todo index out of bounds");
        
        euint32 completed = FHE.fromExternal(encryptedCompleted, completedProof);
        _userTodos[msg.sender][todoIndex].completed = completed;
        _userTodos[msg.sender][todoIndex].timestamp = block.timestamp;

        // Grant decryption permissions
        FHE.allowThis(completed);
        FHE.allow(completed, msg.sender);

        emit TodoToggled(msg.sender, todoIndex, block.timestamp);
    }

    /// @notice Get the encrypted todo item at a specific index
    /// @param user The user address
    /// @param index The index of the todo item
    /// @return encryptedId The encrypted todo ID
    /// @return encryptedCompleted The encrypted completion status (0 = not completed, 1 = completed)
    /// @return timestamp The plaintext timestamp
    function getTodo(address user, uint256 index) 
        external 
        view 
        returns (euint32 encryptedId, euint32 encryptedCompleted, uint256 timestamp) 
    {
        require(index < _userTodos[user].length, "Todo index out of bounds");
        EncryptedTodo memory todo = _userTodos[user][index];
        return (todo.id, todo.completed, todo.timestamp);
    }

    /// @notice Get the total number of todos for a user
    /// @param user The user address
    /// @return count The number of todos
    function getTodoCount(address user) external view returns (uint256 count) {
        return _userTodos[user].length;
    }

    /// @notice Get all todo timestamps for a user (for sorting/display purposes)
    /// @param user The user address
    /// @return timestamps Array of timestamps
    function getTodoTimestamps(address user) external view returns (uint256[] memory timestamps) {
        uint256 count = _userTodos[user].length;
        timestamps = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            timestamps[i] = _userTodos[user][i].timestamp;
        }
        return timestamps;
    }
}

