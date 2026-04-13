import {
  BookingExecuted as BookingExecutedEvent,
  MissionCreated as MissionCreatedEvent,
  ReceiptIssued as ReceiptIssuedEvent,
} from '../generated/SkyvoyReceipt/SkyvoyReceipt';
import { BookingExecuted, MissionCreated, ReceiptIssued } from '../generated/schema';

export function handleMissionCreated(event: MissionCreatedEvent): void {
  let entity = new MissionCreated(event.transaction.hash.concatI32(event.logIndex.toI32()));
  entity.missionHash = event.params.missionHash;
  entity.user = event.params.user;
  entity.budgetUsd = event.params.budgetUsd;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}

export function handleBookingExecuted(event: BookingExecutedEvent): void {
  let entity = new BookingExecuted(event.transaction.hash.concatI32(event.logIndex.toI32()));
  entity.missionHash = event.params.missionHash;
  entity.offerId = event.params.offerId;
  entity.priceUsd = event.params.priceUsd;
  entity.bookingRef = event.params.bookingRef;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}

export function handleReceiptIssued(event: ReceiptIssuedEvent): void {
  let entity = new ReceiptIssued(event.transaction.hash.concatI32(event.logIndex.toI32()));
  entity.missionHash = event.params.missionHash;
  entity.receiptCidOrHash = event.params.receiptCidOrHash;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}
