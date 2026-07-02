import pandas as pd
import joblib
import numpy as np
from pathlib import Path
import warnings
import traceback
warnings.filterwarnings('ignore')

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import accuracy_score, classification_report


INTERPRETACIONES = {
    "VT": "Evento Volcano-Tectónico (VT): fracturamiento de rocas por presión o movimiento de magma.",
    "VD": "Evento Volcano-Tectónico Profundo (VD): procesos internos a mayor profundidad.",
    "LP": "Sismo de Largo Período (LP): movimiento de fluidos volcánicos.",
    "LH": "Evento Largo Período Híbrido (LH): combinación de VT y LP.",
    "TD": "Tremor de Degasificación (TD): liberación sostenida de gases.",
    "TO": "Tremor de Degasificación (TD): liberación sostenida de gases."
}


def log_to_file(msg):
    with open("error_log.txt", "a", encoding="utf-8") as f:
        f.write(f"{msg}\n")


def balancear_dataset(df, max_por_clase=500):
    log_to_file(f"\n{'='*60}")
    log_to_file("BALANCEANDO DATASET")
    log_to_file(f"{'='*60}")
    log_to_file(f"Antes del balanceo:")
    log_to_file(str(df['TIPO'].value_counts()))
    
    dfs_balanceados = []
    
    for tipo in df['TIPO'].unique():
        df_tipo = df[df['TIPO'] == tipo]
        original_count = len(df_tipo)
        
        if len(df_tipo) > max_por_clase:
            df_tipo = df_tipo.sample(n=max_por_clase, random_state=42)
            log_to_file(f"  {tipo}: {original_count} -> {max_por_clase} (submuestreo)")
        else:
            log_to_file(f"  {tipo}: {original_count} registros (sin cambios)")
        
        dfs_balanceados.append(df_tipo)
    
    df_balanceado = pd.concat(dfs_balanceados, ignore_index=True)
    
    log_to_file(f"\nDespués del balanceo:")
    log_to_file(str(df_balanceado['TIPO'].value_counts()))
    log_to_file(f"Total: {len(df_balanceado)} registros")
    
    return df_balanceado


