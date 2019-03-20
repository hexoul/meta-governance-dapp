import { addressesURL, getBranch } from './helpers'

let GOVERNANCE_ADDRESSES = {}

async function getContractsAddresses (netId) {
  let branch = getBranch(netId)
  let addr = addressesURL(branch) // ex: https://raw.githubusercontent.com/hexoul/poa-chain-spec/testnet/contracts.json
  let response
  try {
    await window.fetch(addr)
      .then(function (result) {
        response = result
      })
  } catch (e) {
    return
  }

  let contracts = await response.json()
  console.log('contracts', contracts)
  GOVERNANCE_ADDRESSES = contracts
}

function getAddresses (netId) {
  // switch (netId) {
  //   case constants.NETID_TESTNET:
  //     return TESTNET_ADDRESSES
  //   default:
  return GOVERNANCE_ADDRESSES
  // }
}

export {
  getContractsAddresses,
  getAddresses
}
