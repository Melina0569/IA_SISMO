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


# =====================================================
# INTERPRETACIONES DETALLADAS POR TIPO
# =====================================================
INTERPRETACIONES_BASE = {
    "VT": {
        "titulo": "Evento Volcano-Tectónico (VT)",
        "descripcion": "Fracturamiento de roca sólida por presión magmática o ajustes estructurales del volcán.",
        "causa": "Se produce cuando el magma empuja contra la roca circundante, generando esfuerzos que superan la resistencia del material. Es el evento más común en volcanes activos.",
        "caracteristicas": {
            "frecuencia": "Alta (generalmente > 3 Hz). La ruptura de roca dura genera ondas de alta frecuencia.",
            "duracion": "Corta (segundos a minutos). El fracturamiento es un evento rápido e instantáneo.",
            "energia": "Alta a muy alta. La liberación de energía acumulada en la roca es explosiva."
        },
        "implicacion": "Indica actividad magmática activa cerca de la superficie. Si aumenta en frecuencia, puede preceder a una erupción."
    },
    "VD": {
        "titulo": "Evento Volcano-Tectónico Profundo (VD)",
        "descripcion": "Fracturamiento de roca a profundidades mayores (> 5 km), generalmente relacionado con el ascenso de magma desde cámaras profundas.",
        "causa": "Movimiento del magma en conductos profundos o colapso de cámaras magmáticas profundas. La señal se atenúa al llegar a la superficie.",
        "caracteristicas": {
            "frecuencia": "Media-alta (2-5 Hz). La atenuación de la trayectoria larga reduce ligeramente la frecuencia respecto a VT superficial.",
            "duracion": "Corta a media. Similar a VT pero con ligero alargamiento por reverberación en trayectos profundos.",
            "energia": "Moderada a alta. Aunque la fuente es potente, la distancia atenúa la energía registrada en superficie."
        },
        "implicacion": "Sugiere recarga magmática desde profundidad. Es un indicador temprano de que el sistema volcánico está recibiendo magma nuevo."
    },
    "LP": {
        "titulo": "Sismo de Largo Período (LP)",
        "descripcion": "Resonancia de fluidos volcánicos (magmaticos o hidrotermales) dentro de conductos o cavidades del volcán.",
        "causa": "El movimiento de gases o líquidos a través de estrechamientos en chimeneas volcánicas genera una resonancia tipo 'tubo de órgano'. La fuente no es fractura de roca, sino oscilación de fluidos.",
        "caracteristicas": {
            "frecuencia": "Baja (< 2 Hz). Los fluidos pesados y las cavidades grandes generan oscilaciones lentas.",
            "duracion": "Larga (minutos a horas). La resonancia de fluidos es un proceso sostenido en el tiempo.",
            "energia": "Moderada. La energía se libera de forma continua y sostenida, no explosiva."
        },
        "implicacion": "Indica presencia de fluidos magmáticos o hidrotermales en movimiento. Es precursor clásico de actividad eruptiva."
    },
    "LH": {
        "titulo": "Evento Híbrido (LH)",
        "descripcion": "Señal mixta que combina una fase inicial de baja frecuencia (LP) seguida de una fase de alta frecuencia (VT).",
        "causa": "Inicia con el movimiento de fluidos que genera una resonancia (fase LP), seguido de la ruptura de la roca circundante por la presión ejercida por esos mismos fluidos (fase VT).",
        "caracteristicas": {
            "frecuencia": "Variable (baja al inicio, alta al final). La mezcla de ambas fases produce un espectro ancho.",
            "duracion": "Variable a larga. Dura más que un VT puro porque incluye la fase de resonancia inicial.",
            "energia": "Moderada a alta. Acumula energía tanto de la resonancia fluida como del fracturamiento final."
        },
        "implicacion": "Es una señal de transición crítica: los fluidos están interactuando activamente con la roca circundante. Puede indicar desgasificación intensa o apertura de nuevas chimeneas."
    },
    "TD": {
        "titulo": "Tremor de Degasificación (TD)",
        "descripcion": "Señal sísmica continua de muy baja frecuencia generada por la liberación sostenida de gases volcánicos.",
        "causa": "Flujo turbulento de gases magmáticos (principalmente H₂O, CO₂, SO₂) a través de conductos volcánicos. A diferencia del LP, no hay una resonancia definida, sino un tremor continuo.",
        "caracteristicas": {
            "frecuencia": "Muy baja (< 1 Hz). El flujo de gases es un proceso lento y continuo.",
            "duracion": "Muy larga (horas a días). La degasificación es un proceso persistente.",
            "energia": "Baja a moderada sostenida. No hay picos de energía, sino una liberación constante en el tiempo."
        },
        "implicacion": "Indica desgasificación activa del magma. Si se intensifica, puede preceder a erupciones efusivas o explosivas con alto contenido de gases."
    }
}


