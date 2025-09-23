/// SPDX-License-Identifier: BUSL-1.1
import { Address, getAddress, toFunctionSelector, toHex } from 'viem'
import { expect, test, describe, beforeAll, beforeEach } from 'vitest'
import { DiamondAddress, connectConfig, createTestConfig, foundryAccountAddress } from '../src/config'
import {
  getRulesEnginePolicyContract,
  getRulesEngineComponentContract,
  getRulesEngineRulesContract,
  getRulesEngineForeignCallContract,
} from '../src/modules/contract-interaction-utils'
import {
  getForeignCallPermissionList,
  addAdminToPermissionList,
  removeFromPermissionList,
  addMultipleAdminsToPermissionList,
  removeMultipleAdminsFromPermissionList,
  removeAllFromPermissionList,
  getAllForeignCalls,
  removeForeignCallPermissions,
  getPermissionedForeignCallsForAdmin,
} from '../src/modules/foreign-calls'
import { createPolicy } from '../src/modules/policy'

import { Config } from '@wagmi/core'

import { deployPermissionedForeignCallContract, initPermissionedForeignCall } from './deployUtils'

// Hardcoded address of the diamond in diamondDeployedAnvilState.json
var config: Config
var client: any
var secondUserConfig: Config
var secondUserClient: any
var thirdUserConfig: Config
var thirdUserClient: any

// Take snapshot
export const takeSnapshot = async () => {
  const snapshotId = await client.snapshot()
  return snapshotId
}

// Revert to snapshot
export const revertToSnapshot = async (snapshotId: any) => {
  await client.revert({ id: snapshotId })
}

