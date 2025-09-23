import * as fs from 'fs'
import * as solc from 'solc'
import * as path from 'path'
import { simulateContract, waitForTransactionReceipt, writeContract, readContract, Config } from '@wagmi/core'
import { Address, toFunctionSelector } from 'viem'

export const deployPermissionedForeignCallContract = async (client: any, from: string): Promise<[any, Address]> => {
  const filePath = 'tests/testContracts/PermissionedForeignCall.sol'
  const fileContent = fs.readFileSync(filePath, 'utf-8')
  const input = {
    language: 'Solidity',
    sources: {
      'PermissionedForeignCall.sol': {
        content: fileContent,
      },
    },
    settings: {
      outputSelection: {
        '*': {
          '*': ['*'],
        },
      },
    },
  }

  function findImports(relativePath) {
    // Resolve imports from node_modules
    if (relativePath.startsWith('@fortefoundation/')) {
      const fullPath = path.resolve(__dirname + '/..', 'node_modules', relativePath)
      return { contents: fs.readFileSync(fullPath, 'utf8') }
    }
    // Handle other imports if needed
    return { error: 'File not found' }
  }

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }))
  const hash = await client.deployContract({
    abi: output.contracts['PermissionedForeignCall.sol']['PermissionedForeignCall'].abi,
    bytecode: output.contracts['PermissionedForeignCall.sol']['PermissionedForeignCall'].evm.bytecode.object,
    account: from,
  })
  const receipt = await client.waitForTransactionReceipt({ hash })
  return [output.contracts['PermissionedForeignCall.sol']['PermissionedForeignCall'].abi, receipt.contractAddress]
}

export const initPermissionedForeignCall = async (
  config: any,
  abi: any,
  fcAddress: Address,
  rulesEngineAddress: Address,
  adminAddress: Address,
  functionSelector: string
) => {
  var trx
  try {
    trx = await simulateContract(config, {
      address: fcAddress,
      abi,
      functionName: 'setRulesEngineAddress',
      args: [rulesEngineAddress],
    })
  } catch (err) {
    return -1
  }

  if (trx != null) {
    const returnHash = await writeContract(config, {
      ...trx.request,
      account: config.getClient().account,
    })
    await waitForTransactionReceipt(config, {
      confirmations: 1,
      hash: returnHash,
    })
  }

  try {
    var selector = toFunctionSelector(functionSelector)
    trx = await simulateContract(config, {
      address: fcAddress,
      abi,
      functionName: 'setForeignCallAdmin',
      args: [adminAddress, selector],
    })
  } catch (err) {
    return -1
  }

  if (trx != null) {
    const returnHash = await writeContract(config, {
      ...trx.request,
      account: config.getClient().account,
    })
    await waitForTransactionReceipt(config, {
      confirmations: 1,
      hash: returnHash,
    })
  }

  return 0
}
