const { expect } = require("chai")
const { ethers } = require('hardhat');

const NAME = "TokenMaster"
const SYMBOL = "TM"

const OCCASION_NAME = "ETH Texas"
const OCCASION_COST = ethers.utils.parseUnits('10', 'ether')
const OCCASION_MAX_TICKETS = 100
const OCCASION_DATE = "Apr 27"
const OCCASION_TIME = "10:00AM CST"
const OCCASION_LOCATION = "Austin, Texas"

describe("TokenMaster", () => {
  let tokenMaster
  let deployer, buyer, buyer2

  beforeEach(async () => {
    // Setup accounts
    [deployer, buyer, buyer2, buyer3, buyer4, notOwner] = await ethers.getSigners()

    // Deploy contract
    const TokenMaster = await ethers.getContractFactory("TokenMaster")
    tokenMaster = await TokenMaster.deploy(NAME, SYMBOL)

    const transaction = await tokenMaster.connect(deployer).list(
      OCCASION_NAME,
      OCCASION_COST,
      OCCASION_MAX_TICKETS,
      OCCASION_DATE,
      OCCASION_TIME,
      OCCASION_LOCATION
    )

    await transaction.wait()
  })

  describe("Deployment", () => {
    it("Sets the name", async () => {
      expect(await tokenMaster.name()).to.equal(NAME)
    })

    it("Sets the symbol", async () => {
      expect(await tokenMaster.symbol()).to.equal(SYMBOL)
    })

    it("Sets the owner", async () => {
      expect(await tokenMaster.owner()).to.equal(deployer.address)
    })
  })

  describe("Occasions", () => {
    it('Returns occasions attributes', async () => {
      const occasion = await tokenMaster.getOccasion(1)
      expect(occasion.id).to.be.equal(1)
      expect(occasion.name).to.be.equal(OCCASION_NAME)
      expect(occasion.cost).to.be.equal(OCCASION_COST)
      expect(occasion.tickets).to.be.equal(OCCASION_MAX_TICKETS)
      expect(occasion.date).to.be.equal(OCCASION_DATE)
      expect(occasion.time).to.be.equal(OCCASION_TIME)
      expect(occasion.location).to.be.equal(OCCASION_LOCATION)
    })

    it('Updates occasions count', async () => {
      const totalOccasions = await tokenMaster.totalOccasions()
      expect(totalOccasions).to.be.equal(1)
    })
  })

  describe("Minting", () => {
    const ID = 1
    const SEAT = 50
    const AMOUNT = ethers.utils.parseUnits('10', 'ether')


    describe('Success', () => {
      beforeEach(async () => {
        const transaction = await tokenMaster.connect(buyer).mint(ID, SEAT, { value: AMOUNT })
        await transaction.wait()
      })

      it('Updates ticket count', async () => {
        const occasion = await tokenMaster.getOccasion(1)
        expect(occasion.tickets).to.be.equal(OCCASION_MAX_TICKETS - 1)
      })

      it('Updates buying status', async () => {
        const status = await tokenMaster.hasBought(ID, buyer.address)
        expect(status).to.be.equal(true)
      })

      it('Updates seat status', async () => {
        const owner = await tokenMaster.seatTaken(ID, SEAT)
        expect(owner).to.equal(buyer.address)
      })

      it('Updates overall seating status', async () => {
        const seats = await tokenMaster.getSeatsTaken(ID)
        expect(seats.length).to.equal(1)
        expect(seats[0]).to.equal(SEAT)
      })

      it('Updates the contract balance', async () => {
        const balance = await ethers.provider.getBalance(tokenMaster.address)
        expect(balance).to.be.equal(AMOUNT)
      })
    })

    describe('Failure', () => {
      it('Rejects incorrect occasion ID', async () => {
        const incorrectID = 2
        await expect(tokenMaster.connect(buyer).mint(incorrectID, SEAT, { value: AMOUNT })).to.be.reverted
      })

      it('Should fail if the _id is 0', async () => {
        const ID = 0
        await expect(tokenMaster.connect(buyer).mint(ID, SEAT, { value: AMOUNT })).to.be.reverted
      })

      it('Rejects invalid seat', async () => {
        const SEAT = 101
        await expect(tokenMaster.connect(buyer).mint(ID, 101, { value: AMOUNT })).to.be.reverted
      })

      it('User doesnt have enough ETH', async () => {
        const AMOUNT = ethers.utils.parseUnits('5', 'ether')
        await expect(tokenMaster.connect(buyer).mint(ID, SEAT, { value: AMOUNT })).to.be.reverted
      })

      it('Rejects a seat thats already taken', async () => {
        const transaction = await tokenMaster.connect(buyer).mint(ID, SEAT, { value: AMOUNT })
        await transaction.wait()
        await expect(tokenMaster.connect(buyer2).mint(ID, SEAT, { value: AMOUNT })).to.be.revertedWith("Seat already taken")
        await transaction.wait()
      })
    })
  })

  describe("Withdrawing", () => {
    const ID = 1
    const SEAT = 50
    const AMOUNT = ethers.utils.parseUnits("10", 'ether')
    let balanceBefore

    beforeEach(async () => {
      balanceBefore = await ethers.provider.getBalance(deployer.address)

      let transaction = await tokenMaster.connect(buyer).mint(ID, SEAT, { value: AMOUNT })
      await transaction.wait()

      transaction = await tokenMaster.connect(deployer).withdraw()
      await transaction.wait()
    })

    describe('Success', () => {
      it('Updates the owner balance', async () => {
        const balanceAfter = await ethers.provider.getBalance(deployer.address)
        expect(balanceAfter).to.be.greaterThan(balanceBefore)
      })

      it('Updates the contract balance', async () => {
        const balance = await ethers.provider.getBalance(tokenMaster.address)
        expect(balance).to.equal(0)
      })
    })

    describe('Failure', () => {
      it('User other than the owner tries to withdraw', async () => {
        await expect(tokenMaster.connect(buyer).withdraw()).to.be.reverted
      })

      it("Reverts if contract balance is zero", async () => {
        await expect(tokenMaster.connect(deployer).withdraw()).to.be.revertedWith("Nothing to withdraw");
      })
    })
  })

  describe("Whitelisting addresses", () => {
    it('Only the owner can add whitelisted addresses', async () => {
      const addAddress = [buyer.address, buyer2.address, buyer3.address]
      await tokenMaster.addToWhitelist(addAddress)

      for (const address of addAddress) {
        expect(await tokenMaster.whitelist(address)).to.equal(true)
      }
    })
  })

  describe("Removing Whitelisted Addresses", () => {
    it('Only the owner can remove whitelisted addresses', async () => {
      const removeAddress = [buyer.address, buyer2.address, buyer3.address]
      await tokenMaster.removeFromWhitelist(removeAddress)
    })
  })
})