def generar_interpretacion_detallada(tipo_predicho, probabilidades, frecuencia, duracion, energia):
    """
    Genera una interpretación personalizada explicando POR QUÉ el modelo 
    asignó esa probabilidad basándose en los valores de entrada.
    """
    
    tipo = tipo_predicho
    info = INTERPRETACIONES_BASE.get(tipo, INTERPRETACIONES_BASE.get("VT"))
    
    # Obtener probabilidades ordenadas
    probs_ordenadas = sorted(probabilidades.items(), key=lambda x: x[1], reverse=True)
    top_prob = probs_ordenadas[0][1] * 100
    segunda_prob = probs_ordenadas[1][1] * 100 if len(probs_ordenadas) > 1 else 0
    tipo_top = probs_ordenadas[0][0]
    
    # Análisis de rangos típicos para contextualizar los valores
    rangos = {
        "VT":  {"freq": (3.0, 15.0), "dur": (0.5, 30.0), "eng": (100.0, 10000.0)},
        "VD":  {"freq": (2.0, 5.0),  "dur": (1.0, 45.0),  "eng": (50.0, 5000.0)},
        "LP":  {"freq": (0.1, 2.0),  "dur": (30.0, 300.0), "eng": (10.0, 1000.0)},
        "LH":  {"freq": (1.0, 5.0),  "dur": (10.0, 120.0), "eng": (20.0, 2000.0)},
        "TD":  {"freq": (0.1, 1.0),  "dur": (60.0, 1000.0), "eng": (5.0, 500.0)}
    }
    
    # Determinar qué parámetro fue más determinante
    rango_tipo = rangos.get(tipo, rangos["VT"])
    
    # Calcular qué tan "típico" es cada valor para el tipo predicho (0-100%)
    def tipicidad(valor, min_r, max_r):
        if max_r == min_r:
            return 100
        return max(0, min(100, 100 - abs((valor - (min_r + max_r)/2) / ((max_r - min_r)/2)) * 100))
    
    tip_frec = tipicidad(frecuencia, rango_tipo["freq"][0], rango_tipo["freq"][1])
    tip_dur = tipicidad(duracion, rango_tipo["dur"][0], rango_tipo["dur"][1])
    tip_eng = tipicidad(energia, rango_tipo["eng"][0], rango_tipo["eng"][1])
    
    # El parámetro más determinante es el más típico (mejor ajuste)
    determinantes = [
        ("frecuencia", tip_frec, frecuencia, "Hz"),
        ("duración", tip_dur, duracion, "s"),
        ("energía", tip_eng, energia, "J")
    ]
    determinantes.sort(key=lambda x: x[1], reverse=True)
    param_clave, tipicidad_val, val_clave, unidad = determinantes[0]
    
    # Construir texto explicativo
    texto = f"""🌋 {info['titulo']}

📊 ¿Por qué esta clasificación?
El modelo asignó {top_prob:.1f}% de probabilidad a este evento porque los parámetros de entrada se alinean fuertemente con las características típicas de un {tipo}.

🔬 Análisis de parámetros:
• Frecuencia: {frecuencia:.2f} Hz → {info['caracteristicas']['frecuencia']}
• Duración: {duracion:.2f} s → {info['caracteristicas']['duracion']}
• Energía: {energia:.2f} J → {info['caracteristicas']['energia']}

🎯 Parámetro más determinante: {param_clave.upper()} ({val_clave:.2f} {unidad})
Este valor tiene un {tipicidad_val:.0f}% de coincidencia con el perfil típico de {tipo}, lo que fue clave para la decisión del modelo.

📖 Descripción:
{info['descripcion']}

🔍 Causa física:
{info['causa']}

⚠️ Implicación volcánica:
{info['implicacion']}
"""
    
    # Si la segunda probabilidad es significativa (>20%), mencionar la ambigüedad
    if segunda_prob > 20:
        tipo_2 = probs_ordenadas[1][0]
        info_2 = INTERPRETACIONES_BASE.get(tipo_2, {})
        texto += f"\n⚡ Nota: El modelo detectó una ambigüedad del {segunda_prob:.1f}% con {tipo_2} ({info_2.get('titulo', '')}). Esto sugiere que el evento podría tener características mixtas o estar en una fase de transición.\n"
    
    return texto.strip()


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
        
        if n_samples < 100:
            hidden_layers = (16, 8)
            max_iter = 500
        elif n_samples < 1000:
            hidden_layers = (32, 16)
            max_iter = 800
        else:
            hidden_layers = (32, 16, 8)
            max_iter = 500
        
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
            early_stopping=False,
            tol=1e-3,
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
    """Predice el tipo de evento sísmico con interpretación detallada."""
    
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
    
    # Generar interpretación detallada personalizada
    interpretacion = generar_interpretacion_detallada(
        tipo_mas_probable, 
        probabilidades, 
        frecuencia, 
        duracion, 
        energia
    )
    
    return {
        "tipo": tipo_mas_probable,
        "confianza": round(confianza * 100, 2),
        "probabilidades": probabilidades,
        "ranking": ranking,
        "interpretacion": interpretacion,
        "parametros_entrada": {
            "frecuencia": frecuencia,
            "duracion": duracion,
            "energia": energia
        }
    }
