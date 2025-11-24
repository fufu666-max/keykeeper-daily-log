import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { PrivateTodoList } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  alice: HardhatEthersSigner;
};

describe("PrivateTodoListSepolia", function () {
  let signers: Signers;
  let todoListContract: PrivateTodoList;
  let todoListContractAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const PrivateTodoListDeployment = await deployments.get("PrivateTodoList");
      todoListContractAddress = PrivateTodoListDeployment.address;
      todoListContract = await ethers.getContractAt("PrivateTodoList", PrivateTodoListDeployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("should create and toggle a todo on Sepolia", async function () {
    steps = 12;

    this.timeout(4 * 40000);

    progress("Creating encrypted todo ID...");
    const todoText = "Buy medicine";
    const todoId = ethers.id(todoText);
    const todoIdUint32 = BigInt(todoId) & BigInt("0xFFFFFFFF");
    
    const encryptedId = await fhevm
      .createEncryptedInput(todoListContractAddress, signers.alice.address)
      .add32(Number(todoIdUint32))
      .encrypt();

    progress("Creating encrypted completion status...");
    const encryptedCompleted = await fhevm
      .createEncryptedInput(todoListContractAddress, signers.alice.address)
      .add32(0)
      .encrypt();

    progress(`Calling createTodo() on contract=${todoListContractAddress}...`);
    let tx = await todoListContract
      .connect(signers.alice)
      .createTodo(
        encryptedId.handles[0],
        encryptedCompleted.handles[0],
        encryptedId.inputProof,
        encryptedCompleted.inputProof
      );
    await tx.wait();

    progress("Checking todo count...");
    const count = await todoListContract.getTodoCount(signers.alice.address);
    expect(count).to.eq(1);

    progress("Getting encrypted todo...");
    const [encryptedTodoId, encryptedTodoCompleted, timestamp] = await todoListContract.getTodo(
      signers.alice.address,
      0
    );

    progress(`Decrypting todo ID...`);
    const decryptedId = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedTodoId,
      todoListContractAddress,
      signers.alice,
    );
    progress(`Decrypted todo ID=${decryptedId}`);

    progress(`Decrypting completion status...`);
    const decryptedCompleted = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedTodoCompleted,
      todoListContractAddress,
      signers.alice,
    );
    progress(`Decrypted completion status=${decryptedCompleted}`);

    expect(Number(decryptedId)).to.eq(Number(todoIdUint32));
    expect(decryptedCompleted).to.eq(0);

    progress("Toggling todo to completed...");
    const encryptedCompletedToggle = await fhevm
      .createEncryptedInput(todoListContractAddress, signers.alice.address)
      .add32(1)
      .encrypt();

    tx = await todoListContract
      .connect(signers.alice)
      .toggleTodo(0, encryptedCompletedToggle.handles[0], encryptedCompletedToggle.inputProof);
    await tx.wait();

    progress("Getting updated todo...");
    const [, updatedEncryptedCompleted] = await todoListContract.getTodo(
      signers.alice.address,
      0
    );

    progress("Decrypting updated completion status...");
    const updatedDecryptedCompleted = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      updatedEncryptedCompleted,
      todoListContractAddress,
      signers.alice,
    );
    progress(`Updated completion status=${updatedDecryptedCompleted}`);

    expect(updatedDecryptedCompleted).to.eq(1);
  });
});

