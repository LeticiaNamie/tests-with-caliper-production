import json
import os
import subprocess
import time
import urllib.request
from datetime import datetime

# Caminhos para cada configuração de função
BENCHMARK_FILES = {
    "createDid":                    'benchmarks/scenario/IndyDidRegistry/config-createDid.yaml'
}

# TPS a ser testado (20 a 120, de 20 em 20)
TPS_LIST = [1000, 3000, 5000]

# Quantidade de repetições completas da varredura (todas as funções x todos os TPS)
REPETITIONS = 1

# Mesma variável usada pelo setup_issuer.js (exportada pelo run_caliper_tests.sh);
# fallback local para quando o script roda fora da EC2 provisionada.
RPC_URL = os.environ.get('HTTP_RPC_URL', 'http://127.0.0.1:8545')


def get_txpool_pending_count(rpc_url):
    """Consulta txpool_besuStatistics no Node-1 e retorna (localCount + remoteCount).
    Retorna None se a chamada falhar (rede instável, RPC temporariamente indisponível)."""
    payload = json.dumps({
        "jsonrpc": "2.0",
        "method": "txpool_besuStatistics",
        "params": [],
        "id": 1
    }).encode()
    req = urllib.request.Request(
        rpc_url, data=payload, headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            result = json.loads(resp.read()).get("result", {})
            return result.get("localCount", 0) + result.get("remoteCount", 0)
    except Exception:
        return None


def drain_max_wait_for_tps(tps):
    """Orçamento de espera pro txpool esvaziar, proporcional ao TPS do round que
    acabou de rodar — TPS mais alto deixa um backlog maior, então precisa de mais
    tempo real pra drenar antes da próxima rodada (mesma lógica pros nonces
    sequenciais das mesmas contas). Piso de 120s preserva o comportamento antigo
    caso o TPS_LIST volte a incluir valores baixos (ex.: a faixa de 20-120 TPS
    usada antes de 2026-07)."""
    return max(120, int(120 * (tps / 1000)))


def wait_txpool_drain(rpc_url=RPC_URL, max_wait=120, threshold=10, poll_interval=5):
    """Espera o pool de transações pendentes do Node-1 baixar antes de seguir para a
    próxima rodada. Rodadas de TPS alto podem deixar milhares de tx pendentes; sem
    esperar o pool esvaziar, a próxima rodada (mesmas contas, nonces sequenciais)
    nasce presa atrás do backlog e falha em cascata, mesmo com retry."""
    start = time.time()
    while time.time() - start < max_wait:
        pending = get_txpool_pending_count(rpc_url)
        if pending is None or pending <= threshold:
            return
        print(f"⏳ Aguardando txpool esvaziar: {pending} tx pendentes...")
        time.sleep(poll_interval)
    print(f"⚠️ txpool não baixou de {threshold} após {max_wait}s — seguindo mesmo assim.")

# Atualiza o valor de TPS no arquivo de benchmark YAML
def update_tps_in_file(file_path, tps):
    with open(file_path, 'r') as file:
        lines = file.readlines()

    new_lines = []
    for line in lines:
        if line.strip().startswith("tps:"):
            new_lines.append(f"          tps: {tps}\n")
        else:
            new_lines.append(line)

    with open(file_path, 'w') as file:
        file.writelines(new_lines)

def _report_has_results(path):
    """Retorna True se o report.html contém ao menos uma transação com sucesso.
    Caliper sempre gera o HTML (mesmo em falha), mas sem dados nas células <td>."""
    with open(path, 'r', errors='replace') as f:
        content = f.read()
    # A linha de dados da tabela de resultados só aparece quando há rounds concluídos.
    # "Send Rate (TPS)" aparece no cabeçalho sempre; os valores numéricos em <td> só
    # existem quando pelo menos um round produziu resultados.
    return '<td>' in content

# Executa o Caliper para uma função e TPS, com retry se WS não estiver pronto
def run_test(tps, function_name, benchmark_file, max_retries=3, retry_delay=15):
    update_tps_in_file(benchmark_file, tps)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    report_dir = f"src/reports/{function_name}"
    os.makedirs(report_dir, exist_ok=True)
    report_path = os.path.join(report_dir, f"{function_name}_report_{tps}_{timestamp}.html")
    cmd = [
        'npx', 'caliper', 'launch', 'manager',
        '--caliper-workspace', './',
        '--caliper-benchconfig', benchmark_file,
        '--caliper-networkconfig', 'networks/besu/networkconfig.json',
        '--caliper-flow-skip-install'
    ]

    for attempt in range(1, max_retries + 1):
        try:
            subprocess.run(cmd, timeout=400)
        except subprocess.TimeoutExpired:
            print(f"⚠️ {function_name}@{tps}TPS tentativa {attempt}/{max_retries} travou (timeout 400s).")
        subprocess.run(['pkill', '-f', 'caliper launch worker'], stderr=subprocess.DEVNULL)
        if os.path.exists('report.html') and _report_has_results('report.html'):
            os.rename('report.html', report_path)
            print(f"✅ Relatório salvo em {report_path}")
            return
        if os.path.exists('report.html'):
            os.remove('report.html')
        if attempt < max_retries:
            print(f"⚠️ {function_name}@{tps}TPS tentativa {attempt}/{max_retries} falhou (sem dados válidos). Aguardando {retry_delay}s...")
            time.sleep(retry_delay)
            wait_txpool_drain(max_wait=drain_max_wait_for_tps(tps))

    print(f"❌ Nenhum resultado válido para {function_name} @ {tps} TPS após {max_retries} tentativas.")

# Faz o bind do Caliper com Besu uma única vez antes de todos os testes
def bind_caliper():
    print("\n🔗 Realizando bind do Caliper com Besu...")
    result = subprocess.run([
        'npx', 'caliper', 'bind',
        '--caliper-bind-sut', 'besu:latest',
        '--caliper-bind-cwd', './'
    ])
    if result.returncode != 0:
        print("❌ Bind do Caliper falhou")
        exit(1)
    print("✅ Bind concluído")

# Garante que o DID issuer existe na chain antes dos testes
def setup_issuer():
    print("\n🔧 Verificando/criando DID issuer na chain...")
    result = subprocess.run(['node', 'setup_issuer.js'], capture_output=True, text=True)
    print(result.stdout.strip())
    if result.returncode != 0:
        print(f"❌ Setup falhou: {result.stderr.strip()}")
        exit(1)

# Executa todos os testes
if __name__ == "__main__":
    bind_caliper()
    setup_issuer()

    for repetition in range(1, REPETITIONS + 1):
        print(f"\n{'='*50}")
        print(f"🔁 Repetição {repetition}/{REPETITIONS}")
        print(f"{'='*50}")
        for function_name, benchmark_file in BENCHMARK_FILES.items():
            print(f"\n{'='*50}")
            print(f"🚀 Iniciando testes para função: {function_name}")
            print(f"{'='*50}")
            for tps in TPS_LIST:
                run_test(tps, function_name, benchmark_file)
                time.sleep(10)
                wait_txpool_drain(max_wait=drain_max_wait_for_tps(tps))
