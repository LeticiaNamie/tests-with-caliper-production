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

class createCredentialDefinition extends OperationBase {
    constructor() {
        super();
    }

    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);

        // CredentialDefinitionRegistry.createCredentialDefinition exige que
        // msg.sender seja dono do DID emissor (issuerId), e que schemaId ja
        // exista. Cada worker cria seu proprio DID e schema com a propria conta.
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

        this.schemaId = `${this.issuerDid}/anoncreds/v0/SCHEMA/BasicIdentity/1.0`;
        const schema = [this.schemaId, this.issuerDid, 'BasicIdentity', '1.0', ['name', 'age']];
        await this.sutAdapter.sendRequests({
            contract: 'SchemaRegistry',
            verb: 'createSchema',
            args: [schema],
            readOnly: false
        });
    }

    async submitTransaction() {
        // CredentialDefinitionValidator.requireValidId exige que
        // id === issuerId + "/anoncreds/v0/CLAIM_DEF/" + schemaId + "/" + tag,
        // entao o tag usado no id e no campo tag precisam ser o mesmo valor.
        const tag = generateString(18)
        const credDef = [
            `${this.issuerDid}/anoncreds/v0/CLAIM_DEF/${this.schemaId}/${tag}`,
            this.issuerDid,
            this.schemaId,
            "CL",
            tag,
            "<keys>"
        ]
        await this.sutAdapter.sendRequests(this.createConnectorRequest('createCredentialDefinition', credDef));
    }
}

function createWorkloadModule() {
    return new createCredentialDefinition();
}

module.exports.createWorkloadModule = createWorkloadModule;
