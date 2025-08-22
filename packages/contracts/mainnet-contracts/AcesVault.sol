// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {FixedMath} from "./FixedMath.sol";

import "openzeppelin-contracts-upgradeable/contracts/access/OwnableUpgradeable.sol";
import "openzeppelin-contracts-upgradeable/contracts/proxy/utils/Initializable.sol";
import "openzeppelin-contracts-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";

import {Test, console2} from "forge-std/Test.sol";


interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function mint(address to, uint256 value) external;
    function balanceOf(address owner) external view returns (uint256);
}

/**
 * @title Aces Vault
 * @dev A contract for creating and managing rooms for trading keys with various curves.
 */
contract AcesVault is Initializable, OwnableUpgradeable, UUPSUpgradeable, Test {
    using FixedMath for int256;

    address public protocolFeeDestination;
    uint256 public protocolFeePercent;
    uint256 public subjectFeePercent;
    IERC20 public token;

    enum Curves {
        Quadratic,
        Linear,
        Sigmoid
    }

    struct Room {
        Curves curve;
        uint256 floor;
        int256 midPoint;
        uint256 maxPrice;
        uint256 steepness;
        uint256 sharesSupply;
        uint256 lockupPeriod;
        uint256 creationTime;
        mapping(address holder => uint256 balance) sharesBalance;
        mapping(address holder => uint256 lastBuyTime) lastBuyTime;
    }

    mapping(address subject => Room[] room) public rooms;
    mapping(address => mapping(address => bool)) private sellApprovals;

    event CreatedRoom(
        address subject,
        uint8 curve,
        uint256 roomNumber,
        uint256 steepness,
        uint256 floor,
        uint256 maxPrice,
        int256 midPoint
    );
    event Trade(
        address trader,
        address subject,
        uint256 roomNumber,
        bool isBuy,
        uint256 shareAmount,
        uint256 ethAmount,
        uint256 protocolEthAmount,
        uint256 subjectEthAmount,
        uint256 supply
    );
    event FeeDestinationChanged(address newDestination);
    event ProtocolFeePercentChanged(uint256 newPercent);
    event SubjectFeePercentChanged(uint256 newPercent);
    event Transfer(address indexed from, address indexed to, uint value);
    event SellApprovalChanged(
        address indexed seller,
        address indexed operator,
        bool approved
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract.
     * @param initialOwner The address to be set as the initial owner.
     */
    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);
        __UUPSUpgradeable_init();
    }

    /**
     * @dev Checks whether the upgrade is authorized.
     * @param newImplementation The address of the new implementation.
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    /**
     * @dev Creates a new room for trading shares with the specified bonding curve.
     * @param curve The curve type for price calculation.
     * @param steepness The steepness parameter for the curve.
     * @param floor The floor price for the shares.
     * @param maxPrice The maximum price for the shares.
     * @param midPoint The mid point of the sigmoid curve.
     * @return room The index of the created room.
     */
    function createRoom(
        Curves curve,
        uint256 steepness,
        uint256 floor,
        uint256 maxPrice,
        int256 midPoint,
        uint256 lockupPeriod
    ) public returns (uint256 room) {
        require(steepness >= 1, "Invalid steepness value");
        // require(steepness <= 10_000_000, "Invalid steepness value");
        Room storage r = rooms[msg.sender].push();
        r.curve = curve;
        r.steepness = steepness;
        r.sharesSupply = 1;
        r.floor = floor;
        r.midPoint = midPoint;
        r.maxPrice = maxPrice;
        r.lockupPeriod = lockupPeriod;
        r.creationTime = block.timestamp;
        r.sharesBalance[msg.sender] = 1;
        r.lastBuyTime[msg.sender] = block.timestamp;
        uint256 roomNumber = rooms[msg.sender].length - 1;
        emit CreatedRoom(
            msg.sender,
            uint8(curve),
            roomNumber,
            steepness,
            floor,
            maxPrice,
            midPoint
        );
        return roomNumber;
    }

    /**
     * @dev Sets the address where protocol fees will be sent.
     * @param feeDestination The address to set as the fee destination.
     */
    function setFeeDestination(address feeDestination) public onlyOwner {
        require(feeDestination != address(0), "Invalid address");
        protocolFeeDestination = feeDestination;
        emit FeeDestinationChanged(feeDestination);
    }

    /**
     * @dev Sets the percentage of protocol fees.
     * @param feePercent The percentage of protocol fees to set.
     */
    function setProtocolFeePercent(uint256 feePercent) public onlyOwner {
        require(feePercent <= 500000000000000000, "Invalid fee percent"); // max 50%
        protocolFeePercent = feePercent;
        emit ProtocolFeePercentChanged(feePercent);
    }

    /**
     * @dev Sets the percentage of subject fees.
     * @param feePercent The percentage of subject fees to set.
     */
    function setSubjectFeePercent(uint256 feePercent) public onlyOwner {
        require(feePercent <= 500000000000000000, "Invalid fee percent"); // max 50%
        subjectFeePercent = feePercent;
        emit SubjectFeePercentChanged(feePercent);
    }

    /**
     * @dev Sets the token address for the contract. Only callable by the owner.
     * @param newToken The address of the new token.
     */
    function setTokenAddress(address newToken) public onlyOwner {
        require(newToken != address(0), "Invalid token address");
        token = IERC20(newToken);
    }

    function withdrawETH() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    /**
     * @dev Gets the number of rooms for a given shares subject.
     * @param sharesSubject The address of the shares subject.
     * @return The number of rooms.
     */
    function getRoomsLength(
        address sharesSubject
    ) public view returns (uint256) {
        return rooms[sharesSubject].length;
    }

    /**
     * @dev Gets the total supply of shares for a given room.
     * @param sharesSubject The address of the shares subject.
     * @param roomNumber The index of the room.
     * @return The total supply of shares.
     */
    function getTokenSupply(
        address sharesSubject,
        uint256 roomNumber
    ) public view returns (uint256) {
        return rooms[sharesSubject][roomNumber].sharesSupply;
    }

    /**
     * @dev Gets the balance of shares for a given holder in a specific room.
     * @param sharesSubject The address of the shares subject.
     * @param roomNumber The index of the room.
     * @param holder The address of the shares holder.
     * @return The balance of shares.
     */
    function getTokenBalance(
        address sharesSubject,
        uint256 roomNumber,
        address holder
    ) public view returns (uint256) {
        return rooms[sharesSubject][roomNumber].sharesBalance[holder];
    }

    /**
     * @dev Calculates the price for a Sigmoid curve given the supply, amount, and curve parameters.
     * @param supply The current supply of shares.
     * @param amount The amount of shares to buy.
     * @param steepness The steepness parameter for the curve.
     * @param floor The floor price for the shares.
     * @param maxPrice The maximum price for the shares.
     * @param midPoint The mid point of the sigmoid curve.
     * @return price The total price for the shares.
     */
    function getPriceSigmoid(
        uint256 supply,
        uint256 amount,
        uint256 steepness,
        uint256 floor,
        uint256 maxPrice,
        int256 midPoint
    ) public pure returns (uint256 price) {
        int256 numerator = int256(supply + amount) - midPoint;
        int256 innerSqrt = (int256(steepness / 100) + (numerator) ** 2);
        int256 fixedInner = innerSqrt.toFixed();
        int256 fixedDenominator = fixedInner.sqrt();
        int256 fixedNumerator = numerator.toFixed();
        int256 midVal = fixedNumerator.divide(fixedDenominator) +
            FixedMath.fixed1();
        int256 fixedFinal = ((int256(maxPrice) * 1_000_000) / 2) * midVal;
        int256 finalVal = fixedFinal / 1_000_000_000_000 ether;
        return uint256(finalVal) + (floor * amount);
    }

    /**
     * @dev Calculates the price for a quadratic curve given the supply, amount, steepness, and floor price.
     * @param supply The current supply of shares.
     * @param amount The amount of shares to buy.
     * @param steepness The steepness parameter for the curve.
     * @param floor The floor price for the shares.
     * @return price The total price for the shares.
     */
    function getPriceQuadratic(
        uint256 supply,
        uint256 amount,
        uint256 steepness,
        uint256 floor
    ) public pure returns (uint256 price) {
        uint256 sum1 = ((supply - 1) * (supply) * (2 * (supply - 1) + 1)) / 6;
        uint256 sum2 = ((supply - 1 + amount) *
            (supply + amount) *
            (2 * (supply - 1 + amount) + 1)) / 6;
        uint256 summation = sum2 - sum1;
        return (summation * 1 ether) / steepness + (floor * amount);
    }

    /**
     * @dev Calculates the price for a linear curve given the supply, amount, steepness, and floor price.
     * @param supply The current supply of shares.
     * @param amount The amount of shares to buy.
     * @param steepness The steepness parameter for the curve.
     * @param floor The floor price for the shares.
     * @return price The total price for the shares.
     */
    function getPriceLinear(
        uint256 supply,
        uint256 amount,
        uint256 steepness,
        uint256 floor
    ) public pure returns (uint256 price) {
        uint256 sum1 = (supply - 1) * supply;
        uint256 sum2 = (supply - 1 + amount) * (supply + amount);
        uint256 summation = sum2 - sum1;
        return (summation * 1 ether) / (steepness / 50) + (floor * amount);
    }

    /**
     * @dev Calculates the price for buying or selling shares based on the specified parameters.
     * @param sharesSubject The address of the shares subject.
     * @param roomNumber The index of the room.
     * @param amount The amount of shares to buy or sell.
     * @param isBuy A boolean indicating whether the transaction is a buy or sell.
     * @return price The calculated price for the shares.
     */
    function getPrice(
        address sharesSubject,
        uint256 roomNumber,
        uint256 amount,
        bool isBuy
    ) public view returns (uint256 price) {
        Room storage r = rooms[sharesSubject][roomNumber];
        uint256 supply = isBuy ? r.sharesSupply : r.sharesSupply - amount;
        uint256 floor = r.floor;
        uint256 steepness = r.steepness;
        if (rooms[sharesSubject][roomNumber].curve == Curves.Quadratic) {
            return getPriceQuadratic(supply, amount, steepness, floor);
        } else if (rooms[sharesSubject][roomNumber].curve == Curves.Linear) {
            return getPriceLinear(supply, amount, steepness, floor);
        } else if (rooms[sharesSubject][roomNumber].curve == Curves.Sigmoid) {
            int256 midPoint = r.midPoint;
            uint256 maxPrice = r.maxPrice;
            return
                getPriceSigmoid(
                    supply,
                    amount,
                    steepness,
                    floor,
                    maxPrice,
                    midPoint
                );
        }
    }

    /**
     * @dev Calculates the buy price for shares based on the specified parameters.
     * @param sharesSubject The address of the shares subject.
     * @param roomNumber The index of the room.
     * @param amount The amount of shares to buy.
     * @return price The calculated buy price for the shares.
     */
    function getBuyPrice(
        address sharesSubject,
        uint256 roomNumber,
        uint256 amount
    ) public view returns (uint256 price) {
        return getPrice(sharesSubject, roomNumber, amount, true);
    }

    /**
     * @dev Calculates the sell price for shares based on the specified parameters.
     * @param sharesSubject The address of the shares subject.
     * @param roomNumber The index of the room.
     * @param amount The amount of shares to sell.
     * @return price The calculated sell price for the shares.
     */
    function getSellPrice(
        address sharesSubject,
        uint256 roomNumber,
        uint256 amount
    ) public view returns (uint256 price) {
        return getPrice(sharesSubject, roomNumber, amount, false);
    }

    /**
     * @dev Calculates the buy price for shares after applying protocol and subject fees.
     * @param sharesSubject The address of the shares subject.
     * @param roomNumber The index of the room.
     * @param amount The amount of shares to buy.
     * @return price The calculated buy price for the shares after fees.
     */
    function getBuyPriceAfterFee(
        address sharesSubject,
        uint256 roomNumber,
        uint256 amount
    ) public view returns (uint256 price) {
        uint256 buyPrice = getBuyPrice(sharesSubject, roomNumber, amount);
        uint256 protocolFee = (buyPrice * protocolFeePercent) / 1 ether;
        uint256 subjectFee = (buyPrice * subjectFeePercent) / 1 ether;
        return buyPrice + protocolFee + subjectFee;
    }

    /**
     * @dev Calculates the sell price for shares after applying protocol and subject fees.
     * @param sharesSubject The address of the shares subject.
     * @param roomNumber The index of the room.
     * @param amount The amount of shares to sell.
     * @return price The calculated sell price for the shares after fees.
     */
    function getSellPriceAfterFee(
        address sharesSubject,
        uint256 roomNumber,
        uint256 amount
    ) public view returns (uint256 price) {
        uint256 sellPrice = getSellPrice(sharesSubject, roomNumber, amount);
        uint256 protocolFee = (sellPrice * protocolFeePercent) / 1 ether;
        uint256 subjectFee = (sellPrice * subjectFeePercent) / 1 ether;
        return sellPrice - protocolFee - subjectFee;
    }

    /**
     * @dev Allows a user to buy shares.
     * @param sharesSubject The address of the shares subject.
     * @param roomNumber The index of the room.
     * @param amount The amount of shares to buy.
     */
    function buyShares(
        address sharesSubject,
        uint256 roomNumber,
        uint256 amount
    ) public payable {
        require(amount > 0, "Invalid amount");
        require(
            rooms[sharesSubject][roomNumber].sharesSupply > 0,
            "Invalid room"
        );
        require(sharesSubject != address(0), "Invalid address");
        require(address(token) != address(0), "Token not set");

        Room storage room = rooms[sharesSubject][roomNumber];
        uint256 supply = room.sharesSupply;
        uint256 price = getPrice(sharesSubject, roomNumber, amount, true);

        uint256 protocolFee = (price * protocolFeePercent) / 1 ether;
        uint256 subjectFee = (price * subjectFeePercent) / 1 ether;

        require(
            msg.value >= price + protocolFee + subjectFee,
            "Insufficient payment"
        );

        room.sharesBalance[msg.sender] =
            room.sharesBalance[msg.sender] +
            amount;
        room.sharesSupply = supply + amount;
        room.lastBuyTime[msg.sender] = block.timestamp;

        // Mint tokens to user
        token.mint(msg.sender, amount * 1 ether);
        uint256 balance = token.balanceOf(msg.sender);
        require(balance >= amount * 1 ether, "Insufficient token balance");

        emit Trade(
            msg.sender,
            sharesSubject,
            roomNumber,
            true,
            amount,
            price,
            protocolFee,
            subjectFee,
            supply + amount
        );

        if (protocolFee > 0) {
            (bool success1, ) = protocolFeeDestination.call{value: protocolFee}(
                ""
            );
            require(success1, "Unable to send funds");
        }

        if (subjectFee > 0) {
            (bool success2, ) = sharesSubject.call{value: subjectFee}("");
            require(success2, "Unable to send funds");
        }

        if (msg.value > price + protocolFee + subjectFee) {
            (bool success3, ) = msg.sender.call{
                value: msg.value - price - protocolFee - subjectFee
            }("");
            require(success3, "Unable to send funds");
        }
    }


    /**
     * @dev Allows a user to buy shares for another user.
     * @param buyer The address of the buyer.
     * @param sharesSubject The address of the shares subject.
     * @param roomNumber The index of the room.
     * @param amount The amount of shares to buy.
     */
    function buySharesFor(
        address buyer,
        address sharesSubject,
        uint256 roomNumber,
        uint256 amount
    ) public payable {
        require(amount > 0, "Invalid amount");
        require(
            rooms[sharesSubject][roomNumber].sharesSupply > 0,
            "Invalid room"
        );
        require(sharesSubject != address(0), "Invalid address");
        require(buyer != address(0), "Invalid buyer address");

        Room storage room = rooms[sharesSubject][roomNumber];
        uint256 supply = room.sharesSupply;
        uint256 price = getPrice(sharesSubject, roomNumber, amount, true);

        uint256 protocolFee = (price * protocolFeePercent) / 1 ether;
        uint256 subjectFee = (price * subjectFeePercent) / 1 ether;

        require(
            msg.value >= price + protocolFee + subjectFee,
            "Insufficient payment"
        );

        room.sharesBalance[buyer] = room.sharesBalance[buyer] + amount;
        room.sharesSupply = supply + amount;
        room.lastBuyTime[buyer] = block.timestamp;

        // Mint tokens to user
        token.mint(buyer, amount * 1 ether);
        uint256 balance = token.balanceOf(buyer);
        require(balance >= amount * 1 ether, "Insufficient token balance");

        emit Trade(
            buyer,
            sharesSubject,
            roomNumber,
            true,
            amount,
            price,
            protocolFee,
            subjectFee,
            supply + amount
        );

        if (protocolFee > 0) {
            (bool success1, ) = protocolFeeDestination.call{value: protocolFee}(
                ""
            );
            require(success1, "Unable to send funds");
        }
        if (subjectFee > 0) {
            (bool success2, ) = sharesSubject.call{value: subjectFee}("");
            require(success2, "Unable to send funds");
        }

        if (msg.value > price + protocolFee + subjectFee) {
            (bool success3, ) = msg.sender.call{
                value: msg.value - price - protocolFee - subjectFee
            }("");
            require(success3, "Unable to send funds");
        }
    } // NEW


}