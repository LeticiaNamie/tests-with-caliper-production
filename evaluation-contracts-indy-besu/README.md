# evaluation-contracts-indy-besu-distributed

Variante distribuída baseada no repositório 
[evaluation-contracts-indy-besu](https://github.com/jeffsonsousa/evaluation-contracts-indy-besu) 

## Diferenças em relação ao original

- Adaptação para execução dos testes em ambiente distribuido

# 📘 DID Performance Evaluation using Hyperledger Caliper

Este repositório apresenta um ambiente completo para avaliação de desempenho de contratos inteligentes implantados em redes permissionadas baseadas no **Hyperledger Besu**, utilizando o framework **Hyperledger Caliper**. Os testes têm como foco contratos voltados à gestão de identidades descentralizadas (DID), definição de credenciais, revogação e controle de acesso.

---

## ⚙️ Requisitos

- **Node.js** versão 18 (utilizando NVM)
- **Docker** e **Docker Compose**
- **Rede Blockchain Besu operacional**
  - Você pode utilizar uma rede própria **ou** basear-se no tutorial:  
    🔗 [besu-production-docker](https://github.com/jeffsonsousa/besu-production-docker)
- **Contratos Inteligentes implantados** na rede
  - Use:  
    🔗 [contracts-indy-besu](https://github.com/jeffsonsousa/contracts-indy-besu)

Após a implantação dos contratos, será possível extrair os **endereços de cada contrato** e inseri-los no arquivo de configuração do Caliper para os testes de desempenho.

---

## Instalação do Ambiente de Testes

### 1. Instalação do Node.js com NVM
```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
nvm install 18
```

### 2. Instalação do Caliper CLI
```
npm install --only=prod @hyperledger/caliper-cli@0.5.0
```
### 3. Verificação da instalação

```
npx caliper --version
```
### 4. Bind do Caliper com Hyperledger Besu

```
npx caliper bind --caliper-bind-sut besu:latest
```
## Configuração dos Arquivos de Teste
### Arquivo networkconfig.json
Esse arquivo define os parâmetros de conexão com a rede Besu:

```
{
  "caliper": {
    "blockchain": "ethereum",
    "command": {}
  },
  "ethereum": {
    "url": "ws://localhost:8546",
    "fromAddress": "ENDERECO_PUBLICO",
    "fromAddressPrivateKey": "CHAVE_PRIVADA",
    "transactionConfirmationBlocks": 10,
    "contracts": {
      "RevocationRegistry": {
        "address": "ENDERECO_CONTRATO",
        "estimateGas": true,
        "gas": {
          "_revocation_": 800000
        },
        "abi": [ ABI_DO_CONTRATO ]
      }
    }
  }
}
```
### Arquivo de Benchmark (exemplo config-createDid.yaml)
```
simpleArgs: &simple-args
  schema: ["did:.../SCHEMA/BasicIdentity/1.0.0", "did:...", "BasicIdentity", "1.0.0", ["First Name", "Last Name"]]
  numberOfAccounts: &number-of-accounts 100

test:
  name: CreateSchema Test
  workers:
    number: 1
  rounds:
    - label: CreateSchema
      txNumber: *number-of-accounts
      rateControl:
        type: fixed-rate
        opts:
          tps: 10
      workload:
        module: benchmarks/scenario/SchemaRegistry/createSchema.js
        arguments: *simple-args

monitors:
  resource:
    - module: docker
      options:
        interval: 5
        containers:
          - all
        charting:
          bar:
            metrics: [Memory(avg), CPU%(avg)]
          polar:
            metrics: [all]

observer:
  type: local
  interval: 5

```

## Execução de Testes
### Execução Única

```
npx caliper launch manager \
  --caliper-workspace ./ \
  --caliper-benchconfig benchmarks/scenario/IndyDidRegistry/config-createDid.yaml \
  --caliper-networkconfig ./networks/besu/networkconfig.json \
  --caliper-bind-sut besu:latest \
  --caliper-flow-skip-install
``` 
## Execução Automatizada (Scripts)
### 1. Executar uma bateria completa de testes
```
python run_test_local.py
```
Este script executa todos os testes definidos, gerando relatórios em HTML para cada rodada de iteração.

### 2. Extração de Resultados para Análise
a. Extrair métricas agregadas (TPS, Latência, Taxa de Sucesso)

```
cd src/
python extract_report_to_csv.py
```

b. Extrair métricas de recursos (CPU, memória, disco, rede)
```
python extract_resource_to_csv.py
```

## Visualização de Resultados
Os notebooks Jupyter permitem a visualização gráfica dos resultados:
### Gráficos de Uso de Recursos (CPU, Memória)
```
jupyter notebook plot_resources.ipynb
```
### Gráficos de Desempenho (TPS, Latência)
```
jupyter notebook plot_summary.ipynb
```
## Considerações Finais

Esta infraestrutura de testes oferece uma abordagem acadêmica e automatizada para medir o desempenho e a eficiência de contratos inteligentes implantados em redes permissionadas. Os resultados obtidos por meio dos testes são fundamentais para:

* Avaliar a escalabilidade dos contratos

* Compreender o impacto computacional das funções de identidade descentralizada

* Gerar comparativos entre implementações e versões

Para contribuições, dúvidas ou extensões, sinta-se à vontade para entrar em contato comigo por email: jeffson.celeiro@gmail.com, jcsousa@cpqd.com.br e jeffson.sousa@icen.ufpa.br. 

