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

for script_name in SCRIPT_NAMES:
    input_csv_path = f'./reports/{script_name}/{script_name}_resource_metrics.csv'

    if not os.path.isfile(input_csv_path):
        print(f"⚠ CSV não encontrado, pulando: {input_csv_path}")
        continue

    try:
        df = pd.read_csv(input_csv_path)
    except pd.errors.EmptyDataError:
        print(f"⚠ CSV vazio ou inválido, pulando: {input_csv_path}")
        continue
    df['Rate'] = pd.to_numeric(df['Rate'], errors='coerce')

    output_dir = f'{script_name}_resource_metrics_by_tps'
    if os.path.isdir(output_dir):
        for old_file in os.listdir(output_dir):
            if old_file.endswith('.csv'):
                os.remove(os.path.join(output_dir, old_file))
    os.makedirs(output_dir, exist_ok=True)

    unique_tps = df['Rate'].dropna().unique()

    for tps in unique_tps:
        df_tps = df[df['Rate'] == tps]
        df_tps.to_csv(f'{output_dir}/{script_name}_resource_metrics_tps_{int(tps)}.csv', index=False)

    print(f'✅ [{script_name}] CSVs separados por TPS salvos em: {output_dir}')
