import { web3Instance } from './web3'

const fetch = require('node-fetch')

var borderColor = {
  valid: '#3db389',
  invalid: 'red'
}

var dayTimestamp = 86400

/**
 * Convert UNIX timestamp to readable
 * @param {*} timestamp UNIX
 */
function timeConverter (timestamp) {
  var a = new Date(timestamp * 1000)
  return a.getFullYear() + '/' + +0 + (a.getMonth() + 1) + '/' + a.getDate() + ' ' + a.getHours() + ':' + a.getMinutes() + '(UTC)'
}

function convertDayToTimestamp (day) {
  return day * dayTimestamp
}

function convertHexToString (input) {
  var hex = input.toString()
  var str = ''
  for (var i = 0; (i < hex.length && hex.substr(i, 2) !== '00'); i += 2) { str += String.fromCharCode(parseInt(hex.substr(i, 2), 16)) }
  return str
}

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function asyncForEach (array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array)
  }
}

function refine (m) {
  if (!m) return null
  Object.keys(m).forEach(key => {
    if (!isNaN(key)) return delete m[key]
    switch (key) {
      case 'title': m[key] = convertHexToString(m[key]); break
      case 'explanation': m[key] = convertHexToString(m[key]); break
      case 'reward': m[key + 'Meta'] = web3Instance.web3.utils.fromWei(m[key], 'ether') + 'META'; break
      case 'reserved': m[key + 'Meta'] = web3Instance.web3.utils.fromWei(m[key], 'ether') + 'META'; break
      case 'createdAt': m[key] = timeConverter(m[key]); break
      default: if (!m[key]) m[key] = ''; break
    }
  })
  return m
}

function refineBallotBasic (m) {
  if (!m) return null
  if (m.state === '2' && m.endTime * 1000 < Date.now()) m.state = '4'
  Object.keys(m).forEach(key => {
    if (!isNaN(key)) return delete m[key]
    switch (key) {
      case 'creator': m[key] = web3Instance.web3.utils.toChecksumAddress(m[key]); break
      case 'startTime': m[key] = timeConverter(m[key]); break
      case 'endTime': m.endTimeConverted = timeConverter(m[key]); break
      case 'memo': m[key] = convertHexToString(m[key]); break
      case 'duration': m[key] /= dayTimestamp; break
      case 'powerOfRejects':
      case 'powerOfAccepts': m[key] = parseInt(m[key]) / 100; break
      default: if (!m[key]) m[key] = ''; break
    }
  })
  return m
}

function refineSubmitData (m) {
  if (m === null || typeof (m) !== 'object') {
    return m
  }
  let copy = {}
  for (let key in m) { copy[key] = m[key] }

  Object.keys(copy).forEach(key => {
    if (!isNaN(key)) return delete copy[key]
    switch (key) {
      case 'newAddr':
      case 'oldAddr': copy[key] = web3Instance.web3.utils.toChecksumAddress(copy[key]); break
      case 'lockAmount':
      case 'oldLockAmount':
      case 'newLockAmount': copy[key] = web3Instance.web3.utils.toWei(copy[key].toString(), 'ether'); break
      case 'memo':
      case 'newName': copy[key] = web3Instance.web3.utils.asciiToHex(copy[key]); break
      case 'node':
      case 'newNode':
      case 'oldNode': let { node, ip, port } = splitNodeDescription(copy[key]); copy[key] = { node, ip, port }; break
      default: if (!copy[key]) copy[key] = ''; break
    }
  })
  return copy
}

function cmpIgnoreCase (a, b) {
  return a.toLowerCase().includes(b.toLowerCase())
}

/**
 *
 * @param {*} key
 * @param {*} val
 * @returns {map} b: true if valid or false if invalid, err: error message
 */
function validate (key, val) {
  switch (key) {
    case 'title':
    case 'explanation':
      if (!val) return { b: false, err: 'Please fill all red box' }
      if (isValidLength(val) > 32) return { b: false, err: 'Only 32 bytes allowed' }
      return { b: true }
    case 'reward':
    case 'reserve':
      if (val < 5) return { b: false, err: key.toUpperCase() + ' should be greater than 5 META' }
      return { b: true }
    case 'issuer':
      if (!val || !web3Instance.web3.utils.isAddress(val)) return { b: false, err: 'Please fill up valid issuers' }
      return { b: true }
    case 'topics':
      if (!val || val.length === 0) return { b: false, err: 'Select at least 1 topic' }
      else if (val.filter(e => e.title === val).length > 0) return { b: false, err: 'Duplicated topic' }
      else if (val.filter(e => e.issuer === '').length > 0) return { b: false, err: 'Please fill up valid issuers' }
      return { b: true }
    default: return { b: false, err: 'Error encountered, please try again' }
  }
}

var encoder = new TextEncoder('utf-8')

/**
 * Check if in 32 bytes or not
 * @param {*} str
 */
function isValidLength (str) {
  return encoder.encode(str).length
}

async function getAuthorityLists (org, repo, branch, source) {
  const URL = `https://raw.githubusercontent.com/${org}/${repo}/${branch}/${source}`
  return fetch(URL).then(response => response.json())
}

function splitNodeDescription (str) {
  let node, ip, port, splitedStr
  splitedStr = str.split('@')
  node = '0x' + splitedStr[0]
  splitedStr = splitedStr[1].split(':')
  ip = web3Instance.web3.utils.asciiToHex(splitedStr[0])
  splitedStr = splitedStr[1].split('?')
  port = parseInt(splitedStr[0])
  return { node, ip, port }
}

// eslint-disable-next-line
const shouldPass = () => { throw 'Function should be passed' }

// Serialize / Deserialize object at local storage
var save = (key, obj) => window.localStorage.setItem(key, JSON.stringify(obj))
var load = (key) => JSON.parse(window.localStorage.getItem(key))

var getBallotBasicFromLocal = () => load('ballotBasic')
var getBallotMemberFromLocal = () => load('ballotMember')
var getUpdatedTimeFromLocal = () => load('updatedTime')
var getAuthorityFromLocal = () => load('authority')
var getModifiedFromLocal = () => load('modified')
var setBallotBasicToLocal = (obj) => save('ballotBasic', obj)
var setBallotMemberToLocal = (obj) => save('ballotMember', obj)
var setAuthorityToLocal = (obj) => save('authority', obj)
var setUpdatedTimeToLocal = (obj) => save('updatedTime', obj)
var setModifiedToLocal = (obj) => save('modified', obj)

export {
  borderColor,
  timeConverter,
  sleep,
  convertHexToString,
  convertDayToTimestamp,
  asyncForEach,
  refine,
  refineBallotBasic,
  refineSubmitData,
  cmpIgnoreCase,
  isValidLength,
  getAuthorityLists,
  validate,
  splitNodeDescription,
  shouldPass,
  save,
  load,
  getBallotBasicFromLocal,
  getBallotMemberFromLocal,
  getUpdatedTimeFromLocal,
  getAuthorityFromLocal,
  getModifiedFromLocal,
  setBallotBasicToLocal,
  setBallotMemberToLocal,
  setAuthorityToLocal,
  setUpdatedTimeToLocal,
  setModifiedToLocal
}
