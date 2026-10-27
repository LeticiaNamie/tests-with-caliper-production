'use strict';

const OperationBase = require('./utils/operation-base');

function generateString(tam) {
    const base58chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let randomString = '';
    for (let i = 0; i < tam; i++) {
        randomString += base58chars.charAt(Math.floor(Math.random() * base58chars.length));
    }
    return randomString;
}


class CreateDid extends OperationBase {
    constructor() {
        super();
    }
    
    async submitTransaction() {
        const did_end = generateString(22)
        const document = [[],`did:indy2:indy_besu:${did_end}`,[],[["did:indy2:indy_besu:RQDxoJ2Mz3WuyqaqsjVTdN#KEY-1","Ed25519VerificationKey2018", "did:indy2:testnet:N22WedHLJdFf4yMaDXdhJcL97","HAFkhqbPbor781QCMfNvr6oQTTixK9U7gZmDV7pszTHp",""]],[["did:indy2:indy_besu:RQDxoJ2Mz3WuyqaqsjVTdN#KEY-1",["1","1","1","1","1"]]],[],[],[],[],[],[]]

        // const document = [[],"did:indy2:indy_besu:MRDxoJ2Mz4ZuyqaqsjVTdN",[],[["did:indy2:indy_besu:RQDxoJ2Mz3WuyqaqsjVTdN#KEY-1","Ed25519VerificationKey2018", "did:indy2:testnet:N22WedHLJdFf4yMaDXdhJcL97","HAFkhqbPbor781QCMfNvr6oQTTixK9U7gZmDV7pszTHp",""]],[["did:indy2:indy_besu:RQDxoJ2Mz3WuyqaqsjVTdN#KEY-1",["1","1","1","1","1"]]],[],[],[],[],[],[]]
        await this.sutAdapter.sendRequests(this.createConnectorRequest('createDid', document));
    }
}

function createWorkloadModule() {
    return new CreateDid();
}

module.exports.createWorkloadModule = createWorkloadModule;