def entrenar_modelo(ruta):
    log_to_file(f"\n{'='*60}")
    log_to_file("INICIANDO ENTRENAMIENTO")
    log_to_file(f"Archivo: {ruta}")
    log_to_file(f"{'='*60}")
    
    try:
        # CARGAR DATOS
        ext = Path(ruta).suffix.lower()
        log_to_file(f"Extensión: {ext}")
        
        if ext == ".csv":
            df = pd.read_csv(ruta)
        else:
            df = pd.read_excel(ruta)
        
        log_to_file(f"Registros cargados: {len(df)}")
        log_to_file(f"Columnas: {list(df.columns)}")
        
        # LIMPIEZA
        df_before = len(df)
        df = df.dropna()
        log_to_file(f"Después de dropna: {len(df)} (eliminados: {df_before - len(df)})")
        
        if len(df) == 0:
            raise ValueError("El dataset quedó vacío después de eliminar nulos")
        
        # DETECTAR COLUMNAS
        cols = {c.strip().upper(): c for c in df.columns}
        log_to_file(f"Columnas normalizadas: {list(cols.keys())}")
        
        freq_col = next((cols[k] for k in cols if 'FREC' in k or 'FREQ' in k), None)
        dur_col = next((cols[k] for k in cols if 'DUR' in k), None)
        eng_col = next((cols[k] for k in cols if 'ENER' in k or 'ENG' in k), None)
        tipo_col = next((cols[k] for k in cols if 'TIPO' in k or 'TYPE' in k or 'CLASE' in k), None)
        
        log_to_file(f"Mapeo: freq={freq_col}, dur={dur_col}, eng={eng_col}, tipo={tipo_col}")
        
        if not all([freq_col, dur_col, eng_col, tipo_col]):
            faltantes = []
            if not freq_col: faltantes.append("FRECUENCIA")
            if not dur_col: faltantes.append("DURACION")
            if not eng_col: faltantes.append("ENERGIA")
            if not tipo_col: faltantes.append("TIPO")
            raise ValueError(f"Columnas faltantes: {faltantes}")
        
        df = df.rename(columns={
            freq_col: 'FRECUENCIA_PRINCIPAL',
            dur_col: 'DURACION',
            eng_col: 'ENERGIA',
            tipo_col: 'TIPO'
        })
        
        # CONVERTIR TIPOS
        for col in ['FRECUENCIA_PRINCIPAL', 'DURACION', 'ENERGIA']:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        
        df['TIPO'] = df['TIPO'].astype(str).str.strip().str.upper()
        df = df.dropna()
        
        log_to_file(f"Después de conversión: {len(df)} registros")
        
        # NORMALIZAR TIPOS
        df['TIPO'] = df['TIPO'].replace({'TO': 'TD'})
        
        tipos_validos = {'VT', 'VD', 'LP', 'LH', 'TD'}
        tipos_encontrados = set(df['TIPO'].unique())
        log_to_file(f"Tipos encontrados: {tipos_encontrados}")
        
        df = df[df['TIPO'].isin(tipos_validos)]
        
        if len(df) == 0:
            raise ValueError(f"No quedaron tipos válidos. Encontrados: {tipos_encontrados}")
        
        # BALANCEAR
        df = balancear_dataset(df, max_por_clase=500)
        
        # PREPARAR DATOS
        X = df[["FRECUENCIA_PRINCIPAL", "DURACION", "ENERGIA"]].values
        y = df["TIPO"].values
        
        log_to_file(f"Features shape: {X.shape}")
        log_to_file(f"Clases: {np.unique(y)}")
        
        # DIVIDIR
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.25, random_state=42, stratify=y
        )
        
        log_to_file(f"Train: {len(X_train)} | Test: {len(X_test)}")
        
        # PREPROCESAMIENTO
        encoder = LabelEncoder()
        y_train_enc = encoder.fit_transform(y_train)
        y_test_enc = encoder.transform(y_test)
        
        log_to_file(f"Clases codificadas: {list(encoder.classes_)}")
        
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        # MODELO MLP
        n_samples = len(X_train)
        hidden_layers = (128, 64, 32)
        
        log_to_file(f"Arquitectura: {hidden_layers}")
        
        modelo = MLPClassifier(
            hidden_layer_sizes=hidden_layers,
            activation='relu',
            solver='adam',
            alpha=0.001,
            batch_size=32,
            learning_rate='adaptive',
            max_iter=3000,
            early_stopping=True,
            validation_fraction=0.15,
            n_iter_no_change=50,
            random_state=42
        )
        
        log_to_file("Entrenando modelo...")
        modelo.fit(X_train_scaled, y_train_enc)
        log_to_file(f"Entrenamiento completado en {modelo.n_iter_} iteraciones")
        
        # EVALUAR
        y_pred = modelo.predict(X_test_scaled)
        accuracy = accuracy_score(y_test_enc, y_pred)
        
        log_to_file(f"Accuracy: {accuracy * 100:.2f}%")
        
        # GUARDAR
        Path("modelo").mkdir(exist_ok=True)
        joblib.dump(modelo, "modelo/modelo.pkl")
        joblib.dump(scaler, "modelo/scaler.pkl")
        joblib.dump(encoder, "modelo/encoder.pkl")
        
        log_to_file("Modelo guardado")
        
        resultado = {
            "accuracy": round(accuracy * 100, 2),
            "muestras_train": int(len(X_train)),
            "muestras_test": int(len(X_test)),
            "clases": list(encoder.classes_),
            "iteraciones": int(modelo.n_iter_),
            "capas": str(hidden_layers)
        }
        
        log_to_file(f"Resultado: {resultado}")
        
        return (resultado, modelo, scaler, encoder)
        
    except Exception as e:
        error_msg = f"ERROR: {str(e)}\n{traceback.format_exc()}"
        log_to_file(error_msg)
        raise


def predecir_evento(modelo, scaler, encoder, frecuencia, duracion, energia):
    X = np.array([[frecuencia, duracion, energia]])
    X_scaled = scaler.transform(X)
    
    pred = modelo.predict(X_scaled)[0]
    prob = modelo.predict_proba(X_scaled)[0]
    
    tipo = encoder.inverse_transform([pred])[0]
    
    probabilidades = {
        str(clase): float(prob[i])
        for i, clase in enumerate(encoder.classes_)
    }
    
    ranking = sorted(probabilidades.items(), key=lambda x: x[1], reverse=True)
    tipo_mas_probable, confianza = ranking[0]
    
    return {
        "tipo": tipo_mas_probable,
        "confianza": round(confianza * 100, 2),
        "probabilidades": probabilidades,
        "ranking": ranking,
        "interpretacion": INTERPRETACIONES.get(tipo_mas_probable, "Clasificación generada por la red neuronal.")
    }