import { newMockEvent } from "matchstick-as"
import { ethereum, Address, BigInt, Bytes } from "@graphprotocol/graph-ts"
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
} from "../generated/CrowdFunding/CrowdFunding"

export function createAgreementSignedEvent(
  generalContractor: Address
): AgreementSigned {
  let agreementSignedEvent = changetype<AgreementSigned>(newMockEvent())

  agreementSignedEvent.parameters = new Array()

  agreementSignedEvent.parameters.push(
    new ethereum.EventParam(
      "generalContractor",
      ethereum.Value.fromAddress(generalContractor)
    )
  )

  return agreementSignedEvent
}

export function createEmergencyToggledEvent(
  stopped: boolean
): EmergencyToggled {
  let emergencyToggledEvent = changetype<EmergencyToggled>(newMockEvent())

  emergencyToggledEvent.parameters = new Array()

  emergencyToggledEvent.parameters.push(
    new ethereum.EventParam("stopped", ethereum.Value.fromBoolean(stopped))
  )

  return emergencyToggledEvent
}

export function createEnergyCreditRateUpdatedEvent(
  newRate: BigInt
): EnergyCreditRateUpdated {
  let energyCreditRateUpdatedEvent =
    changetype<EnergyCreditRateUpdated>(newMockEvent())

  energyCreditRateUpdatedEvent.parameters = new Array()

  energyCreditRateUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "newRate",
      ethereum.Value.fromUnsignedBigInt(newRate)
    )
  )

  return energyCreditRateUpdatedEvent
}

export function createEnergyCreditsClaimedEvent(
  investor: Address,
  credits: BigInt
): EnergyCreditsClaimed {
  let energyCreditsClaimedEvent =
    changetype<EnergyCreditsClaimed>(newMockEvent())

  energyCreditsClaimedEvent.parameters = new Array()

  energyCreditsClaimedEvent.parameters.push(
    new ethereum.EventParam("investor", ethereum.Value.fromAddress(investor))
  )
  energyCreditsClaimedEvent.parameters.push(
    new ethereum.EventParam(
      "credits",
      ethereum.Value.fromUnsignedBigInt(credits)
    )
  )

  return energyCreditsClaimedEvent
}

export function createEnergyCreditsVerifiedEvent(
  investor: Address,
  creditsEarned: BigInt
): EnergyCreditsVerified {
  let energyCreditsVerifiedEvent =
    changetype<EnergyCreditsVerified>(newMockEvent())

  energyCreditsVerifiedEvent.parameters = new Array()

  energyCreditsVerifiedEvent.parameters.push(
    new ethereum.EventParam("investor", ethereum.Value.fromAddress(investor))
  )
  energyCreditsVerifiedEvent.parameters.push(
    new ethereum.EventParam(
      "creditsEarned",
      ethereum.Value.fromUnsignedBigInt(creditsEarned)
    )
  )

  return energyCreditsVerifiedEvent
}

export function createEnergyProviderSetEvent(
  provider: Address
): EnergyProviderSet {
  let energyProviderSetEvent = changetype<EnergyProviderSet>(newMockEvent())

  energyProviderSetEvent.parameters = new Array()

  energyProviderSetEvent.parameters.push(
    new ethereum.EventParam("provider", ethereum.Value.fromAddress(provider))
  )

  return energyProviderSetEvent
}

export function createEnergyTokensBurnedEvent(
  investor: Address,
  amount: BigInt
): EnergyTokensBurned {
  let energyTokensBurnedEvent = changetype<EnergyTokensBurned>(newMockEvent())

  energyTokensBurnedEvent.parameters = new Array()

  energyTokensBurnedEvent.parameters.push(
    new ethereum.EventParam("investor", ethereum.Value.fromAddress(investor))
  )
  energyTokensBurnedEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )

  return energyTokensBurnedEvent
}

export function createEnergyTokensClaimedEvent(
  investor: Address,
  amount: BigInt
): EnergyTokensClaimed {
  let energyTokensClaimedEvent = changetype<EnergyTokensClaimed>(newMockEvent())

  energyTokensClaimedEvent.parameters = new Array()

  energyTokensClaimedEvent.parameters.push(
    new ethereum.EventParam("investor", ethereum.Value.fromAddress(investor))
  )
  energyTokensClaimedEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )

  return energyTokensClaimedEvent
}

