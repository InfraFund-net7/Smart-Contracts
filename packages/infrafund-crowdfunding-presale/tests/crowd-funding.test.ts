import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts"
import { AgreementSigned } from "../generated/schema"
import { AgreementSigned as AgreementSignedEvent } from "../generated/CrowdFunding/CrowdFunding"
import { handleAgreementSigned } from "../src/crowd-funding"
import { createAgreementSignedEvent } from "./crowd-funding-utils"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/developer/matchstick/#tests-structure-0-5-0

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let generalContractor = Address.fromString(
      "0x0000000000000000000000000000000000000001"
    )
    let newAgreementSignedEvent = createAgreementSignedEvent(generalContractor)
    handleAgreementSigned(newAgreementSignedEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/developer/matchstick/#write-a-unit-test

  test("AgreementSigned created and stored", () => {
    assert.entityCount("AgreementSigned", 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "AgreementSigned",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "generalContractor",
      "0x0000000000000000000000000000000000000001"
    )

    // More assert options:
    // https://thegraph.com/docs/en/developer/matchstick/#asserts
  })
})
