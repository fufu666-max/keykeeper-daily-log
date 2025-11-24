import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { PrivateTodoList, PrivateTodoList__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("PrivateTodoList")) as PrivateTodoList__factory;
  const todoListContract = (await factory.deploy()) as PrivateTodoList;
  const todoListContractAddress = await todoListContract.getAddress();

  return { todoListContract, todoListContractAddress };
}

describe("PrivateTodoList", function () {
  let signers: Signers;
  let todoListContract: PrivateTodoList;
  let todoListContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ todoListContract, todoListContractAddress } = await deployFixture());
  });

  it("should have zero todos after deployment", async function () {
    const count = await todoListContract.getTodoCount(signers.alice.address);
    expect(count).to.eq(0);
  });

  it("should create a new encrypted todo", async function () {
    // Create a simple hash for the todo text (simulating "Buy medicine")
    const todoText = "Buy medicine";
    const todoId = ethers.id(todoText);
    const todoIdUint32 = BigInt(todoId) & BigInt("0xFFFFFFFF");
    
    // Encrypt todo ID as euint32
    const encryptedId = await fhevm
      .createEncryptedInput(todoListContractAddress, signers.alice.address)
      .add32(Number(todoIdUint32))
      .encrypt();

    // Encrypt completion status as euint32 (0 = not completed)
    const encryptedCompleted = await fhevm
      .createEncryptedInput(todoListContractAddress, signers.alice.address)
      .add32(0)
      .encrypt();

    const tx = await todoListContract
      .connect(signers.alice)
      .createTodo(
        encryptedId.handles[0],
        encryptedCompleted.handles[0],
        encryptedId.inputProof,
        encryptedCompleted.inputProof
      );
    await tx.wait();

    const count = await todoListContract.getTodoCount(signers.alice.address);
    expect(count).to.eq(1);

    // Get the todo and decrypt
    const [encryptedTodoId, encryptedTodoCompleted, timestamp] = await todoListContract.getTodo(
      signers.alice.address,
      0
    );

    expect(timestamp).to.be.gt(0);

    // Decrypt the todo ID
    const decryptedId = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedTodoId,
      todoListContractAddress,
      signers.alice,
    );

    // Decrypt the completion status
    const decryptedCompleted = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedTodoCompleted,
      todoListContractAddress,
      signers.alice,
    );

    expect(Number(decryptedId)).to.eq(Number(todoIdUint32));
    expect(decryptedCompleted).to.eq(0);
  });

  it("should toggle todo completion status", async function () {
    // Create a todo first
    const todoText = "Interview preparation";
    const todoId = ethers.id(todoText);
    const todoIdUint32 = BigInt(todoId) & BigInt("0xFFFFFFFF");
    
    const encryptedId = await fhevm
      .createEncryptedInput(todoListContractAddress, signers.alice.address)
      .add32(Number(todoIdUint32))
      .encrypt();

      const encryptedCompleted = await fhevm
        .createEncryptedInput(todoListContractAddress, signers.alice.address)
        .add32(0)
        .encrypt();

    let tx = await todoListContract
      .connect(signers.alice)
      .createTodo(
        encryptedId.handles[0],
        encryptedCompleted.handles[0],
        encryptedId.inputProof,
        encryptedCompleted.inputProof
      );
    await tx.wait();

    // Toggle to completed (1)
    const encryptedCompletedToggle = await fhevm
      .createEncryptedInput(todoListContractAddress, signers.alice.address)
      .add32(1)
      .encrypt();

    tx = await todoListContract
      .connect(signers.alice)
      .toggleTodo(0, encryptedCompletedToggle.handles[0], encryptedCompletedToggle.inputProof);
    await tx.wait();

    // Get and decrypt the todo
    const [, encryptedTodoCompleted] = await todoListContract.getTodo(
      signers.alice.address,
      0
    );

    const decryptedCompleted = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedTodoCompleted,
      todoListContractAddress,
      signers.alice,
    );

    expect(decryptedCompleted).to.eq(1);
  });

  it("should create multiple todos for the same user", async function () {
    const todos = ["Buy medicine", "Interview preparation", "Call doctor"];
    
    for (const todoText of todos) {
      const todoId = ethers.id(todoText);
      const todoIdUint32 = BigInt(todoId) & BigInt("0xFFFFFFFF");
      
      const encryptedId = await fhevm
        .createEncryptedInput(todoListContractAddress, signers.alice.address)
        .add32(Number(todoIdUint32))
        .encrypt();

      const encryptedCompleted = await fhevm
        .createEncryptedInput(todoListContractAddress, signers.alice.address)
        .add32(0)
        .encrypt();

      const tx = await todoListContract
        .connect(signers.alice)
        .createTodo(
          encryptedId.handles[0],
          encryptedCompleted.handles[0],
          encryptedId.inputProof,
          encryptedCompleted.inputProof
        );
      await tx.wait();
    }

    const count = await todoListContract.getTodoCount(signers.alice.address);
    expect(count).to.eq(3);
  });

  it("should isolate todos between different users", async function () {
    // Alice creates a todo
    const todoText = "Alice's task";
    const todoId = ethers.id(todoText);
    const todoIdUint32 = BigInt(todoId) & BigInt("0xFFFFFFFF");
    
    const encryptedId = await fhevm
      .createEncryptedInput(todoListContractAddress, signers.alice.address)
      .add32(Number(todoIdUint32))
      .encrypt();

      const encryptedCompleted = await fhevm
        .createEncryptedInput(todoListContractAddress, signers.alice.address)
        .add32(0)
        .encrypt();

    await todoListContract
      .connect(signers.alice)
      .createTodo(
        encryptedId.handles[0],
        encryptedCompleted.handles[0],
        encryptedId.inputProof,
        encryptedCompleted.inputProof
      );

    // Bob creates a todo
    const bobTodoText = "Bob's task";
    const bobTodoId = ethers.id(bobTodoText);
    const bobTodoIdUint32 = BigInt(bobTodoId) & BigInt("0xFFFFFFFF");
    
    const bobEncryptedId = await fhevm
      .createEncryptedInput(todoListContractAddress, signers.bob.address)
      .add32(Number(bobTodoIdUint32))
      .encrypt();

    const bobEncryptedCompleted = await fhevm
      .createEncryptedInput(todoListContractAddress, signers.bob.address)
      .add8(0)
      .encrypt();

    await todoListContract
      .connect(signers.bob)
      .createTodo(
        bobEncryptedId.handles[0],
        bobEncryptedCompleted.handles[0],
        bobEncryptedId.inputProof,
        bobEncryptedCompleted.inputProof
      );

    const aliceCount = await todoListContract.getTodoCount(signers.alice.address);
    const bobCount = await todoListContract.getTodoCount(signers.bob.address);

    expect(aliceCount).to.eq(1);
    expect(bobCount).to.eq(1);
  });
});

