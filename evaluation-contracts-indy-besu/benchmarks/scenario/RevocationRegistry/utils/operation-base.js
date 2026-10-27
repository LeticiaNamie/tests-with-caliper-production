'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

const SupportedConnectors = ['ethereum', 'besu'];

class OperationBase extends WorkloadModuleBase {
    constructor() {
        super();
    }

    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);

        this.assertConnectorType();
        this._revocation = this.roundArguments._revocation;
    }

    assertConnectorType() {
        this.connectorType = this.sutAdapter.getType();
        if (!SupportedConnectors.includes(this.connectorType)) {
            throw new Error(`Connector type ${this.connectorType} is not supported by the benchmark`);
        }
    }

    createConnectorRequest(operation, args) {
        switch (this.connectorType) {
            case 'ethereum':
                return this._createEthereumConnectorRequest(operation, args);
            default:
                throw new Error(`Connector type ${this.connectorType} is not supported by the benchmark`);
        }
    }

    _createEthereumConnectorRequest(operation, args) {
        const query = operation === 'createRevocation';
        return {
            contract: 'RevocationRegistry',
            verb: operation,
            args: [args],
            readOnly: query
        };
    }
}

module.exports = OperationBase;