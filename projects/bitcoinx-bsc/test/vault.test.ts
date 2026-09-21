import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

const ONE = 10n ** 18n;

async function deployFixture() {
  const [owner, alice, bob, feeRecipient] = await ethers.getSigners();

  const btcb = await (await ethers.getContractFactory("MockERC20")).deploy("Binance-Peg BTCB", "BTCB", 18);
  const vault = await (await ethers.getContractFactory("BitcoinXVault")).deploy(
    await btcb.getAddress(),
    feeRecipient.address,
    owner.address,
  );
  const btcx = await ethers.getContractAt("BitcoinX", await vault.btcx());

  for (const user of [alice, bob]) {
    await btcb.mint(user.address, 100n * ONE);
    await btcb.connect(user).approve(await vault.getAddress(), ethers.MaxUint256);
  }

  return { owner, alice, bob, feeRecipient, btcb, vault, btcx };
}

describe("BitcoinX token", () => {
  it("cong bo metadata dung chuan va gan cung vault", async () => {
    const { vault, btcx } = await loadFixture(deployFixture);

    expect(await btcx.name()).to.equal("BitcoinX");
    expect(await btcx.symbol()).to.equal("BTCx");
    expect(await btcx.decimals()).to.equal(18);
    expect(await btcx.totalSupply()).to.equal(0n);
    expect(await btcx.vault()).to.equal(await vault.getAddress());
  });

  it("khong ai ngoai vault mint hoac burn duoc — ke ca owner", async () => {
    const { owner, alice, btcx } = await loadFixture(deployFixture);

    await expect(btcx.connect(owner).mint(owner.address, ONE)).to.be.revertedWithCustomError(btcx, "OnlyVault");
    await expect(btcx.connect(alice).mint(alice.address, ONE)).to.be.revertedWithCustomError(btcx, "OnlyVault");
    await expect(btcx.connect(owner).burn(alice.address, ONE)).to.be.revertedWithCustomError(btcx, "OnlyVault");
  });

  it("ho tro EIP-2612 permit (vi/DEX ky offline duoc)", async () => {
    const { alice, bob, vault, btcb, btcx } = await loadFixture(deployFixture);
    await vault.connect(alice).mint(ONE, alice.address);

    const net = await ethers.provider.getNetwork();
    const deadline = (await time.latest()) + 3600;
    const sig = await alice.signTypedData(
      { name: "BitcoinX", version: "1", chainId: net.chainId, verifyingContract: await btcx.getAddress() },
      {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      { owner: alice.address, spender: bob.address, value: ONE, nonce: 0n, deadline },
    );
    const { v, r, s } = ethers.Signature.from(sig);

    await btcx.permit(alice.address, bob.address, ONE, deadline, v, r, s);
    expect(await btcx.allowance(alice.address, bob.address)).to.equal(ONE);
    expect(await btcb.balanceOf(await vault.getAddress())).to.equal(ONE);
  });
});

describe("BitcoinXVault — mint/redeem 1:1", () => {
  it("mint dung ty le 1:1 va khoa toan bo collateral", async () => {
    const { alice, vault, btcb, btcx } = await loadFixture(deployFixture);

    await expect(vault.connect(alice).mint(2n * ONE, alice.address))
      .to.emit(vault, "Minted")
      .withArgs(alice.address, alice.address, 2n * ONE, 2n * ONE, 0n);

    expect(await btcx.balanceOf(alice.address)).to.equal(2n * ONE);
    expect(await btcx.totalSupply()).to.equal(2n * ONE);
    expect(await btcb.balanceOf(await vault.getAddress())).to.equal(2n * ONE);
    expect(await vault.backingRatio()).to.equal(ONE);
  });

  it("redeem tra lai dung so BTCB va dot BTCx tuong ung", async () => {
    const { alice, vault, btcb, btcx } = await loadFixture(deployFixture);
    await vault.connect(alice).mint(5n * ONE, alice.address);

    const before = await btcb.balanceOf(alice.address);
    await expect(vault.connect(alice).redeem(3n * ONE, alice.address))
      .to.emit(vault, "Redeemed")
      .withArgs(alice.address, alice.address, 3n * ONE, 3n * ONE, 0n);

    expect(await btcb.balanceOf(alice.address)).to.equal(before + 3n * ONE);
    expect(await btcx.totalSupply()).to.equal(2n * ONE);
    expect(await vault.backingRatio()).to.equal(ONE);
  });

  it("mint cho dia chi khac va redeem sang dia chi khac", async () => {
    const { alice, bob, vault, btcb, btcx } = await loadFixture(deployFixture);

    await vault.connect(alice).mint(ONE, bob.address);
    expect(await btcx.balanceOf(bob.address)).to.equal(ONE);

    const before = await btcb.balanceOf(alice.address);
    await vault.connect(bob).redeem(ONE, alice.address);
    expect(await btcb.balanceOf(alice.address)).to.equal(before + ONE);
  });

  it("chan cac tham so rong", async () => {
    const { alice, vault } = await loadFixture(deployFixture);

    await expect(vault.connect(alice).mint(0, alice.address)).to.be.revertedWithCustomError(vault, "ZeroAmount");
    await expect(vault.connect(alice).mint(ONE, ethers.ZeroAddress)).to.be.revertedWithCustomError(
      vault,
      "ZeroAddress",
    );
    await expect(vault.connect(alice).redeem(0, alice.address)).to.be.revertedWithCustomError(vault, "ZeroAmount");
  });

  it("previewMint/previewRedeem khop voi ket qua thuc te", async () => {
    const { owner, alice, vault, btcb, btcx } = await loadFixture(deployFixture);
    await vault.connect(owner).setFees(30, 20);

    const [previewOut] = await vault.previewMint(7n * ONE);
    await vault.connect(alice).mint(7n * ONE, alice.address);
    expect(await btcx.balanceOf(alice.address)).to.equal(previewOut);

    const [previewCollateral] = await vault.previewRedeem(previewOut);
    const before = await btcb.balanceOf(alice.address);
    await vault.connect(alice).redeem(previewOut, alice.address);
    expect(await btcb.balanceOf(alice.address)).to.equal(before + previewCollateral);
  });
});

describe("BitcoinXVault — phi", () => {
  it("thu phi mint va phi redeem dung bps, tra ve feeRecipient", async () => {
    const { owner, alice, feeRecipient, vault, btcb, btcx } = await loadFixture(deployFixture);
    await expect(vault.connect(owner).setFees(50, 50)).to.emit(vault, "FeesUpdated").withArgs(50, 50);

    await vault.connect(alice).mint(100n * ONE / 10n, alice.address); // 10 BTCB
    const expectedFee = (10n * ONE * 50n) / 10_000n;
    expect(await btcb.balanceOf(feeRecipient.address)).to.equal(expectedFee);
    expect(await btcx.balanceOf(alice.address)).to.equal(10n * ONE - expectedFee);
    expect(await vault.backingRatio()).to.equal(ONE);

    const amount = await btcx.balanceOf(alice.address);
    const redeemFee = (amount * 50n) / 10_000n;
    const before = await btcb.balanceOf(alice.address);
    await vault.connect(alice).redeem(amount, alice.address);
    expect(await btcb.balanceOf(alice.address)).to.equal(before + amount - redeemFee);
    expect(await btcb.balanceOf(feeRecipient.address)).to.equal(expectedFee + redeemFee);
  });

  it("khong the dat phi vuot tran cung 0.50%", async () => {
    const { owner, vault } = await loadFixture(deployFixture);

    expect(await vault.MAX_FEE_BPS()).to.equal(50);
    await expect(vault.connect(owner).setFees(51, 0)).to.be.revertedWithCustomError(vault, "FeeTooHigh");
    await expect(vault.connect(owner).setFees(0, 51)).to.be.revertedWithCustomError(vault, "FeeTooHigh");
    await expect(vault.connect(owner).setFees(10_000, 10_000)).to.be.revertedWithCustomError(vault, "FeeTooHigh");
  });

  it("chi owner doi duoc phi va feeRecipient", async () => {
    const { alice, vault } = await loadFixture(deployFixture);

    await expect(vault.connect(alice).setFees(10, 10)).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    await expect(vault.connect(alice).setFeeRecipient(alice.address)).to.be.revertedWithCustomError(
      vault,
      "OwnableUnauthorizedAccount",
    );
  });
});

describe("BitcoinXVault — bat bien an toan", () => {
  it("pause chi chan MINT, KHONG BAO GIO chan REDEEM", async () => {
    const { owner, alice, vault, btcb, btcx } = await loadFixture(deployFixture);
    await vault.connect(alice).mint(4n * ONE, alice.address);

    await expect(vault.connect(owner).setMintPaused(true)).to.emit(vault, "MintPausedSet").withArgs(true);
    await expect(vault.connect(alice).mint(ONE, alice.address)).to.be.revertedWithCustomError(vault, "MintIsPaused");

    // Duong thoat luon mo -> day la thu giu neo gia.
    const before = await btcb.balanceOf(alice.address);
    await vault.connect(alice).redeem(4n * ONE, alice.address);
    expect(await btcb.balanceOf(alice.address)).to.equal(before + 4n * ONE);
    expect(await btcx.totalSupply()).to.equal(0n);
  });

  it("owner khong the rut collateral qua sweep()", async () => {
    const { owner, alice, vault, btcb } = await loadFixture(deployFixture);
    await vault.connect(alice).mint(ONE, alice.address);

    await expect(
      vault.connect(owner).sweep(await btcb.getAddress(), owner.address),
    ).to.be.revertedWithCustomError(vault, "CollateralNotSweepable");
    expect(await btcb.balanceOf(await vault.getAddress())).to.equal(ONE);
  });

  it("sweep() thu hoi duoc token gui nham", async () => {
    const { owner, vault } = await loadFixture(deployFixture);
    const junk = await (await ethers.getContractFactory("MockERC20")).deploy("Junk", "JNK", 18);
    await junk.mint(await vault.getAddress(), 123n);

    await expect(vault.connect(owner).sweep(await junk.getAddress(), owner.address))
      .to.emit(vault, "Swept")
      .withArgs(await junk.getAddress(), owner.address, 123n);
    expect(await junk.balanceOf(owner.address)).to.equal(123n);
  });

  it("chan tan cong tai nhap (reentrancy) tu collateral doc hai", async () => {
    const [owner, alice, feeRecipient] = await ethers.getSigners();
    const evil = await (await ethers.getContractFactory("ReentrantCollateral")).deploy();
    const vault = await (await ethers.getContractFactory("BitcoinXVault")).deploy(
      await evil.getAddress(),
      feeRecipient.address,
      owner.address,
    );
    await evil.setVault(await vault.getAddress());

    await evil.mint(alice.address, 10n * ONE);
    await evil.connect(alice).approve(await vault.getAddress(), ethers.MaxUint256);
    await vault.connect(alice).mint(5n * ONE, alice.address);

    await evil.setAttack(true);
    await expect(vault.connect(alice).redeem(ONE, alice.address)).to.be.revertedWithCustomError(
      vault,
      "ReentrancyGuardReentrantCall",
    );
  });

  it("do so du thuc nhan nen collateral co thue chuyen khoan van giu du bao chung", async () => {
    const { owner, alice, vault, btcb, btcx } = await loadFixture(deployFixture);
    await btcb.setFeeBps(100); // 1% chay khi chuyen

    await vault.connect(alice).mint(10n * ONE, alice.address);

    const minted = await btcx.balanceOf(alice.address);
    const locked = await btcb.balanceOf(await vault.getAddress());
    expect(minted).to.equal(locked); // mint theo so THUC NHAN, khong theo so khai bao
    expect(minted).to.equal(10n * ONE - (10n * ONE) / 100n);
    expect(await vault.backingRatio()).to.equal(ONE);
  });

  it("giu bat bien backing >= supply qua chuoi thao tac ngau nhien", async () => {
    const { owner, alice, bob, vault, btcb, btcx } = await loadFixture(deployFixture);
    await vault.connect(owner).setFees(25, 40);
    const vaultAddr = await vault.getAddress();

    let seed = 42n;
    const rand = (max: bigint) => {
      seed = (seed * 6364136223846793005n + 1442695040888963407n) % (1n << 64n);
      return (seed % max) + 1n;
    };

    for (let i = 0; i < 60; i++) {
      const user = i % 2 === 0 ? alice : bob;
      if (i % 3 === 2) {
        const bal = await btcx.balanceOf(user.address);
        if (bal > 0n) await vault.connect(user).redeem(rand(bal), user.address);
      } else {
        await vault.connect(user).mint(rand(ONE), user.address);
      }
      expect(await btcb.balanceOf(vaultAddr)).to.be.gte(await btcx.totalSupply());
    }

    // Moi nguoi deu rut duoc het — khong co "bank run" nao lam vault vo no.
    for (const user of [alice, bob]) {
      const bal = await btcx.balanceOf(user.address);
      if (bal > 0n) await vault.connect(user).redeem(bal, user.address);
    }
    expect(await btcx.totalSupply()).to.equal(0n);
  });

  it("chuyen quyen so huu theo co che 2 buoc", async () => {
    const { owner, alice, vault } = await loadFixture(deployFixture);

    await vault.connect(owner).transferOwnership(alice.address);
    expect(await vault.owner()).to.equal(owner.address); // chua doi cho den khi duoc chap nhan
    await vault.connect(alice).acceptOwnership();
    expect(await vault.owner()).to.equal(alice.address);
  });
});

describe("BitcoinXVault — collateral khac 18 decimals", () => {
  async function deploy8Dec() {
    const [owner, alice, feeRecipient] = await ethers.getSigners();
    const wbtc = await (await ethers.getContractFactory("MockERC20")).deploy("Wrapped BTC", "WBTC", 8);
    const vault = await (await ethers.getContractFactory("BitcoinXVault")).deploy(
      await wbtc.getAddress(),
      feeRecipient.address,
      owner.address,
    );
    const btcx = await ethers.getContractAt("BitcoinX", await vault.btcx());
    await wbtc.mint(alice.address, 10n ** 10n);
    await wbtc.connect(alice).approve(await vault.getAddress(), ethers.MaxUint256);
    return { owner, alice, wbtc, vault, btcx };
  }

  it("quy doi dung he so scale 1e10", async () => {
    const { alice, wbtc, vault, btcx } = await loadFixture(deploy8Dec);

    expect(await vault.scale()).to.equal(10n ** 10n);
    await vault.connect(alice).mint(10n ** 8n, alice.address); // 1 WBTC
    expect(await btcx.balanceOf(alice.address)).to.equal(ONE);
    void wbtc;
  });

  it("phan le nho hon 1 don vi collateral khong bi nuot mat", async () => {
    const { alice, wbtc, vault, btcx } = await loadFixture(deploy8Dec);
    await vault.connect(alice).mint(10n ** 8n, alice.address);

    // 1.5 don vi collateral (tinh theo 18 decimals) -> chi rut duoc 1, con lai 0.5 giu nguyen
    const amount = 10n ** 10n + 5n * 10n ** 9n;
    const before = await wbtc.balanceOf(alice.address);
    await vault.connect(alice).redeem(amount, alice.address);

    expect(await wbtc.balanceOf(alice.address)).to.equal(before + 1n);
    expect(await btcx.balanceOf(alice.address)).to.equal(ONE - 10n ** 10n); // chi dot dung phan quy doi duoc
    expect(await vault.backingRatio()).to.be.gte(ONE);
  });

  it("tu choi collateral > 18 decimals", async () => {
    const [owner, , feeRecipient] = await ethers.getSigners();
    const weird = await (await ethers.getContractFactory("MockERC20")).deploy("Weird", "WRD", 24);
    const factory = await ethers.getContractFactory("BitcoinXVault");

    await expect(
      factory.deploy(await weird.getAddress(), feeRecipient.address, owner.address),
    ).to.be.revertedWithCustomError(factory, "UnsupportedCollateralDecimals");
  });
});
