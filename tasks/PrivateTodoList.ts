import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";

task("privateTodoList:deploy", "Deploy PrivateTodoList contract")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { ethers, deployments } = hre;
    const [deployer] = await ethers.getSigners();

    console.log("Deploying PrivateTodoList with account:", deployer.address);
    console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

    const PrivateTodoList = await ethers.getContractFactory("PrivateTodoList");
    const privateTodoList = await PrivateTodoList.deploy();

    await privateTodoList.waitForDeployment();
    const address = await privateTodoList.getAddress();

    console.log("PrivateTodoList deployed to:", address);

    // Save deployment info
    await deployments.save("PrivateTodoList", {
      abi: (await hre.artifacts.readArtifact("PrivateTodoList")).abi,
      address: address,
    });

    return address;
  });

task("privateTodoList:getCount", "Get todo count for a user")
  .addParam("address", "User address")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { ethers, deployments } = hre;
    const PrivateTodoListDeployment = await deployments.get("PrivateTodoList");
    const privateTodoList = await ethers.getContractAt(
      "PrivateTodoList",
      PrivateTodoListDeployment.address
    );

    const count = await privateTodoList.getTodoCount(taskArgs.address);
    console.log(`Todo count for ${taskArgs.address}: ${count}`);
  });

