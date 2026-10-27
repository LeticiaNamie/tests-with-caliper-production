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

class createRevocationRegistry extends OperationBase {
    constructor() {
        super();
    }

    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);

        // RevocationRegistry.createRevocationRegistry exige que msg.sender seja
        // dono do DID emissor, e que o credDefId referenciado ja exista. Cada
        // worker cria seu proprio DID, schema e credDef com a propria conta.
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

        const credDefTag = generateString(18);
        this.credDefId = `${this.issuerDid}/anoncreds/v0/CLAIM_DEF/${this.schemaId}/${credDefTag}`;
        const credDef = [this.credDefId, this.issuerDid, this.schemaId, 'CL', credDefTag, '<keys>'];
        await this.sutAdapter.sendRequests({
            contract: 'CredentialDefinitionRegistry',
            verb: 'createCredentialDefinition',
            args: [credDef],
            readOnly: false
        });
    }

    async submitTransaction() {
        // revRegistry.id precisa ser unico (RevocationRegistry._uniqueRevId),
        // entao nao pode ser o "revReg123" fixo original quando chamado repetidas
        // vezes durante a rodada.
        const revRegId = `revReg${this.workerIndex}_${generateString(10)}`;
        const revRegistry = ["1.0.0", revRegId, "CL", this.credDefId, "test-tag", "value123", this.issuerDid]

        await this.sutAdapter.sendRequests(this.createConnectorRequest('createRevocationRegistry', revRegistry));
    }
}

function createWorkloadModule() {
    return new createRevocationRegistry();
}

module.exports.createWorkloadModule = createWorkloadModule;