export function createEnergyTokensReleasedEvent(): EnergyTokensReleased {
  let energyTokensReleasedEvent =
    changetype<EnergyTokensReleased>(newMockEvent())

  energyTokensReleasedEvent.parameters = new Array()

  return energyTokensReleasedEvent
}

export function createExtraFundRequestApprovedEvent(
  requestId: BigInt,
  votingDuration: BigInt
): ExtraFundRequestApproved {
  let extraFundRequestApprovedEvent =
    changetype<ExtraFundRequestApproved>(newMockEvent())

  extraFundRequestApprovedEvent.parameters = new Array()

  extraFundRequestApprovedEvent.parameters.push(
    new ethereum.EventParam(
      "requestId",
      ethereum.Value.fromUnsignedBigInt(requestId)
    )
  )
  extraFundRequestApprovedEvent.parameters.push(
    new ethereum.EventParam(
      "votingDuration",
      ethereum.Value.fromUnsignedBigInt(votingDuration)
    )
  )

  return extraFundRequestApprovedEvent
}

export function createExtraFundRequestCreatedEvent(
  requestId: BigInt,
  proposalHash: Bytes,
  amount: BigInt,
  description: string
): ExtraFundRequestCreated {
  let extraFundRequestCreatedEvent =
    changetype<ExtraFundRequestCreated>(newMockEvent())

  extraFundRequestCreatedEvent.parameters = new Array()

  extraFundRequestCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "requestId",
      ethereum.Value.fromUnsignedBigInt(requestId)
    )
  )
  extraFundRequestCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "proposalHash",
      ethereum.Value.fromFixedBytes(proposalHash)
    )
  )
  extraFundRequestCreatedEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )
  extraFundRequestCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "description",
      ethereum.Value.fromString(description)
    )
  )

  return extraFundRequestCreatedEvent
}

export function createExtraFundRequestExecutedEvent(
  requestId: BigInt,
  approved: boolean
): ExtraFundRequestExecuted {
  let extraFundRequestExecutedEvent =
    changetype<ExtraFundRequestExecuted>(newMockEvent())

  extraFundRequestExecutedEvent.parameters = new Array()

  extraFundRequestExecutedEvent.parameters.push(
    new ethereum.EventParam(
      "requestId",
      ethereum.Value.fromUnsignedBigInt(requestId)
    )
  )
  extraFundRequestExecutedEvent.parameters.push(
    new ethereum.EventParam("approved", ethereum.Value.fromBoolean(approved))
  )

  return extraFundRequestExecutedEvent
}

export function createExtraFundRequestRejectedEvent(
  requestId: BigInt
): ExtraFundRequestRejected {
  let extraFundRequestRejectedEvent =
    changetype<ExtraFundRequestRejected>(newMockEvent())

  extraFundRequestRejectedEvent.parameters = new Array()

  extraFundRequestRejectedEvent.parameters.push(
    new ethereum.EventParam(
      "requestId",
      ethereum.Value.fromUnsignedBigInt(requestId)
    )
  )

  return extraFundRequestRejectedEvent
}

export function createExtraFundVoteCastEvent(
  requestId: BigInt,
  voter: Address,
  support: boolean,
  stake: BigInt
): ExtraFundVoteCast {
  let extraFundVoteCastEvent = changetype<ExtraFundVoteCast>(newMockEvent())

  extraFundVoteCastEvent.parameters = new Array()

  extraFundVoteCastEvent.parameters.push(
    new ethereum.EventParam(
      "requestId",
      ethereum.Value.fromUnsignedBigInt(requestId)
    )
  )
  extraFundVoteCastEvent.parameters.push(
    new ethereum.EventParam("voter", ethereum.Value.fromAddress(voter))
  )
  extraFundVoteCastEvent.parameters.push(
    new ethereum.EventParam("support", ethereum.Value.fromBoolean(support))
  )
  extraFundVoteCastEvent.parameters.push(
    new ethereum.EventParam("stake", ethereum.Value.fromUnsignedBigInt(stake))
  )

  return extraFundVoteCastEvent
}

export function createFinalMilestoneAchievedEvent(): FinalMilestoneAchieved {
  let finalMilestoneAchievedEvent =
    changetype<FinalMilestoneAchieved>(newMockEvent())

  finalMilestoneAchievedEvent.parameters = new Array()

  return finalMilestoneAchievedEvent
}

