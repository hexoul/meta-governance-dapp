import React from 'react'
import { Button, Select, Icon } from 'antd'

import { AddProposalForm, ReplaceProposalForm, RmoveProposalForm, UpdateProposalForm } from './Forms'

import { web3Instance } from '../web3'
import { constants } from '../constants'
import * as util from '../util'

import './style/style.css'

class ProposalForm extends React.Component {
  data = {
    selectedVoteTopic: '',
    formData: {}
  }

  state = {
    selectedChange: false,
    submitForm: false,
    newLockAmountErr: false,
    newAddrErr: false,
    newNodeErr: false,
    newNameErr: false,
    oldLockAmountErr: false,
    oldAddrErr: false,
    oldNodeErr: false,
    showLockAmount: ''
  }

  constructor (props) {
    super(props)
    this.governance = this.props.contracts.governance
    this.staking = this.props.contracts.staking
  }

  onSelectChange = async (value) => {
    this.data.selectedVoteTopic = value
    this.data.formData = {
      newLockAmount: this.props.stakingMin,
      oldLockAmount: this.props.stakingMin
    }
    this.resetForm()
    Object.keys(this.state)
      .filter(key => key.indexOf('Err') > 0)
      .forEach(key => { this.state[key] = false })
    this.setState(this.state)
  }

  resetForm () {
    if (window.document.forms[0]) {
      const elements = window.document.forms[0].elements
      Object.keys(elements).forEach(key => {
        switch (elements[key].name) {
          case 'newLockAmount':
          case 'oldLockAmount': elements[key].value = this.props.stakingMin; break
          default: elements[key].value = ''
        }
      })
    }
  }

  handleChange = (e) => {
    const originStr = this.data.formData[e.target.name]
    this.data.formData[e.target.name] = e.target.value
    switch (e.target.name) {
      case 'newLockAmount':
        if (!/^([0-9]*)$/.test(e.target.value)) this.data.formData[e.target.name] = originStr
        else this.setState({ newLockAmountErr: !this.checkLockAmount(e.target.value) })
        break
      case 'newAddr': this.setState({ newAddrErr: !this.checkAddr(e.target.value) }); break
      case 'newNode': this.setState({ newNodeErr: !this.checkNode(e.target.value) }); break
      case 'newName': this.setState({ newNameErr: !this.checkName(e.target.value) }); break
      case 'oldLockAmount':
        if (!/^([0-9]*)$/.test(e.target.value)) this.data.formData[e.target.name] = originStr
        this.setState({ oldLockAmountErr: e.target.value === '' })
        break
      case 'oldAddr': this.setState({ oldAddrErr: !this.checkAddr(e.target.value) }); break
      case 'oldNode': this.setState({ oldNodeErr: !this.checkNode(e.target.value) }); break
      default: break
    }
  }

  checkLockAmount (amount) {
    return (Number(amount) <= this.props.stakingMax && Number(amount) >= this.props.stakingMin)
  }

  checkAddr (addr) {
    return /^0x[a-fA-F0-9]{40}$/.test(addr)
  }

