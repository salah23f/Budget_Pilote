// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract BudgetPilotReceipt {
    struct Booking {
        address user;
        string offerId;
        uint256 priceUsd;
        string bookingRef;
        uint256 createdAt;
    }

    mapping(bytes32 => Booking) public bookings;

    event MissionCreated(bytes32 indexed missionHash, address indexed user, uint256 budgetUsd);
    event BookingExecuted(bytes32 indexed missionHash, string offerId, uint256 priceUsd, string bookingRef);
    event ReceiptIssued(bytes32 indexed missionHash, string receiptCidOrHash);

    function createMission(bytes32 missionHash, uint256 budgetUsd) external {
        emit MissionCreated(missionHash, msg.sender, budgetUsd);
    }

    function executeBooking(
        bytes32 missionHash,
        string calldata offerId,
        uint256 priceUsd,
        string calldata bookingRef,
        string calldata receiptCidOrHash
    ) external {
        bookings[missionHash] = Booking({
            user: msg.sender,
            offerId: offerId,
            priceUsd: priceUsd,
            bookingRef: bookingRef,
            createdAt: block.timestamp
        });

        emit BookingExecuted(missionHash, offerId, priceUsd, bookingRef);
        emit ReceiptIssued(missionHash, receiptCidOrHash);
    }
}