describe('Permissioned Foreign Call Interactions', async () => {
  const rulesEngineContract: `0x${string}` = DiamondAddress

  let snapshotId: `0x${string}`
  config = await createTestConfig()
  client = config.getClient({ chainId: config.chains[0].id })
  secondUserConfig = await createTestConfig(false)
  secondUserClient = secondUserConfig.getClient({
    chainId: secondUserConfig.chains[0].id,
  })
  thirdUserConfig = await createTestConfig(false)
  thirdUserClient = thirdUserConfig.getClient({
    chainId: thirdUserConfig.chains[0].id,
  })

  let fcAbi: any
  let fcAddress: Address
  let policyId: number
  const functionSignature = 'isActive(uint256)'
  const rulesEngineAddress = getAddress(rulesEngineContract)

  let permissionedFCPolicyJSON = {
    Policy: 'Rule Ordering Test Policy',
    Description: 'Test no rule ordering',
    PolicyType: 'open',
    CallingFunctions: [
      {
        name: 'transfer',
        functionSignature: 'transfer(address to, uint256 value)',
        encodedValues: 'address to, uint256 value',
      },
    ],
    ForeignCalls: [
      {
        name: 'IsActive',
        address: '',
        function: functionSignature,
        returnType: 'uint256',
        valuesToPass: 'value',
        mappedTrackerKeyValues: '',
        callingFunction: 'transfer',
      },
    ],
    Trackers: [],
    MappedTrackers: [],
    Rules: [
      {
        Name: 'RuleA',
        Description: 'First rule',
        condition: 'FC:IsActive == 1',
        positiveEffects: ['revert'],
        negativeEffects: [],
        callingFunction: 'transfer',
      },
    ],
  }

  beforeAll(async () => {
    await connectConfig(config, 0)
    await connectConfig(secondUserConfig, 0)
    snapshotId = await takeSnapshot()
  })

  beforeEach(async () => {
    await revertToSnapshot(snapshotId)
    const deployment = await deployPermissionedForeignCallContract(client, foundryAccountAddress)
    fcAbi = deployment[0]
    fcAddress = deployment[1]
    permissionedFCPolicyJSON.ForeignCalls[0].address = fcAddress
    const response = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      JSON.stringify(permissionedFCPolicyJSON)
    )
    policyId = response.policyId

    await initPermissionedForeignCall(
      config,
      fcAbi,
      fcAddress,
      rulesEngineAddress,
      foundryAccountAddress,
      functionSignature
    )
  })

  test('Can get permissioned foreign calls for policy', async () => {
    const permissionedFCs = await getAllForeignCalls(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      policyId
    )
    expect(permissionedFCs.length, 'There should be 1 foreign call for the policy').toEqual(1)
  })

  test('Can add/remove multiple admins for permissioned foreign call', async () => {
    await addMultipleAdminsToPermissionList(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      fcAddress,
      functionSignature,
      [secondUserClient.account.address, thirdUserClient.account.address],
      1
    )

    let permissionList = await getForeignCallPermissionList(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      fcAddress,
      functionSignature
    )

    expect(permissionList.length, 'Permission list should contain 3 entries after adding 2 admins').toEqual(3)

    await removeMultipleAdminsFromPermissionList(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      fcAddress,
      functionSignature,
      [secondUserClient.account.address, thirdUserClient.account.address],
      1
    )

    permissionList = await getForeignCallPermissionList(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      fcAddress,
      functionSignature
    )

    expect(permissionList.length, 'Permission list should contain 1 entry after remving 2 admins').toEqual(1)
  })

  test('Can remove all admins for permissioned foreign call', async () => {
    await addMultipleAdminsToPermissionList(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      fcAddress,
      functionSignature,
      [secondUserClient.account.address, thirdUserClient.account.address],
      1
    )

    let permissionList = await getForeignCallPermissionList(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      fcAddress,
      functionSignature
    )

    expect(permissionList.length, 'Permission list should contain 3 entries after adding 2 admins').toEqual(3)

    await removeAllFromPermissionList(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      fcAddress,
      functionSignature,
      1
    )

    permissionList = await getForeignCallPermissionList(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      fcAddress,
      functionSignature
    )

    expect(permissionList.length, 'Permission list should contain 0 entry after removing all admins').toEqual(0)
  })

  test('Can add/remove a single admin  permissioned foreign calls using multiple update functions', async () => {
    await addMultipleAdminsToPermissionList(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      fcAddress,
      functionSignature,
      [secondUserClient.account.address],
      1
    )

    let permissionList = await getForeignCallPermissionList(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      fcAddress,
      functionSignature
    )

    expect(permissionList.length, 'Permission list should contain 2 entries after adding 1 admins').toEqual(2)

    await removeMultipleAdminsFromPermissionList(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      fcAddress,
      functionSignature,
      [secondUserClient.account.address],
      1
    )

    permissionList = await getForeignCallPermissionList(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      fcAddress,
      functionSignature
    )

    expect(permissionList.length, 'Permission list should contain 1 entry after removing 1 admin').toEqual(1)
  })

  test('Can remove all permissions foreign calls using multiple update functions', async () => {
    let permissionList = await getForeignCallPermissionList(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      fcAddress,
      functionSignature
    )

    expect(permissionList.length, 'Permission list should contain 1 entry after initialization').toEqual(1)

    await removeForeignCallPermissions(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      fcAddress,
      functionSignature,
      1
    )

    permissionList = await getForeignCallPermissionList(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      fcAddress,
      functionSignature
    )

    expect(permissionList.length, 'Permission list should contain 0 entries after removing permissions').toEqual(0)
  })

  test('Can add/remove admins for permissioned foreign call', async () => {
    const [fcAbi, fcAddress] = await deployPermissionedForeignCallContract(client, foundryAccountAddress)

    permissionedFCPolicyJSON.ForeignCalls[0].address = fcAddress
    const v = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      JSON.stringify(permissionedFCPolicyJSON)
    )

    let permissionList = await getForeignCallPermissionList(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      fcAddress,
      functionSignature
    )

    expect(permissionList.length, 'Permission list should initially be empty').toEqual(0)

    await initPermissionedForeignCall(
      config,
      fcAbi,
      fcAddress,
      rulesEngineAddress,
      foundryAccountAddress,
      functionSignature
    )

    permissionList = await getForeignCallPermissionList(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      fcAddress,
      functionSignature
    )

    expect(permissionList.length, 'Permission list should contain 1 entry after initialization').toEqual(1)

    await addAdminToPermissionList(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      fcAddress,
      functionSignature,
      secondUserClient.account.address,
      1
    )

    permissionList = await getForeignCallPermissionList(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      fcAddress,
      functionSignature
    )

    expect(permissionList.length, 'Permission list should contain 2 entries after adding admin').toEqual(2)

    await removeFromPermissionList(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      fcAddress,
      functionSignature,
      secondUserClient.account.address,
      1
    )

    permissionList = await getForeignCallPermissionList(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      fcAddress,
      functionSignature
    )

    expect(permissionList.length).toEqual(1)
  })

  test('Can get permissioned foreign calls for admin', async () => {
    let permissionList = await getPermissionedForeignCallsForAdmin(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      policyId,
      secondUserClient.account.address
    )

    expect(permissionList.length, 'Permission list should contain 0 entries after initialization').toEqual(0)

    await addAdminToPermissionList(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      fcAddress,
      functionSignature,
      secondUserClient.account.address,
      1
    )

    permissionList = await getPermissionedForeignCallsForAdmin(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      policyId,
      secondUserClient.account.address
    )

    expect(permissionList.length, 'Permission list should contain 1 entry after adding admin').toEqual(1)

    await removeFromPermissionList(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      fcAddress,
      functionSignature,
      secondUserClient.account.address,
      1
    )

    permissionList = await getPermissionedForeignCallsForAdmin(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      policyId,
      secondUserClient.account.address
    )

    expect(permissionList.length, 'Permission list should contain 0 entries after removal').toEqual(0)
  })
})
