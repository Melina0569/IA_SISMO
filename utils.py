import pandas as pd
import joblib
import numpy as np
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import accuracy_score


INTERPRETACIONES = {
    "VT": "Evento Volcano-Tectónico (VT): fracturamiento de rocas por presión o movimiento de magma.",
    "VD": "Evento Volcano-Tectónico Profundo (VD): procesos internos a mayor profundidad.",
    "LP": "Sismo de Largo Período (LP): movimiento de fluidos volcánicos.",
    "LH": "Evento Largo Período Híbrido (LH): combinación de VT y LP.",
    "TD": "Tremor de Degasificación (TD): liberación sostenida de gases.",
    "TO": "Tremor de Degasificación (TD): liberación sostenida de gases."
}


def entrenar_modelo(ruta):
    """Entrena el modelo MLP optimizado para poca RAM (Render gratuito)."""
    
    print(f"\n{'='*60}")
    print(f"ENTRENAMIENTO INICIADO")
    print(f"Archivo: {ruta}")
    print(f"{'='*60}")
    
    try:
        # ========== 1. CARGAR DATOS ==========
        if not Path(ruta).exists():
            raise FileNotFoundError(f"Archivo no encontrado: {ruta}")
        
        ext = Path(ruta).suffix.lower()
        print(f"Extensión detectada: {ext}")
        
        if ext == ".csv":
            df = pd.read_csv(ruta)
        elif ext in (".xlsx", ".xls"):
            df = pd.read_excel(ruta)
        else:
            raise ValueError(f"Formato no soportado: {ext}")
        
        print(f"Registros cargados: {len(df)}")
        print(f"Columnas: {list(df.columns)}")
        
        # ========== 2. LIMPIEZA ==========
        df_before = len(df)
        df = df.dropna()
        print(f"Después de dropna: {len(df)} (eliminados: {df_before - len(df)})")
        
        if len(df) == 0:
            raise ValueError("El dataset quedó vacío después de eliminar nulos")
        
        # ========== 3. VALIDAR COLUMNAS ==========
        columnas_originales = list(df.columns)
        columnas_lower = [c.strip().upper() for c in columnas_originales]
        
        col_map = {}
        nombres_esperados = {
            'FRECUENCIA_PRINCIPAL': ['FRECUENCIA_PRINCIPAL', 'FRECUENCIA', 'FREQ', 'FREQUENCY'],
            'DURACION': ['DURACION', 'DURACIÓN', 'DURATION', 'DUR'],
            'ENERGIA': ['ENERGIA', 'ENERGÍA', 'ENERGY', 'ENG'],
            'TIPO': ['TIPO', 'TYPE', 'CLASE', 'CLASS', 'LABEL']
        }
        
        for estandar, alternativas in nombres_esperados.items():
            for alt in alternativas:
                if alt in columnas_lower:
                    idx = columnas_lower.index(alt)
                    col_map[estandar] = columnas_originales[idx]
                    break
        
        print(f"Mapeo de columnas: {col_map}")
        
        faltantes = [k for k in nombres_esperados.keys() if k not in col_map]
        if faltantes:
            raise ValueError(f"Columnas faltantes: {faltantes}. Columnas disponibles: {columnas_originales}")
        
        df = df.rename(columns={v: k for k, v in col_map.items()})
        
        # ========== 4. CONVERTIR TIPOS ==========
        for col in ['FRECUENCIA_PRINCIPAL', 'DURACION', 'ENERGIA']:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        
        df['TIPO'] = df['TIPO'].astype(str).str.strip().str.upper()
        df = df.dropna()
        print(f"Después de conversión numérica: {len(df)}")
        
        if len(df) == 0:
            raise ValueError("No quedaron datos válidos después de la conversión")
        
        # ========== 5. NORMALIZAR TIPOS ==========
        df['TIPO'] = df['TIPO'].replace({'TO': 'TD'})
        
        tipos_validos = {'VT', 'VD', 'LP', 'LH', 'TD'}
        df = df[df['TIPO'].isin(tipos_validos)]
        print(f"Después de filtrar tipos válidos: {len(df)}")
        
        if len(df) == 0:
            raise ValueError(f"No quedaron tipos válidos. Tipos encontrados: {df['TIPO'].unique()}")
        
        # ========== 6. VERIFICAR DISTRIBUCIÓN ==========
        distribucion = df['TIPO'].value_counts()
        print(f"\nDistribución de clases:")
        print(distribucion)
        
        # ========== 7. PREPARAR DATOS ==========
        X = df[["FRECUENCIA_PRINCIPAL", "DURACION", "ENERGIA"]].values
        y = df["TIPO"].values
        
        clases_unicas = np.unique(y)
        print(f"\nClases únicas: {clases_unicas}")
        
        if len(clases_unicas) < 2:
            raise ValueError(f"Se necesitan al menos 2 clases. Encontradas: {clases_unicas}")
        
        # ========== 8. DIVIDIR DATOS ==========
        min_por_clase = distribucion.min()
        print(f"Mínimo por clase: {min_por_clase}")
        
        if min_por_clase < 2:
            raise ValueError(f"Clase con muy pocas muestras: {min_por_clase}. Mínimo requerido: 2")
        
        test_size = 0.25
        if min_por_clase < 4:
            test_size = 0.2
            print(f"Ajustando test_size a {test_size} por pocas muestras")
        
        try:
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=test_size, random_state=42, stratify=y
            )
        except ValueError as e:
            print(f"Error en train_test_split: {e}")
            print("Intentando sin stratify...")
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=test_size, random_state=42
            )
        
        print(f"\nTrain: {len(X_train)} | Test: {len(X_test)}")
        
        # ========== 9. PREPROCESAMIENTO ==========
        encoder = LabelEncoder()
        y_train_enc = encoder.fit_transform(y_train)
        y_test_enc = encoder.transform(y_test)
        print(f"Clases codificadas: {list(encoder.classes_)}")
        
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        # ========== 10. MODELO MLP (OPTIMIZADO PARA RENDER 512MB) ==========
        n_samples = len(X_train)
        n_features = X_train.shape[1]
        n_classes = len(clases_unicas)
        
        # Arquitectura PEQUEÑA para no quedarse sin RAM
        if n_samples < 100:
            hidden_layers = (16, 8)
            max_iter = 500
        elif n_samples < 1000:
            hidden_layers = (32, 16)
            max_iter = 800
        else:
            hidden_layers = (32, 16, 8)   # ← MUCHO más pequeño que antes
            max_iter = 500                  # ← Menos iteraciones
        
        batch_size = min(512, max(64, n_samples // 10))
        
        print(f"\nArquitectura: {hidden_layers}")
        print(f"Batch size: {batch_size}")
        print(f"Features: {n_features} | Clases: {n_classes}")
        
        modelo = MLPClassifier(
            hidden_layer_sizes=hidden_layers,
            activation='relu',
            solver='adam',
            alpha=0.001,
            batch_size=batch_size,
            learning_rate='adaptive',
            max_iter=max_iter,
            early_stopping=False,     # ← CLAVE: no duplica memoria con validation set
            tol=1e-3,                 # ← Converge más rápido
            random_state=42,
            verbose=False
        )
        
        print("\nEntrenando modelo...")
        modelo.fit(X_train_scaled, y_train_enc)
        print(f"Entrenamiento completado en {modelo.n_iter_} iteraciones")
        
        # ========== 11. EVALUAR ==========
        y_pred = modelo.predict(X_test_scaled)
        accuracy = accuracy_score(y_test_enc, y_pred)
        
        print(f"\n{'='*60}")
        print(f"RESULTADO: Accuracy = {accuracy * 100:.2f}%")
        print(f"{'='*60}")
        
        # ========== 12. GUARDAR ==========
        Path("modelo").mkdir(exist_ok=True)
        joblib.dump(modelo, "modelo/modelo.pkl")
        joblib.dump(scaler, "modelo/scaler.pkl")
        joblib.dump(encoder, "modelo/encoder.pkl")
        print("Modelo guardado exitosamente")
        
        resultado = {
            "accuracy": round(accuracy * 100, 2),
            "muestras_train": int(len(X_train)),
            "muestras_test": int(len(X_test)),
            "clases": list(encoder.classes_),
            "iteraciones": int(modelo.n_iter_),
            "capas": str(hidden_layers),
            "distribucion": distribucion.to_dict()
        }
        
        print(f"Resultado: {resultado}")
        return (resultado, modelo, scaler, encoder)
        
    except Exception as e:
        print(f"\n{'='*60}")
        print(f"ERROR: {str(e)}")
        print(f"{'='*60}")
        import traceback
        traceback.print_exc()
        raise


def predecir_evento(modelo, scaler, encoder, frecuencia, duracion, energia):
    """Predice el tipo de evento sísmico."""
    
    X = np.array([[frecuencia, duracion, energia]])
    X = scaler.transform(X)
    
    pred = modelo.predict(X)[0]
    prob = modelo.predict_proba(X)[0]
    
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
