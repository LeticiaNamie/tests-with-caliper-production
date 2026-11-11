import pandas as pd
import os

SCRIPT_NAMES = [
    "createCredentialDefinition",
    "createDid",
    "createOrUpdateEntry",
    "createRevocationRegistry",
    "createSchema",
    "updateDid",
]

# sufixo do CSV de entrada -> nome base do CSV por TPS. Todos caem na mesma pasta
# {script}_resource_metrics_by_tps, que os scripts de upload/sweep já coletam.
INPUTS = {
    'resource_metrics': 'resource_metrics',  # CPU/Memória dos nós Besu (Prometheus)
    'worker_metrics': 'worker_metrics',      # CPU/Memória dos workers do Caliper (process)
    'txpool_metrics': 'txpool_metrics',      # Pool de transações do Besu (Prometheus)
}

for script_name in SCRIPT_NAMES:
    output_dir = f'{script_name}_resource_metrics_by_tps'
    cleaned = False

    for suffix, out_name in INPUTS.items():
        input_csv_path = f'./reports/{script_name}/{script_name}_{suffix}.csv'

        if not os.path.isfile(input_csv_path):
            print(f"⚠ CSV não encontrado, pulando: {input_csv_path}")
            continue

        try:
            df = pd.read_csv(input_csv_path)
        except pd.errors.EmptyDataError:
            print(f"⚠ CSV vazio ou inválido, pulando: {input_csv_path}")
            continue
        df['Rate'] = pd.to_numeric(df['Rate'], errors='coerce')

        if not cleaned:
            if os.path.isdir(output_dir):
                for old_file in os.listdir(output_dir):
                    if old_file.endswith('.csv'):
                        os.remove(os.path.join(output_dir, old_file))
            os.makedirs(output_dir, exist_ok=True)
            cleaned = True

        for tps in df['Rate'].dropna().unique():
            df_tps = df[df['Rate'] == tps]
            df_tps.to_csv(f'{output_dir}/{script_name}_{out_name}_tps_{int(tps)}.csv', index=False)

    if cleaned:
        print(f'✅ [{script_name}] CSVs separados por TPS salvos em: {output_dir}')
