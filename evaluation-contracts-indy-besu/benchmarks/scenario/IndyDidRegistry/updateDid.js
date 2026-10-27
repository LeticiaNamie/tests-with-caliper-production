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

class UpdateDid extends OperationBase {
    constructor() {
        super();
    }

    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);

        // Cada worker usa sua propria conta (fromAddressSeed), entao precisa
        // criar e ser dono do proprio DID antes de poder atualiza-lo
        // (IndyDidRegistry.updateDid exige msg.sender == criador do DID).
        // O identificador (parte apos o ultimo ':') precisa ter exatamente 21
        // ou 22 caracteres (IndyDidValidator.validateDid), por isso nao da pra
        // prefixar com "Wrk<workerIndex>" sem estourar o tamanho.
        this.did = `did:indy2:indy_besu:${generateString(22)}`;
        const createDocument = [[], this.did, [], [["did:indy2:indy_besu:RQDxoJ2Mz3WuyqaqsjVTdN#KEY-1", "Ed25519VerificationKey2018", "did:indy2:testnet:N22WedHLJdFf4yMaDXdhJcL97", "HAFkhqbPbor781QCMfNvr6oQTTixK9U7gZmDV7pszTHp", ""]], [["did:indy2:indy_besu:RQDxoJ2Mz3WuyqaqsjVTdN#KEY-1", ["1", "1", "1", "1", "1"]]], [], [], [], [], [], []];
        await this.sutAdapter.sendRequests(this.createConnectorRequest('createDid', createDocument));
    }

    async submitTransaction() {
        const document = [[], this.did, [], [["did:indy2:indy_besu:RQDxoJ2Mz3WuyqaqsjVTdN#KEY-1", "Ed25519VerificationKey2018", "did:indy2:testnet:MUDA_N22WedHLJdFf4yMaDXdhJcL98", "MUDA_HAFkhqbPbor781QCMfNvr6oQTTixK9U7gZmDV7pszTHp", ""]], [["did:indy2:indy_besu:RQDxoJ2Mz3WuyqaqsjVTdN#KEY-1", ["1", "1", "1", "1", "1"]]], [], [], [], [], [], []];
        await this.sutAdapter.sendRequests(this.createConnectorRequest('updateDid', document));
    }
}

function createWorkloadModule() {
    return new UpdateDid();
}

module.exports.createWorkloadModule = createWorkloadModule;
