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

function generateNumber(tam) {
    var randomNumber = "";
    var numbers = '0123456789';
    for (var i = 0; i < tam; i++) {
        randomNumber += numbers.charAt(Math.floor(Math.random() * numbers.length));
    }
    return randomNumber;
}


class createOrUpdateEntry extends OperationBase {
    constructor() {
        super();
    }

    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);

        // RevocationRegistry.createOrUpdateEntry exige que msg.sender seja dono
        // do DID emissor (issuerId). Cada worker cria seu proprio DID.
        // O identificador (parte apos o ultimo ':') precisa ter exatamente 21
        // ou 22 caracteres (IndyDidValidator.validateDid), por isso nao da pra
        // prefixar com "Wrk<workerIndex>" sem estourar o tamanho.
        this.issuerDid = `did:indy2:indy_besu:${generateString(22)}`;
        const didDocument = [[], this.issuerDid, [], [["did:indy2:indy_besu:RQDxoJ2Mz3WuyqaqsjVTdN#KEY-1", "Ed25519VerificationKey2018", "did:indy2:testnet:N22WedHLJdFf4yMaDXdhJcL97", "HAFkhqbPbor781QCMfNvr6oQTTixK9U7gZmDV7pszTHp", ""]], [["did:indy2:indy_besu:RQDxoJ2Mz3WuyqaqsjVTdN#KEY-1", ["1", "1", "1", "1", "1"]]], [], [], [], [], [], []];
        await this.sutAdapter.sendRequests({
            contract: 'IndyDidRegistry',
            verb: 'createDid',
            args: [didDocument],
            readOnly: false
        });
    }

    async submitTransaction() {
        const revEntry_end =  generateNumber(3)
        const revEntry = [
            "revReg123",
            "CL_ACCUM",
            `revocationEntry${revEntry_end}`,
            this.issuerDid
        ]

        await this.sutAdapter.sendRequests(this.createConnectorRequest('createOrUpdateEntry', revEntry));
    }
}

function createWorkloadModule() {
    return new createOrUpdateEntry();
}

module.exports.createWorkloadModule = createWorkloadModule;
