import {
  AgreementSigned as AgreementSignedEvent,
  EmergencyToggled as EmergencyToggledEvent,
  EnergyCreditRateUpdated as EnergyCreditRateUpdatedEvent,
  EnergyCreditsClaimed as EnergyCreditsClaimedEvent,
  EnergyCreditsVerified as EnergyCreditsVerifiedEvent,
  EnergyProviderSet as EnergyProviderSetEvent,
  EnergyTokensBurned as EnergyTokensBurnedEvent,
  EnergyTokensClaimed as EnergyTokensClaimedEvent,
  EnergyTokensReleased as EnergyTokensReleasedEvent,
  ExtraFundRequestApproved as ExtraFundRequestApprovedEvent,
  ExtraFundRequestCreated as ExtraFundRequestCreatedEvent,
  ExtraFundRequestExecuted as ExtraFundRequestExecutedEvent,
  ExtraFundRequestRejected as ExtraFundRequestRejectedEvent,
  ExtraFundVoteCast as ExtraFundVoteCastEvent,
  FinalMilestoneAchieved as FinalMilestoneAchievedEvent,
  FundingFailed as FundingFailedEvent,
  FundingSuccessful as FundingSuccessfulEvent,
  FundsWithdrawn as FundsWithdrawnEvent,
  InvestmentReceived as InvestmentReceivedEvent,
  MilestoneVerified as MilestoneVerifiedEvent,
  OwnershipTransferred as OwnershipTransferredEvent,
  PlatformFeeWithdrawn as PlatformFeeWithdrawnEvent,
  RefundClaimed as RefundClaimedEvent,
  SecurityTokensWithdrawn as SecurityTokensWithdrawnEvent,
  TokensPledged as TokensPledgedEvent
} from "../generated/CrowdFunding/CrowdFunding"
import {
  AgreementSigned,
  EmergencyToggled,
  EnergyCreditRateUpdated,
  EnergyCreditsClaimed,
  EnergyCreditsVerified,
  EnergyProviderSet,
  EnergyTokensBurned,
  EnergyTokensClaimed,
  EnergyTokensReleased,
  ExtraFundRequestApproved,
  ExtraFundRequestCreated,
  ExtraFundRequestExecuted,
  ExtraFundRequestRejected,
  ExtraFundVoteCast,
  FinalMilestoneAchieved,
  FundingFailed,
  FundingSuccessful,
  FundsWithdrawn,
  InvestmentReceived,
  MilestoneVerified,
  OwnershipTransferred,
  PlatformFeeWithdrawn,
  RefundClaimed,
  SecurityTokensWithdrawn,
  TokensPledged
} from "../generated/schema"

export function handleAgreementSigned(event: AgreementSignedEvent): void {
  let entity = new AgreementSigned(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.generalContractor = event.params.generalContractor

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleEmergencyToggled(event: EmergencyToggledEvent): void {
  let entity = new EmergencyToggled(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.stopped = event.params.stopped

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleEnergyCreditRateUpdated(
  event: EnergyCreditRateUpdatedEvent
): void {
  let entity = new EnergyCreditRateUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.newRate = event.params.newRate

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleEnergyCreditsClaimed(
  event: EnergyCreditsClaimedEvent
): void {
  let entity = new EnergyCreditsClaimed(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.investor = event.params.investor
  entity.credits = event.params.credits

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleEnergyCreditsVerified(
  event: EnergyCreditsVerifiedEvent
): void {
  let entity = new EnergyCreditsVerified(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.investor = event.params.investor
  entity.creditsEarned = event.params.creditsEarned

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleEnergyProviderSet(event: EnergyProviderSetEvent): void {
  let entity = new EnergyProviderSet(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.provider = event.params.provider

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleEnergyTokensBurned(event: EnergyTokensBurnedEvent): void {
  let entity = new EnergyTokensBurned(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.investor = event.params.investor
  entity.amount = event.params.amount

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleEnergyTokensClaimed(
  event: EnergyTokensClaimedEvent
): void {
  let entity = new EnergyTokensClaimed(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.investor = event.params.investor
  entity.amount = event.params.amount

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleEnergyTokensReleased(
  event: EnergyTokensReleasedEvent
): void {
  let entity = new EnergyTokensReleased(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleExtraFundRequestApproved(
  event: ExtraFundRequestApprovedEvent
): void {
  let entity = new ExtraFundRequestApproved(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.requestId = event.params.requestId
  entity.votingDuration = event.params.votingDuration

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleExtraFundRequestCreated(
  event: ExtraFundRequestCreatedEvent
): void {
  let entity = new ExtraFundRequestCreated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.requestId = event.params.requestId
  entity.proposalHash = event.params.proposalHash
  entity.amount = event.params.amount
  entity.description = event.params.description

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleExtraFundRequestExecuted(
  event: ExtraFundRequestExecutedEvent
): void {
  let entity = new ExtraFundRequestExecuted(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.requestId = event.params.requestId
  entity.approved = event.params.approved

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleExtraFundRequestRejected(
  event: ExtraFundRequestRejectedEvent
): void {
  let entity = new ExtraFundRequestRejected(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.requestId = event.params.requestId

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleExtraFundVoteCast(event: ExtraFundVoteCastEvent): void {
  let entity = new ExtraFundVoteCast(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.requestId = event.params.requestId
  entity.voter = event.params.voter
  entity.support = event.params.support
  entity.stake = event.params.stake

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleFinalMilestoneAchieved(
  event: FinalMilestoneAchievedEvent
): void {
  let entity = new FinalMilestoneAchieved(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleFundingFailed(event: FundingFailedEvent): void {
  let entity = new FundingFailed(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleFundingSuccessful(event: FundingSuccessfulEvent): void {
  let entity = new FundingSuccessful(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleFundsWithdrawn(event: FundsWithdrawnEvent): void {
  let entity = new FundsWithdrawn(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.milestoneIndex = event.params.milestoneIndex
  entity.amount = event.params.amount

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleInvestmentReceived(event: InvestmentReceivedEvent): void {
  let entity = new InvestmentReceived(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.investor = event.params.investor
  entity.amount = event.params.amount

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleMilestoneVerified(event: MilestoneVerifiedEvent): void {
  let entity = new MilestoneVerified(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.milestoneIndex = event.params.milestoneIndex

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent
): void {
  let entity = new OwnershipTransferred(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.previousOwner = event.params.previousOwner
  entity.newOwner = event.params.newOwner

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handlePlatformFeeWithdrawn(
  event: PlatformFeeWithdrawnEvent
): void {
  let entity = new PlatformFeeWithdrawn(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.amount = event.params.amount

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleRefundClaimed(event: RefundClaimedEvent): void {
  let entity = new RefundClaimed(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.investor = event.params.investor
  entity.amount = event.params.amount

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleSecurityTokensWithdrawn(
  event: SecurityTokensWithdrawnEvent
): void {
  let entity = new SecurityTokensWithdrawn(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.generalContractor = event.params.generalContractor
  entity.amount = event.params.amount

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleTokensPledged(event: TokensPledgedEvent): void {
  let entity = new TokensPledged(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.pledger = event.params.pledger
  entity.amount = event.params.amount

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}
