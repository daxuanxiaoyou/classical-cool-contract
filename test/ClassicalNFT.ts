// import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { deployments, ethers, network } from "hardhat";
import { utils, Wallet } from "ethers";
import {
  concat,
  hashMessage,
  joinSignature,
  keccak256,
  toUtf8Bytes,
} from "ethers/lib/utils";
import { SigningKey } from "@ethersproject/signing-key";
import { serialize } from "@ethersproject/transactions";
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
import dotenv from "dotenv";
dotenv.config();

const _INTERFACE_ID_ERC165 = "0x01ffc9a7";
const _INTERFACE_ID_ROYALTIES_EIP2981 = "0x2a55205a";
const _INTERFACE_ID_ERC721 = "0x80ac58cd";
const privateKey =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; //localhost 的私钥
// const privateKey = `0x${process.env.ACCOUNT_PRIVATE_KEY}` || "";
const privateKeyNo0x =
  "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

// import { keccak256 } from "@ethersproject/keccak256";

describe("ClassicalNFT", () => {
  let ClassicalNFT: any;
  let royaltiesRecipient: any; // 版税费用收款地址
  let owner: any; // 合约的 owner 地址
  let publicGoodAddress: any; // 公益捐赠收款地址
  let treasuryAddress: any; // 国库地址
  let otherAccount: any; // 其他地址
  let otherAccount1: any; // 其他地址
  let otherAccount2: any; // 其他地址
  let classicalNFT: any; // 合约实例
  let ClassicalNFTedAmount: number;
  const ADDRESS_ZERO = ethers.constants.AddressZero;

  async function deployClassicalNFTFixture() {
    [
      owner,
      royaltiesRecipient,
      publicGoodAddress,
      treasuryAddress,
      otherAccount,
      otherAccount1,
      otherAccount2,
    ] = await ethers.getSigners();

    ClassicalNFT = await ethers.getContractFactory("ClassicalNFT");
    classicalNFT = await ClassicalNFT.deploy(
      treasuryAddress.address,
      publicGoodAddress.address,
      300
    );
    await classicalNFT.deployed();

    const ONE_GWEI = 1_000_000_000;

    ClassicalNFTedAmount = ONE_GWEI;

    // Fixtures can return anything you consider useful for your tests
    return {
      ClassicalNFT,
      classicalNFT,
      owner,
      royaltiesRecipient,
      publicGoodAddress,
      treasuryAddress,
      otherAccount,
      otherAccount1,
      otherAccount2,
    };
  }

  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.

  /**
   * 长度太大了，达到了 193，导致签名失败，底层实现比这个要复杂的多。
   * @param message
   * @param privateKey
   * @returns
   */
  async function signMsgFromString(message: string, privateKey: string) {
    const prefix = "\x19Ethereum Signed Message:\n20";
    const messageHash = keccak256(Buffer.from(prefix + message));
    const privateKeyBuffer = Buffer.from(privateKey, "hex");
    const signingKey = new utils.SigningKey(privateKeyBuffer);
    const signature = signingKey.signDigest(messageHash);
    const { r, s, v } = utils.splitSignature(signature);
    const signatureBytes = Buffer.concat([
      Buffer.from(r),
      Buffer.from(s),
      Buffer.from([v]),
    ]);
    const signedMessage = Buffer.concat([
      Buffer.from(prefix),
      Buffer.from(message),
      signatureBytes,
    ]);
    // const signedMessageHex = signedMessage.toString("hex");
    const signedMessageArrayify = utils.arrayify(signedMessage);
    // console.log(
    //   "signedMessageArrayify:",
    //   signedMessageArrayify,
    //   signedMessageArrayify.length
    // );
    return signedMessageArrayify;
  }

  /**
   * 因为地址类型在 js 端是 42 为，减去 0x 2位，剩余 40 位（ js 端是按照4位算1位，所以算出来 length 是 40），在 solidity 端却是按照 8 bit 一位，所以 lenght 是 20 位。
   * 两端的 length 计算逻辑不一样，所以结果不一样，就需要在 js 端通过 keccak256 算法将地址 address 转化为 256 位，也就是length 32（256/8）
   * 然后在 solidity 端验签的时候，需要在 prefix 里面一样通过 keccak256 转化为 32 的 message。
   * 这样在 js 和 dolidity 的 prefix 都是 32,解析就一致了。
   * @param msg
   * @param privateKey
   * @returns
   */
  async function signMsgFromAddress(
    senderAddress: string,
    bookId: string,
    classicalNFTAddr: string,
    chainId: number,
    privateKey: string
  ) {
    const signingKey = new SigningKey(privateKey);
    const message = ethers.utils.solidityKeccak256(
      ["address", "string", "address", "uint"],
      [senderAddress, bookId, classicalNFTAddr, chainId]
    );
    const data = ethers.utils.arrayify(message);
    const hashData = hashMessage(data);
    const digestData = signingKey.signDigest(hashData);
    const signature = joinSignature(digestData);

    // const recoveredAddress = utils.recoverAddress(hashData, signature);
    return signature;
  }

  /**
   * 固定 20 个长度的签名
   * @param msg
   * @param privateKey
   * @returns
   */
  async function signMsgFrom20(msg: string, privateKey: string) {
    const signingKey = new SigningKey(privateKey);
    const messagePrefix = "\x19Ethereum Signed Message:\n20";
    let bytesMsg: Uint8Array = Uint8Array.from([]);
    if (typeof msg === "string") {
      bytesMsg = toUtf8Bytes(msg);
    }
    const hashStr = keccak256(concat([toUtf8Bytes(messagePrefix), bytesMsg]));
    const signature = joinSignature(signingKey.signDigest(hashStr));
    return signature;
  }

  /**
   * 通过签名签名的方法
   * @param msg
   * @param privateKey
   * @returns
   */
  async function signMsgFromWallet(msg: string, privateKey: string) {
    const walletPrivateKey = new Wallet(privateKey);
    const signedMsg = await walletPrivateKey.signMessage(msg);

    console.log(walletPrivateKey.getAddress());
    console.log("signedMsg:", signedMsg);
    return signedMsg;
  }

  describe("Main", function () {
    it("verify sign message", async function () {
      const { classicalNFT, owner } = await loadFixture(
        deployClassicalNFTFixture
      );
      await classicalNFT.setPublicKey(owner.address);

      // 1、------------------------全部自己实现的逻辑 ------------------------
      // const sigedMsg = signMsgFromString(
      //   "99999999999999999999999999999999", //普通 32 位字符
      //   privateKeyNo0x
      // );

      // 2、------------------------针对长度为 20 的普通字符做验证------------------------
      // const sigedMsg = signMsgFrom20(
      //   "99999999999999999999", //普通 20 位字符
      //   privateKey
      // );
      // const verifyRtn = await classicalNFT._verify20(sigedMsg);

      // 对应的合约代码
      // // TODO:need use internal
      // function _verify20(bytes memory signature) public view returns (bool verified) {
      //   bytes memory prefix = "\x19Ethereum Signed Message:\n20";
      //   bytes32 prefixedHash = keccak256(abi.encodePacked(prefix, '99999999999999999999'));
      //   address calculated_public_key = ECDSA.recover(prefixedHash, signature); // same： prefixedHash.recover(signature)
      //   console.log('---------------');
      //   console.logBytes(signature);
      //   console.log(signature.length);
      //   console.logBytes32(prefixedHash);
      //   console.log(prefixedHash.length);
      //   console.logAddress(calculated_public_key);
      //   return (calculated_public_key == public_key);
      // }

      // 3、------------------------针对 address 验证------------------------
      const bookId = "bookid1";
      const classicalNFTAddr = classicalNFT.address;
      // const chainId = await (
      //   await ethers.getDefaultProvider().getNetwork()
      // ).chainId;

      const netName = network.name;
      const netId = network.config.chainId || 1;

      const sigedMsg = signMsgFromAddress(
        owner.address, //msg.sender
        bookId,
        classicalNFTAddr,
        netId,
        privateKey
      );

      const verifyRtn = await classicalNFT._verifySignMsg(
        sigedMsg,
        bookId,
        classicalNFTAddr,
        netId
      );
      // const verifyRtn = await classicalNFT._verify2(sigedMsg);

      // 对应的合约代码
      //   function _verifySignMsg(bytes memory signature) public view returns (bool verified) {
      //     bytes memory prefix = "\x19Ethereum Signed Message:\n32";
      //     bytes32 prefixedHash = keccak256(abi.encodePacked(prefix, keccak256( abi.encodePacked(msg.sender))));
      //     address calculated_public_key = ECDSA.recover(prefixedHash, signature); // same： prefixedHash.recover(signature)
      //     return (calculated_public_key == public_key);
      // }

      // const verifyRtn = await classicalNFT._verify(sigedMsg);
      // const verifyRtn = await classicalNFT._verify2(sigedMsg);

      expect(verifyRtn).to.equal(true);
    });

    it("has all the right interfaces", async function () {
      const { classicalNFT } = await loadFixture(deployClassicalNFTFixture);
      expect(
        await classicalNFT.supportsInterface(_INTERFACE_ID_ERC165),
        "Error Royalties 165"
      ).to.be.true;

      expect(
        await classicalNFT.supportsInterface(_INTERFACE_ID_ROYALTIES_EIP2981),
        "Error Royalties 2981"
      ).to.be.true;

      expect(
        await classicalNFT.supportsInterface(_INTERFACE_ID_ERC721),
        "Error Royalties 721"
      ).to.be.true;
    });
    it("throws if royalty fee will exceed salePrice", async function () {
      const { classicalNFT } = await loadFixture(deployClassicalNFTFixture);
      const tx = classicalNFT.setDefaultRoyalty(10001);

      await expect(tx).to.be.revertedWith(
        "ERC2981: royalty fee will exceed salePrice"
      );
    });
    it("has the right recerver and royalty amount", async function () {
      const { classicalNFT, owner, otherAccount } = await loadFixture(
        deployClassicalNFTFixture
      );
      await classicalNFT.setPublicKey(owner.address);
      const chainId = network.config.chainId || 1;
      const bookId = "bookId1";

      const sigedMsg = signMsgFromAddress(
        owner.address, //msg.sender
        bookId,
        classicalNFT.address,
        chainId,
        privateKey
      );

      const tx = classicalNFT.mint(
        otherAccount.address,
        bookId,
        sigedMsg,
        classicalNFT.address,
        chainId,
        {
          value: ethers.utils.parseEther("0.0002"),
        }
      );
      const tokenId = await tx.wait();

      await classicalNFT.setTokenRoyalty(tokenId, 3000);
      const { receiver, royaltyAmount } = classicalNFT.royaltyInfo(
        tokenId,
        100
      ); // 100*3000/10000 = 30

      expect(receiver).to.be.equal(classicalNFT.address);
      expect(royaltyAmount).to.be.equal(30);
    });

    it("Should mint only once", async function () {
      const { classicalNFT, owner, otherAccount } = await loadFixture(
        deployClassicalNFTFixture
      );
      await classicalNFT.setPublicKey(owner.address);
      const bookId = "bookid1";

      const chainId = network.config.chainId || 1;

      const sigedMsg = signMsgFromAddress(
        owner.address, //msg.sender
        bookId,
        classicalNFT.address,
        chainId,
        privateKey
      );

      const tx1 = await classicalNFT.mint(
        otherAccount.address,
        bookId,
        sigedMsg,
        classicalNFT.address,
        chainId,
        {
          value: ethers.utils.parseEther("0.0002"),
        }
      );

      await tx1.wait();

      // 第二次 mint 会提示错误
      const tx2 = classicalNFT.mint(
        otherAccount.address,
        bookId,
        sigedMsg,
        classicalNFT.address,
        chainId,
        {
          value: ethers.utils.parseEther("0.0002"),
        }
      );

      await expect(tx2).to.be.revertedWith("Book id exist");
    });
    it("Mint success", async function () {
      const { classicalNFT, owner } = await loadFixture(
        deployClassicalNFTFixture
      );
      await classicalNFT.setPublicKey(owner.address);
      const bookId1 = "bookid1";
      const bookId2 = "bookid2";

      const chainId = network.config.chainId || 1;

      const sigedMsg1 = signMsgFromAddress(
        owner.address, //msg.sender
        bookId1,
        classicalNFT.address,
        chainId,
        privateKey
      );
      const sigedMsg2 = signMsgFromAddress(
        owner.address, //msg.sender
        bookId2,
        classicalNFT.address,
        chainId,
        privateKey
      );

      await classicalNFT.mint(
        owner.address,
        bookId1,
        sigedMsg1,
        classicalNFT.address,
        chainId,
        {
          value: ethers.utils.parseEther("0.0002"),
        }
      );

      await classicalNFT.mint(
        owner.address,
        bookId2,
        sigedMsg2,
        classicalNFT.address,
        chainId,
        {
          value: ethers.utils.parseEther("0.0002"),
        }
      );

      const getBookList = await classicalNFT.getBookList();
      await expect(getBookList).to.be.contains(bookId1).to.be.contains(bookId2);
    });
  });
  // describe("Mint", function () {});

  // describe("Other", function () {
  //   it("has the right royalties for tokenId", async function () {
  //     await classicalNFT.mint(
  //       owner.address,
  //       royaltiesRecipient.address,
  //       250 // 2.50%
  //     );

  //     const info = await classicalNFT.royaltyInfo(0, 10000);
  //     expect(info[1].toNumber()).to.be.equal(250);
  //     expect(info[0]).to.be.equal(royaltiesRecipient.address);
  //   });

  //   it("can set address(0) as royalties recipient", async function () {
  //     // 0.01% royalties
  //     await classicalNFT.mint(owner.address, ADDRESS_ZERO, 1);

  //     const info = await classicalNFT.royaltyInfo(0, 10000);
  //     expect(info[1].toNumber()).to.be.equal(1);
  //     expect(info[0]).to.be.equal(ADDRESS_ZERO);
  //   });

  //   it("has no royalties if not set", async function () {
  //     await classicalNFT.mint(owner.address, royaltiesRecipient.address, 0);

  //     const info = await classicalNFT.royaltyInfo(0, 100);
  //     expect(info[1].toNumber()).to.be.equal(0);
  //     expect(info[0]).to.be.equal(ADDRESS_ZERO);
  //   });
  //   it("Should receive and store the funds to ClassicalNFT", async function () {
  //     const { ClassicalNFT, ClassicalNFTedAmount } = await loadFixture(
  //       deployClassicalNFTFixture
  //     );

  //     expect(await ethers.provider.getBalance(ClassicalNFT.address)).to.equal(
  //       ClassicalNFTedAmount
  //     );
  //   });
  // });

  describe("owner set roles", function () {
    it("should set whitelist", async function () {
      const { classicalNFT } = await loadFixture(deployClassicalNFTFixture);
      const whitelist = [otherAccount.address, otherAccount1.address];

      await classicalNFT.addToWhitelist(whitelist);
      expect(
        await classicalNFT.hasRole(
          classicalNFT.FREE_MINT_ROLE(),
          otherAccount.address
        )
      ).to.be.true;

      await classicalNFT.removeFromWhitelist(whitelist);
      expect(
        await classicalNFT.hasRole(
          classicalNFT.FREE_MINT_ROLE(),
          otherAccount.address
        )
      ).to.be.false;

      try {
        await classicalNFT.connect(otherAccount).addToWhitelist(whitelist);
      } catch (e) {
        expect(
          await classicalNFT.hasRole(
            classicalNFT.FREE_MINT_ROLE(),
            otherAccount.address
          )
        ).to.be.false;
      }
    });
    it("should set mintable role", async function () {
      const { classicalNFT } = await loadFixture(deployClassicalNFTFixture);

      await classicalNFT.addToSwitchlist(otherAccount.address);
      expect(
        await classicalNFT.hasRole(
          classicalNFT.SWITCH_MINT_ROLE(),
          otherAccount.address
        )
      ).to.be.true;

      await classicalNFT.removeFromSwitchList(otherAccount.address);
      expect(
        await classicalNFT.hasRole(
          classicalNFT.SWITCH_MINT_ROLE(),
          otherAccount.address
        )
      ).to.be.false;

      try {
        await classicalNFT
          .connect(otherAccount)
          .removeFromSwitchList(otherAccount.address);
      } catch (e) {
        expect(
          await classicalNFT.hasRole(
            classicalNFT.SWITCH_MINT_ROLE(),
            otherAccount.address
          )
        ).to.be.false;
      }
    });

    it("should set setTreasuryAddress", async function () {
      const { classicalNFT } = await loadFixture(deployClassicalNFTFixture);

      await classicalNFT.setTreasuryAddress(otherAccount.address);

      expect(await classicalNFT.treasuryAddress()).to.be.equal(
        otherAccount.address
      );
    });

    it("should set setPublicGoodAddress", async function () {
      const { classicalNFT } = await loadFixture(deployClassicalNFTFixture);

      await classicalNFT.setPublicGoodAddress(otherAccount.address);

      expect(await classicalNFT.publicGoodAddress()).to.be.equal(
        otherAccount.address
      );
    });

    it("should set setBaseTokenURI", async function () {
      const { classicalNFT } = await loadFixture(deployClassicalNFTFixture);

      await classicalNFT.setBaseTokenURI("test");

      expect(
        await classicalNFT.connect(otherAccount).baseTokenURI()
      ).to.be.equal("test");
    });
  });

  describe("owner mint reserve", function () {
    it("should mint reserve by owner", async function () {
      const { classicalNFT } = await loadFixture(deployClassicalNFTFixture);

      await classicalNFT.mintReserve(otherAccount.address, "book1");
      expect(await classicalNFT.bookList("book1")).to.be.true;
      expect(await classicalNFT.bookIds(0)).to.be.equal("book1");

      expect(await classicalNFT.ownerOf(1)).to.be.equal(otherAccount.address);
    });
    it("should not mint reserve by other", async function () {
      const { classicalNFT } = await loadFixture(deployClassicalNFTFixture);

      try {
        await classicalNFT
          .connect(otherAccount)
          .mintReserve(otherAccount.address, "book1");
      } catch (args) {
        expect(await classicalNFT.bookList("book1")).to.be.false;
        expect(args?.message).contains(" reverted with reason string");
      }
    });
  });

  describe("whitelist mint free", function () {
    it("should free mint by whitelist", async function () {
      const { classicalNFT, owner, otherAccount } = await loadFixture(
        deployClassicalNFTFixture
      );
      await classicalNFT.setPublicKey(owner.address);

      //set whitelist
      await classicalNFT.addToWhitelist([otherAccount.address]);

      const chainId = network.config.chainId || 1;

      const bookId = "bookId1";
    
      const sigedMsg = signMsgFromAddress(
        otherAccount.address,
        bookId,
        classicalNFT.address,
        chainId,
        privateKey
      );

      await classicalNFT.connect(otherAccount).mintFree(
        otherAccount.address,
        bookId,
        sigedMsg,
        classicalNFT.address,
        chainId
      );
    

      expect(await classicalNFT.ownerOf(101)).to.equal(otherAccount.address);
      
    });
    it("should not free mint by other", async function () {
      const { classicalNFT, owner, otherAccount } = await loadFixture(
        deployClassicalNFTFixture
      );
      await classicalNFT.setPublicKey(owner.address);

      const chainId = network.config.chainId || 1;
      const bookId = "bookId1";
    
      const sigedMsg = signMsgFromAddress(
        otherAccount.address, //msg.sender
        bookId,
        classicalNFT.address,
        chainId,
        privateKey
      );

      try {
        await classicalNFT
          .connect(otherAccount)
          .mintFree(otherAccount.address,
            bookId,
            sigedMsg,
            classicalNFT.address,
            chainId)
      } catch (args) {
        expect(await classicalNFT.bookList("book1")).to.be.false;
        expect(args?.message).contains(" reverted with reason string");
      }
    });
  });

  describe("withdrawPayments", function () {
    it("should withdrawPayments by owner", async function () {
      const { classicalNFT, owner, otherAccount } = await loadFixture(
        deployClassicalNFTFixture
      );
      await classicalNFT.setPublicKey(owner.address);

      //set whitelist
      await classicalNFT.addToWhitelist([otherAccount.address]);

      const chainId = network.config.chainId || 1;

      const bookId = "bookId1";
    
      const sigedMsg = signMsgFromAddress(
        otherAccount.address,
        bookId,
        classicalNFT.address,
        chainId,
        privateKey
      );

      await classicalNFT.connect(otherAccount).mint(
        otherAccount.address,
        bookId,
        sigedMsg,
        classicalNFT.address,
        chainId,
        {
          value: ethers.utils.parseEther("0.0002"),
        }
      );
      expect(await classicalNFT.ownerOf(101)).to.equal(otherAccount.address);

      let treasuryAddressNew = ethers.Wallet.createRandom();
      let publicGoodAddressNew = ethers.Wallet.createRandom();

      await classicalNFT.setTreasuryAddress(treasuryAddressNew.address);
      await classicalNFT.setPublicGoodAddress(publicGoodAddressNew.address);

      //withdraw
      await classicalNFT.withdrawPayments(owner.address);

      expect((await classicalNFT.totalBalance()).toString()).to.equal(ethers.utils.parseEther("0.0002"));
      expect((await ethers.provider.getBalance(await treasuryAddressNew.getAddress())).toString()).to.equal(ethers.utils.parseEther("0.00018"));
      expect((await ethers.provider.getBalance(await publicGoodAddressNew.getAddress())).toString()).to.equal(ethers.utils.parseEther("0.00002"));
      
    });
    it("should not withdrawPayments by other", async function () {
      const { classicalNFT, owner, otherAccount } = await loadFixture(
        deployClassicalNFTFixture
      );
      await classicalNFT.setPublicKey(owner.address);

      //set whitelist
      await classicalNFT.addToWhitelist([otherAccount.address]);

      const chainId = network.config.chainId || 1;

      const bookId = "bookId1";
    
      const sigedMsg = signMsgFromAddress(
        otherAccount.address,
        bookId,
        classicalNFT.address,
        chainId,
        privateKey
      );

      await classicalNFT.connect(otherAccount).mint(
        otherAccount.address,
        bookId,
        sigedMsg,
        classicalNFT.address,
        chainId,
        {
          value: ethers.utils.parseEther("0.0002"),
        }
      );
      expect(await classicalNFT.ownerOf(101)).to.equal(otherAccount.address);

      //withdraw
      try {
        await classicalNFT.connect(otherAccount).withdrawPayments(owner.address);
      } catch (e) {
        expect(e.message).contains(" reverted with reason string");
      }
    });
  });

  describe("transfer admin", function () {
    it("should transfer admin by owner steps", async function () {
      const { classicalNFT, owner, otherAccount } = await loadFixture(
        deployClassicalNFTFixture
      );
      
      //step1
      await classicalNFT.transferAdminStep1(otherAccount.address);

      expect((await classicalNFT.oldAdmin()).toString()).to.equal(owner.address);
      expect((await classicalNFT.hasRole(classicalNFT.DEFAULT_ADMIN_ROLE(),otherAccount.address))).to.be.true;

      //step2
      await classicalNFT.connect(otherAccount).transferAdminStep2();
      expect((await classicalNFT.oldAdmin()).toString()).to.equal('0x0000000000000000000000000000000000000000');
      expect((await classicalNFT.hasRole(classicalNFT.DEFAULT_ADMIN_ROLE(),otherAccount.address))).to.be.true;
      expect((await classicalNFT.hasRole(classicalNFT.DEFAULT_ADMIN_ROLE(),owner.address))).to.be.false;
    });
    it("should not multitimes step1", async function () {
      const { classicalNFT, owner, otherAccount } = await loadFixture(
        deployClassicalNFTFixture
      );
      //step1
      await classicalNFT.transferAdminStep1(otherAccount.address);

      try {
        await classicalNFT.transferAdminStep1(otherAccount.address);
      } catch (e) {
        expect(e.message).contains("reverted with reason string 'Step1 cannot be executed multiple times in a row'");
      }

    });

    it("should not multitimes step2", async function () {
      const { classicalNFT, owner, otherAccount } = await loadFixture(
        deployClassicalNFTFixture
      );

      //step1
      await classicalNFT.transferAdminStep1(otherAccount.address);

      expect((await classicalNFT.oldAdmin()).toString()).to.equal(owner.address);
      expect((await classicalNFT.hasRole(classicalNFT.DEFAULT_ADMIN_ROLE(),otherAccount.address))).to.be.true;
      //step2
      await classicalNFT.connect(otherAccount).transferAdminStep2();
      expect((await classicalNFT.oldAdmin()).toString()).to.equal('0x0000000000000000000000000000000000000000');
      expect((await classicalNFT.hasRole(classicalNFT.DEFAULT_ADMIN_ROLE(),otherAccount.address))).to.be.true;
      expect((await classicalNFT.hasRole(classicalNFT.DEFAULT_ADMIN_ROLE(),owner.address))).to.be.false;

      try {
        await classicalNFT.connect(otherAccount).transferAdminStep2();
      } catch (e) {
        expect(e.message).contains("reverted with reason string 'Step2 cannot be executed multiple times in a row'");
      }

    });

  });

  

  // describe("Withdrawals", function () {
  //   describe("Validations", function () {
  //     it("Should revert with the right error if called too soon", async function () {
  //       const { ClassicalNFT } = await loadFixture(deployClassicalNFTFixture);

  //       await expect(ClassicalNFT.withdraw()).to.be.revertedWith(
  //         "You can't withdraw yet"
  //       );
  //     });

  //     it("Should revert with the right error if called from another account", async function () {
  //       const { ClassicalNFT, unClassicalNFTTime, otherAccount } =
  //         await loadFixture(deployClassicalNFTFixture);

  //       // We can increase the time in Hardhat Network
  //       await time.increaseTo(unClassicalNFTTime);

  //       // We use ClassicalNFT.connect() to send a transaction from another account
  //       await expect(
  //         ClassicalNFT.connect(otherAccount).withdraw()
  //       ).to.be.revertedWith("You aren't the owner");
  //     });

  //     it("Shouldn't fail if the unClassicalNFTTime has arrived and the owner calls it", async function () {
  //       const { ClassicalNFT, unClassicalNFTTime } = await loadFixture(
  //         deployClassicalNFTFixture
  //       );

  //       // Transactions are sent using the first signer by default
  //       await time.increaseTo(unClassicalNFTTime);

  //       await expect(ClassicalNFT.withdraw()).not.to.be.reverted;
  //     });
  //   });

  //   describe("Events", function () {
  //     it("Should emit an event on withdrawals", async function () {
  //       const { ClassicalNFT, unClassicalNFTTime, ClassicalNFTedAmount } =
  //         await loadFixture(deployClassicalNFTFixture);

  //       await time.increaseTo(unClassicalNFTTime);

  //       await expect(ClassicalNFT.withdraw())
  //         .to.emit(ClassicalNFT, "Withdrawal")
  //         .withArgs(ClassicalNFTedAmount, anyValue); // We accept any value as `when` arg
  //     });
  //   });

  //   describe("Transfers", function () {
  //     it("Should transfer the funds to the owner", async function () {
  //       const {
  //         ClassicalNFT,
  //         unClassicalNFTTime,
  //         ClassicalNFTedAmount,
  //         owner,
  //       } = await loadFixture(deployClassicalNFTFixture);

  //       await time.increaseTo(unClassicalNFTTime);

  //       await expect(ClassicalNFT.withdraw()).to.changeEtherBalances(
  //         [owner, ClassicalNFT],
  //         [ClassicalNFTedAmount, -ClassicalNFTedAmount]
  //       );
  //     });
  //   });
  // });
});