  checkNode (node) {
    return /^([a-fA-F0-9]{128})+@(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])+:([0-9]{5})$/.test(node)
  }

  checkName (name) {
    return /^[A-Za-z0-9+]{1,64}$/.test(name)
  }

  /* Submit form data. */
  handleSubmit = async (e) => {
    this.props.convertLoading(true)
    try {
      e.preventDefault()
      let trx = {}
      let formData = util.refineSubmitData(this.data.formData)
      if ((await this.handleProposalError(formData)) !== false) {
        this.props.convertLoading(false)
        return
      }
      if (this.data.selectedVoteTopic === 'add') {
        trx = this.governance.addProposalToAddMember(
          formData.newAddr,
          formData.newName,
          formData.newNode.node,
          formData.newNode.ip,
          [formData.newNode.port, formData.newLockAmount],
          formData.memo
        )
      } else if (this.data.selectedVoteTopic === 'replace') {
        trx = this.governance.addProposalToChangeMember(
          [formData.oldAddr, formData.newAddr],
          formData.newName,
          formData.newNode.node,
          formData.newNode.ip,
          [formData.newNode.port, formData.newLockAmount],
          formData.memo
        )
      } else if (this.data.selectedVoteTopic === 'remove') {
        trx = this.governance.addProposalToRemoveMember(
          formData.oldAddr,
          formData.oldLockAmount,
          formData.memo
        )
      } else if (this.data.selectedVoteTopic === 'update') {
        let myLockBalance = await this.staking.lockedBalanceOf(web3Instance.defaultAccount)
        trx = this.governance.addProposalToChangeMember(
          [web3Instance.defaultAccount, web3Instance.defaultAccount],
          formData.newNode.node,
          formData.newNode.ip,
          [formData.newNode.port, myLockBalance],
          formData.memo
        )
      } else return

      web3Instance.web3.eth.sendTransaction({
        from: web3Instance.defaultAccount,
        to: trx.to,
        data: trx.data
      }, (err, hash) => {
        if (err) {
          this.props.getErrModal(err.message, 'Proposal Submit Error')
          this.props.convertLoading(false)
        } else {
          // console.log('hash:', hash)
          this.props.waitForReceipt(hash, async (receipt) => {
            // console.log('Updated :', receipt)
            if (receipt.status) {
              await this.props.convertComponent('voting')
            } else {
              this.props.getErrModal("You don't have proposal submit authority", 'Proposal Submit Error', receipt.transactionHash)
            }
          })
        }
      })
    } catch (err) {
      console.log(err)
      this.props.getErrModal(err.message, err.name)
      this.props.convertLoading(false)
    }
  }

  async handleProposalError (formData) {
    if (!(await this.governance.isMember(web3Instance.defaultAccount)) && !constants.debugMode) {
      return this.props.getErrModal('You are not member', 'Proposal Submit Error')
    }

    if (this.data.selectedVoteTopic === 'add') {
      const newMemberBalance = Number(await this.staking.availableBalanceOf(formData.newAddr))
      const newLockedAmount = Number(formData.newLockAmount)

      if (await this.governance.isMember(formData.newAddr)) {
        return this.props.getErrModal('Existing Member Address (New)', 'Proposal Submit Error')
      } else if (this.props.newMemberaddr.some((item) => item === formData.newAddr)) {
        return this.props.getErrModal('Address with existing ballot (New)', 'Proposal Submit Error')
      } else if (newMemberBalance < newLockedAmount) {
        return this.props.getErrModal('Not Enough META Stake (New)', 'Proposal Submit Error')
      }
    } else if (this.data.selectedVoteTopic === 'replace') {
      const oldMemberLockedBalance = await this.staking.lockedBalanceOf(formData.oldAddr)
      const newMemberBalance = Number(await this.staking.availableBalanceOf(formData.newAddr))
      const newLockedAmount = Number(formData.newLockAmount)

      if (await this.governance.isMember(formData.newAddr)) {
        return this.props.getErrModal('Existing Member Address (New)', 'Proposal Submit Error')
      } else if (!await this.governance.isMember(formData.oldAddr)) {
        return this.props.getErrModal('Non-existing Member Address (Old)', 'Proposal Submit Error')
      } else if (this.props.newMemberaddr.some((item) => item === formData.newAddr)) {
        return this.props.getErrModal('Address with existing ballot (New)', 'Proposal Submit Error')
      } else if (this.props.oldMemberaddr.some((item) => item === formData.oldAddr)) {
        return this.props.getErrModal('Address with existing ballot (Old)', 'Proposal Submit Error')
      } else if (Number(oldMemberLockedBalance) !== newLockedAmount) {
        return this.props.getErrModal([
          'Invalid Replace META Amount',
          <br />,
          `(Old Address: ${web3Instance.web3.utils.fromWei(oldMemberLockedBalance, 'ether')} META Locked)`
        ], 'Proposal Submit Error')
      } else if (newMemberBalance < newLockedAmount) {
        return this.props.getErrModal('Not Enough META Stake (New)', 'Proposal Submit Error')
      }
    } else if (this.data.selectedVoteTopic === 'remove') {
      const oldMemberBalance = Number(await this.staking.lockedBalanceOf(formData.oldAddr))
      const oldLockedAmount = Number(formData.oldLockAmount)

      if (!await this.governance.isMember(formData.oldAddr)) {
        return this.props.getErrModal('Non-existing Member Address (Old)', 'Proposal Submit Error')
      } else if (this.props.oldMemberaddr.some((item) => item === formData.oldAddr)) {
        return this.props.getErrModal('Address with existing ballot (Old)', 'Proposal Submit Error')
      } else if (oldMemberBalance < oldLockedAmount) {
        return this.props.getErrModal('Invalid META Unlock Amount', 'Proposal Submit Error')
      }
    }
    return false
  }

  getLockAmount = async (value) => {
    if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
      this.props.getErrModal('Invalid Adress', 'Proposal Submit Error')
      this.setState({ showLockAmount: '' })
      return
    } else if (!web3Instance.web3.utils.checkAddressChecksum(value)) {
      value = web3Instance.web3.utils.toChecksumAddress(value)
    }
    if (!await this.governance.isMember(value)) {
      this.props.getErrModal('Non-existing Member Address (Old)', 'Proposal Submit Error')
      this.setState({ showLockAmount: '' })
      return
    }

    try {
      let lockedBalance = await this.staking.lockedBalanceOf(value)
      this.setState({ showLockAmount: web3Instance.web3.utils.fromWei(lockedBalance) })
    } catch (err) {
      console.log(err)
      this.props.getErrModal(err.message, err.name)
      this.props.convertLoading(false)
      this.setState({ showLockAmount: '' })
    }
  }

  getProposalForm () {
    switch (this.data.selectedVoteTopic) {
      case 'add':
        return <AddProposalForm
          netName={web3Instance.netName}
          loading={this.props.loading}
          stakingMin={this.props.stakingMin}
          newAddrErr={this.state.newAddrErr}
          newLockAmountErr={this.state.newLockAmountErr}
          newLockAmount={this.data.formData.newLockAmount}
          newNodeErr={this.state.newNodeErr}
          newNameErr={this.state.newNameErr}
          handleSubmit={this.handleSubmit}
          handleChange={this.handleChange}
        />
      case 'replace':
        return <ReplaceProposalForm
          netName={web3Instance.netName}
          loading={this.props.loading}
          stakingMin={this.props.stakingMin}
          oldAddrErr={this.state.oldAddrErr}
          newAddrErr={this.state.newAddrErr}
          newNameErr={this.state.newNameErr}
          newNodeErr={this.state.newNodeErr}
          newLockAmountErr={this.state.newLockAmountErr}
          newLockAmount={this.data.formData.newLockAmount}
          oldNodeErr={this.state.oldNodeErr}
          handleSubmit={this.handleSubmit}
          handleChange={this.handleChange}
        />
      case 'remove':
        return <RmoveProposalForm
          netName={web3Instance.netName}
          loading={this.props.loading}
          showLockAmount={this.state.showLockAmount}
          stakingMin={this.props.stakingMin}
          oldAddrErr={this.state.oldAddrErr}
          oldLockAmountErr={this.state.oldLockAmountErr}
          oldLockAmount={this.data.formData.oldLockAmount}
          handleSubmit={this.handleSubmit}
          handleChange={this.handleChange}
          getLockAmount={this.getLockAmount}
        />
      case 'update':
        return <UpdateProposalForm
          netName={web3Instance.netName}
          loading={this.props.loading}
          newNameErr={this.state.newNameErr}
          newNodeErr={this.state.newNodeErr}
          handleSubmit={this.handleSubmit}
          handleChange={this.handleChange}
        />
      default: break
    }
  }

  render () {
    return (
      <div>
        <div className='contentDiv container'>
          <div className='backBtnDiv'>
            <Button
              className={'btn-fill-white flex text-large ' + web3Instance.netName}
              onClick={e => this.props.convertComponent('voting')}
              loading={this.props.buttonLoading}
            >
              <span><Icon type='left' /></span>
              <span className='text_btn'>Back to Voting</span>
            </Button>
          </div>
          <div className='contentVotingDiv'>
            <div className='proposalHead'>
              <div className='title flex'>
                <p className='flex-full text-heavy'>New Proposal</p>
                <p>* Mandatory</p>
              </div>
              <p className='subtitle'>Topic for voting <span className='required'>*</span></p>
              <Select
                showArrow
                onChange={this.onSelectChange}
                disabled={this.props.buttonLoading}>
                <Select.Option value='add'>Add Authority</Select.Option>
                <Select.Option value='replace'>Replace Authority</Select.Option>
                <Select.Option value='remove'>Remove Authority</Select.Option>
                <Select.Option value='update'>Update Authority</Select.Option>
              </Select>
            </div>
            {this.data.selectedVoteTopic !== '' && <div>{this.getProposalForm()}</div>}
          </div>
        </div>
      </div>
    )
  }
}

export { ProposalForm }
