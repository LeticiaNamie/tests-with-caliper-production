'use strict';

const Web3 = require('web3');
const fs = require('fs');

const networkconfig = JSON.parse(fs.readFileSync('./networks/besu/networkconfig.json', 'utf8'));
const eth = networkconfig.ethereum;

const HTTP_RPC_URL = process.env.HTTP_RPC_URL || 'http://127.0.0.1:8545';
const web3 = new Web3(HTTP_RPC_URL);

const FROM = eth.fromAddress;
const PRIVATE_KEY = eth.fromAddressPrivateKey;

// IDs fixos usados pelos workloads
const ISSUER_DID      = 'did:indy2:indy_besu:MRDxoJ2Mz3ZuyqaqsjVTdN';
const UPDATE_DID      = 'did:indy2:indy_besu:BnchmarkUpdtXyzABCDEFG';
const SCHEMA_ID       = `${ISSUER_DID}/anoncreds/v0/SCHEMA/BenchSchema/1.0`;
const CRED_DEF_ID     = `${ISSUER_DID}/anoncreds/v0/CLAIM_DEF/${SCHEMA_ID}/BenchCredDef`;

const didRegistry    = new web3.eth.Contract(eth.contracts.IndyDidRegistry.abi,            eth.contracts.IndyDidRegistry.address);
const schemaRegistry = new web3.eth.Contract(eth.contracts.SchemaRegistry.abi,             eth.contracts.SchemaRegistry.address);
const credDefRegistry= new web3.eth.Contract(eth.contracts.CredentialDefinitionRegistry.abi, eth.contracts.CredentialDefinitionRegistry.address);

const baseVerificationMethod = {
    id: "did:indy2:indy_besu:RQDxoJ2Mz3WuyqaqsjVTdN#KEY-1",
    verificationMethodType: "Ed25519VerificationKey2018",
    controller: "did:indy2:testnet:N22WedHLJdFf4yMaDXdhJcL97",
    publicKeyJwk: "",
    publicKeyMultibase: "HAFkhqbPbor781QCMfNvr6oQTTixK9U7gZmDV7pszTHp"
};

function makeDidDocument(did) {
    return {
        context: [], id: did, controller: [],
        verificationMethod: [baseVerificationMethod],
        authentication: [{ id: "", verificationMethod: baseVerificationMethod }],
        assertionMethod: [], capabilityInvocation: [], capabilityDelegation: [],
        keyAgreement: [], service: [], alsoKnownAs: []
    };
}

async function sendTx(data, to) {
    const nonce = await web3.eth.getTransactionCount(FROM, 'pending');
    const gasPrice = await web3.eth.getGasPrice();
    const signed = await web3.eth.accounts.signTransaction(
        { from: FROM, to, nonce, gasPrice, gas: 800000, data },
        PRIVATE_KEY
    );
    const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);
    if (!receipt.status) throw new Error(`TX reverted at block ${receipt.blockNumber}`);
    return receipt;
}

async function ensureDid(did) {
    try {
        const r = await didRegistry.methods.resolveDid(did).call();
        if (r.metadata.created !== '0') { console.log(`  ✅ DID exists: ${did}`); return; }
    } catch (_) {}
    console.log(`  🔧 Creating DID: ${did}`);
    const data = didRegistry.methods.createDid(makeDidDocument(did)).encodeABI();
    const r = await sendTx(data, eth.contracts.IndyDidRegistry.address);
    console.log(`  ✅ DID created at block ${r.blockNumber}`);
}

async function ensureSchema() {
    try {
        await schemaRegistry.methods.resolveSchema(SCHEMA_ID).call();
        console.log(`  ✅ Schema exists: ${SCHEMA_ID}`); return;
    } catch (_) {}
    console.log(`  🔧 Creating Schema: ${SCHEMA_ID}`);
    const schema = { id: SCHEMA_ID, issuerId: ISSUER_DID, name: 'BenchSchema', version: '1.0', attrNames: ['attr1'] };
    const data = schemaRegistry.methods.createSchema(schema).encodeABI();
    const r = await sendTx(data, eth.contracts.SchemaRegistry.address);
    console.log(`  ✅ Schema created at block ${r.blockNumber}`);
}

async function ensureCredDef() {
    try {
        await credDefRegistry.methods.resolveCredentialDefinition(CRED_DEF_ID).call();
        console.log(`  ✅ CredDef exists: ${CRED_DEF_ID}`); return;
    } catch (_) {}
    console.log(`  🔧 Creating CredDef: ${CRED_DEF_ID}`);
    const credDef = { id: CRED_DEF_ID, issuerId: ISSUER_DID, schemaId: SCHEMA_ID, credDefType: 'CL', tag: 'BenchCredDef', value: '<keys>' };
    const data = credDefRegistry.methods.createCredentialDefinition(credDef).encodeABI();
    const r = await sendTx(data, eth.contracts.CredentialDefinitionRegistry.address);
    console.log(`  ✅ CredDef created at block ${r.blockNumber}`);
}

async function setup() {
    console.log('\n🔧 Setting up on-chain prerequisites...');
    await ensureDid(ISSUER_DID);   // needed by: createSchema, createCredentialDefinition, createRevocationRegistry, createOrUpdateEntry
    await ensureDid(UPDATE_DID);   // needed by: updateDid
    await ensureSchema();           // needed by: createCredentialDefinition, createRevocationRegistry
    await ensureCredDef();          // needed by: createRevocationRegistry
    console.log('\n✅ Setup complete.\n');

    // Export IDs for workloads to use
    const ids = { ISSUER_DID, UPDATE_DID, SCHEMA_ID, CRED_DEF_ID };
    fs.writeFileSync('./networks/besu/setup_ids.json', JSON.stringify(ids, null, 2));
    console.log('📄 IDs written to networks/besu/setup_ids.json');
}

setup().catch(e => {
    console.error('❌ Setup error:', e.message);
    process.exit(1);
});
