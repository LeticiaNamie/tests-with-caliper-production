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

class CreateSchema extends OperationBase {
    constructor() {
        super();
    }

    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);

        // SchemaRegistry.createSchema exige que msg.sender seja dono (criador) do
        // DID emissor (issuerId). Cada worker usa sua propria conta, entao precisa
        // criar e ser dono do proprio DID emissor antes de criar schemas.
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
        const did_end = generateString (4)
        const schema = [
            `${this.issuerDid}/anoncreds/v0/SCHEMA/GradeSch${did_end}/${did_end}`,
            this.issuerDid,
            `GradeSch${did_end}`,
            did_end,
            ["grade", "subject"]
        ]
        await this.sutAdapter.sendRequests(this.createConnectorRequest('createSchema', schema));
    }
}

function createWorkloadModule() {
    return new CreateSchema();
}

module.exports.createWorkloadModule = createWorkloadModule;
