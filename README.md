# tests-with-caliper-production

Testes de desempenho com **Hyperledger Caliper 0.5.0** dos contratos de identidade descentralizada (DID, schema, credential definition e revogação) em uma rede Besu QBFT **distribuída em várias VMs**.

É uma variante do repositório [evaluation-contracts-indy-besu](https://github.com/jeffsonsousa/evaluation-contracts-indy-besu/tree/main) de Jeffson Sousa, que roda o Caliper e a rede Besu na mesma máquina. Os cenários de benchmark, os workloads e os scripts de extração vêm dele; aqui eles foram adaptados para a execução em VMs separadas, orquestrada pelo repositório `infra-azure-multi-caliper`. O código fica em [evaluation-contracts-indy-besu/](evaluation-contracts-indy-besu/).

## Diferenças em relação ao original

| Aspecto | Original (jeffsonsousa) | Este repositório |
|---|---|---|
| Onde roda | Caliper e Besu no mesmo host (`ws://localhost:8546`) | Caliper em VMs próprias, falando com os nós Besu por IP privado |
| `networkconfig.json` | Editado à mão (URL, endereços, chave) | Gerado pelo script de setup da infra: URLs RPC/WS, `chainId`, `fromAddress`, chave privada e endereços dos contratos |
| Workers | Processos locais de um único manager | Modo distribuído: broker MQTT (mosquitto) no manager, workers locais e em outra VM (`--caliper-worker-communication-method mqtt`) |
| Destino das transações | Um único nó | Opcional (`ethereum.urls`): o worker `i` usa `urls[i % urls.length]`, espalhando o envio entre os nós |
| Varredura | `run_test_local.py` com TPS fixo | `run_test_local.py` com `TPS_LIST`, `BENCHMARK_FILES` e `REPETITIONS`; espera o txpool do Node-1 esvaziar entre rodadas (`txpool_besuStatistics`), com tempo proporcional ao TPS |
| Monitoramento | Monitor `docker` do Caliper | Prometheus no manager, lendo as métricas dos nós Besu (9545/9546) |
| Contas dos workers | — | Cada worker deriva sua conta de `fromAddressSeed` (`m/44'/60'/{worker}'/0/0`); essas contas precisam estar no `accounts-allowlist` da rede permissionada |
| Resultados | Relatórios HTML em `src/reports/` | Além disso, o CSV extraído vai para o Azure Blob Storage (`caliper-results/<timestamp>/`). A cópia automática para o laptop do operador só acontece no modo distribuído (mais de uma instância Caliper); com uma instância é preciso baixar do Blob Storage ou da VM via CLI |

## Como rodar

Requisitos: a rede Besu do repositório [besu-docker-distributed](https://github.com/LeticiaNamie/besu-docker-distributed) em execução e os contratos do [smart-contracts-indy-besu](https://github.com/LeticiaNamie/smart-contracts-indy-besu) implantados. A infra faz isso nas etapas anteriores.

### Automática (repositório `infra-testes-indy-besu`)

A infra provisiona as VMs do Caliper e executa `scripts/run_caliper_tests.sh` em cada uma. O script:

1. baixa do Blob Storage o `network-info.json`, os `deployments/` (endereços dos contratos), a chave do Node-1 e o `permissions_config.toml`;
2. confirma que a rede responde, chamando `eth_blockNumber` no Node-1;
3. instala Python 3 e Node.js 18;
4. clona este repositório;
5. instala o Caliper (`npm install --only=prod`, que também aplica o patch do conector) e faz o bind: `npx caliper bind --caliper-bind-sut besu:latest`;
6. lê os endereços dos contratos em `deployed_addresses.json` e a conta e a chave do Node-1;
7. reescreve `networks/besu/networkconfig.json`:
   - RPC e WS apontam para o Node-1; com `SPREAD_SENDS=true`, `ethereum.urls` lista o WS de todos os nós, na porta 8645 para os bootnodes e 8646 para os validators;
   - `chainId`, `fromAddress`, `fromAddressPrivateKey` e os endereços dos contratos vêm do deploy;
8. só no manager: ajusta o `include` do monitor nos YAMLs de `benchmarks/` para os N nós e sobe o Prometheus (porta 9090);
9. executa conforme o papel da VM:
   - **manager** (`ROLE=manager`): roda `setup_issuer.js`. Com `SKIP_SWEEP=false` (padrão), roda também a varredura local `python3 run_test_local.py` e depois `extract_and_upload_results.sh`. Com `SKIP_SWEEP=true`, pula a varredura e espera o modo distribuído;
   - **worker** (`ROLE=worker`): deixa pronto o `launch_workers.sh`, chamado depois pelo orquestrador.

No modo distribuído, o `scripts/run_distributed_sweep.py` da infra (que o `terraform apply` dispara quando há mais de uma VM de Caliper) faz, para cada repetição, função e TPS:

1. entra por SSH nas VMs worker e lança `launch_workers.sh <IP_DO_MANAGER>`;
2. entra na VM manager e roda `run_caliper_manager_distributed.sh`, que sobe o mosquitto e os workers locais e inicia o manager com `--caliper-worker-remote`.

Ao final, extrai os CSVs, envia ao Blob Storage e copia para `infra-azure-multi-caliper/caliper-results/<timestamp>/`. Para repetir a varredura depois do `apply`, a partir da pasta `scripts/` da infra:

```bash
python3 run_distributed_sweep.py
python3 run_distributed_sweep.py --functions createDid --tps-list 3000 --max-retries 1
python3 run_distributed_sweep.py --dry-run
```

Com **uma única instância Caliper** não há cópia automática para o laptop. Os CSVs ficam na VM (`~/tests-with-caliper-production/evaluation-contracts-indy-besu/src/`) e no Blob Storage; baixe pela CLI:

```bash
# da VM, via scp
scp -i <chave> -r ubuntu@<ip-da-vm>:tests-with-caliper-production/evaluation-contracts-indy-besu/src/reports ./caliper-results/

# do Blob Storage, via Azure CLI
az storage blob download-batch --account-name <conta> -s <container> \
  --pattern 'caliper-results/<timestamp>/*' -d ./caliper-results/
```

### Manual

Em uma máquina com acesso RPC e WS à rede Besu e Node.js 18 (via NVM):

```bash
cd evaluation-contracts-indy-besu
npm install --only=prod                       # aplica o patch do conector (postinstall)
npx caliper bind --caliper-bind-sut besu:latest
```

1. Edite `networks/besu/networkconfig.json`: `url`, `chainId`, `fromAddress`, `fromAddressPrivateKey` e o `address` de cada contrato em `contracts`. Para espalhar o envio, adicione `ethereum.urls` com endpoints `ws://`; `http(s)` é rejeitado pelo conector.
2. Inclua as contas dos workers no `accounts-allowlist` do `permissions_config.toml` de **todos** os nós e reinicie a rede. `scripts/derive-worker-accounts.js` faz a derivação e a atualização. Atenção: ele tem caminhos locais fixos que precisam ser ajustados antes do uso.
3. Crie os pré-requisitos on-chain:
   ```bash
   HTTP_RPC_URL=http://<ip-node-1>:8545 node setup_issuer.js
   ```
4. Execute um benchmark:
   ```bash
   npx caliper launch manager \
     --caliper-workspace ./ \
     --caliper-benchconfig benchmarks/scenario/IndyDidRegistry/config-createDid.yaml \
     --caliper-networkconfig ./networks/besu/networkconfig.json \
     --caliper-bind-sut besu:latest \
     --caliper-flow-skip-install
   ```
   Ou a varredura completa, com `HTTP_RPC_URL` apontando para o Node-1:
   ```bash
   python3 run_test_local.py
   ```
   Os parâmetros da varredura são `BENCHMARK_FILES`, `TPS_LIST` e `REPETITIONS`, no topo de `run_test_local.py`.
5. Extraia os resultados, como no original:
   ```bash
   cd src
   python3 extract_report_to_csv.py
   python3 extract_resource_to_csv.py
   ```
   Os notebooks `plot_summary.ipynb` e `plot_resources.ipynb` geram os gráficos.

## Cenários

Em `benchmarks/scenario/`:

| Contrato | Funções avaliadas |
|---|---|
| `IndyDidRegistry` | `createDid`, `updateDid` |
| `SchemaRegistry` | `createSchema` |
| `CredentialDefinitionRegistry` | `createCredentialDefinition` |
| `RevocationRegistry` | `createRevocationRegistry`, `createOrUpdateEntry` |

## Referências

- Repositório original: [jeffsonsousa/evaluation-contracts-indy-besu](https://github.com/jeffsonsousa/evaluation-contracts-indy-besu/tree/main)
- [Hyperledger Caliper](https://hyperledger.github.io/caliper/)
- Rede Besu: [besu-docker-distributed](https://github.com/LeticiaNamie/besu-docker-distributed)
- Contratos: [smart-contracts-indy-besu](https://github.com/LeticiaNamie/smart-contracts-indy-besu)