export function createFundingFailedEvent(): FundingFailed {
  let fundingFailedEvent = changetype<FundingFailed>(newMockEvent())

  fundingFailedEvent.parameters = new Array()

  return fundingFailedEvent
}

export function createFundingSuccessfulEvent(): FundingSuccessful {
  let fundingSuccessfulEvent = changetype<FundingSuccessful>(newMockEvent())

  fundingSuccessfulEvent.parameters = new Array()

  return fundingSuccessfulEvent
}

export function createFundsWithdrawnEvent(
  milestoneIndex: BigInt,
  amount: BigInt
): FundsWithdrawn {
  let fundsWithdrawnEvent = changetype<FundsWithdrawn>(newMockEvent())

  fundsWithdrawnEvent.parameters = new Array()

  fundsWithdrawnEvent.parameters.push(
    new ethereum.EventParam(
      "milestoneIndex",
      ethereum.Value.fromUnsignedBigInt(milestoneIndex)
    )
  )
  fundsWithdrawnEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )

  return fundsWithdrawnEvent
}

export function createInvestmentReceivedEvent(
  investor: Address,
  amount: BigInt
): InvestmentReceived {
  let investmentReceivedEvent = changetype<InvestmentReceived>(newMockEvent())

  investmentReceivedEvent.parameters = new Array()

  investmentReceivedEvent.parameters.push(
    new ethereum.EventParam("investor", ethereum.Value.fromAddress(investor))
  )
  investmentReceivedEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )

  return investmentReceivedEvent
}

export function createMilestoneVerifiedEvent(
  milestoneIndex: BigInt
): MilestoneVerified {
  let milestoneVerifiedEvent = changetype<MilestoneVerified>(newMockEvent())

  milestoneVerifiedEvent.parameters = new Array()

  milestoneVerifiedEvent.parameters.push(
    new ethereum.EventParam(
      "milestoneIndex",
      ethereum.Value.fromUnsignedBigInt(milestoneIndex)
    )
  )

  return milestoneVerifiedEvent
}

export function createOwnershipTransferredEvent(
  previousOwner: Address,
  newOwner: Address
): OwnershipTransferred {
  let ownershipTransferredEvent =
    changetype<OwnershipTransferred>(newMockEvent())

  ownershipTransferredEvent.parameters = new Array()

  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam(
      "previousOwner",
      ethereum.Value.fromAddress(previousOwner)
    )
  )
  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam("newOwner", ethereum.Value.fromAddress(newOwner))
  )

  return ownershipTransferredEvent
}

export function createPlatformFeeWithdrawnEvent(
  amount: BigInt
): PlatformFeeWithdrawn {
  let platformFeeWithdrawnEvent =
    changetype<PlatformFeeWithdrawn>(newMockEvent())

  platformFeeWithdrawnEvent.parameters = new Array()

  platformFeeWithdrawnEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )

  return platformFeeWithdrawnEvent
}

export function createRefundClaimedEvent(
  investor: Address,
  amount: BigInt
): RefundClaimed {
  let refundClaimedEvent = changetype<RefundClaimed>(newMockEvent())

  refundClaimedEvent.parameters = new Array()

  refundClaimedEvent.parameters.push(
    new ethereum.EventParam("investor", ethereum.Value.fromAddress(investor))
  )
  refundClaimedEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )

  return refundClaimedEvent
}

export function createSecurityTokensWithdrawnEvent(
  generalContractor: Address,
  amount: BigInt
): SecurityTokensWithdrawn {
  let securityTokensWithdrawnEvent =
    changetype<SecurityTokensWithdrawn>(newMockEvent())

  securityTokensWithdrawnEvent.parameters = new Array()

  securityTokensWithdrawnEvent.parameters.push(
    new ethereum.EventParam(
      "generalContractor",
      ethereum.Value.fromAddress(generalContractor)
    )
  )
  securityTokensWithdrawnEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )

  return securityTokensWithdrawnEvent
}

export function createTokensPledgedEvent(
  pledger: Address,
  amount: BigInt
): TokensPledged {
  let tokensPledgedEvent = changetype<TokensPledged>(newMockEvent())

  tokensPledgedEvent.parameters = new Array()

  tokensPledgedEvent.parameters.push(
    new ethereum.EventParam("pledger", ethereum.Value.fromAddress(pledger))
  )
  tokensPledgedEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )

  return tokensPledgedEvent
}
