from flask import Flask, render_template, send_from_directory, request, jsonify
import os
import sys
import traceback
import pandas as pd
import joblib
from flask_cors import CORS

# =====================================================
# LOGGING DE ERRORES A ARCHIVO
# =====================================================
def log_error(msg):
    with open("error_log.txt", "a", encoding="utf-8") as f:
        f.write(f"\n{'='*60}\n")
        f.write(f"{msg}\n")
        f.write(f"{'='*60}\n")

# Limpiar log anterior
if os.path.exists("error_log.txt"):
    os.remove("error_log.txt")

log_error("Servidor iniciado")

# =====================================================
# IMPORTAR UTILS CON MANEJO DE ERRORES
# =====================================================
try:
    from utils import entrenar_modelo, predecir_evento
    log_error("utils importado correctamente")
except Exception as e:
    log_error(f"ERROR importando utils: {str(e)}\n{traceback.format_exc()}")
    # Crear funciones dummy para que no falle el import
    def entrenar_modelo(ruta):
        raise Exception(f"Error importando utils: {str(e)}")
    def predecir_evento(*args, **kwargs):
        raise Exception(f"Error importando utils: {str(e)}")

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = "datos/uploads"
PROCESSED_FOLDER = "datos/processed"
MODEL_FOLDER = "modelo"

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)
os.makedirs(MODEL_FOLDER, exist_ok=True)

modelo = None
scaler = None
encoder = None
dataset_info = {}


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/static/views/<path:filename>")
def serve_view(filename):
    views_dir = os.path.join(app.root_path, "templates")
    return send_from_directory(views_dir, filename)


@app.route("/subir", methods=["POST"])
def subir():
    global dataset_info

    if "archivo" not in request.files:
        return jsonify({"error": "No se envió ningún archivo"}), 400

    file = request.files["archivo"]
    if file.filename == "":
        return jsonify({"error": "Nombre de archivo vacío"}), 400

    ruta_uploads = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(ruta_uploads)

    ruta_processed = os.path.join(PROCESSED_FOLDER, file.filename)
    import shutil
    shutil.copy2(ruta_uploads, ruta_processed)

    try:
        ext = os.path.splitext(file.filename)[1].lower()
        if ext == ".csv":
            df = pd.read_csv(ruta_uploads)
        elif ext in (".xlsx", ".xls"):
            df = pd.read_excel(ruta_uploads)
        else:
            return jsonify({"error": "Formato no soportado"}), 400

        dataset_info = {
            "nombre": file.filename,
            "registros": len(df),
            "columnas": list(df.columns),
            "preview": df.head(10).to_dict(orient="records")
        }

        return jsonify({
            "exito": True,
            "mensaje": "Datos cargados correctamente",
            "ruta": ruta_uploads,
            "ruta_procesada": ruta_processed,
            "info": dataset_info
        })

    except Exception as e:
        log_error(f"Error en /subir: {str(e)}\n{traceback.format_exc()}")
        return jsonify({"error": f"Error al leer el archivo: {str(e)}"}), 400


@app.route("/entrenar", methods=["POST"])
def entrenar():
    global modelo, scaler, encoder

    data = request.get_json()
    ruta = data.get("ruta")

    log_error(f"PETICIÓN /entrenar - ruta: {ruta}")

    if not ruta or not os.path.exists(ruta):
        log_error(f"Archivo no encontrado: {ruta}")
        return jsonify({"error": "Archivo no encontrado", "accuracy": 0}), 404

    try:
        log_error("Llamando a entrenar_modelo...")
        resultado, modelo, scaler, encoder = entrenar_modelo(ruta)
        
        log_error(f"Resultado: {resultado}")
        
        # Asegurar accuracy
        if "accuracy" not in resultado or resultado["accuracy"] is None:
            resultado["accuracy"] = 0
        try:
            resultado["accuracy"] = float(resultado["accuracy"])
        except:
            resultado["accuracy"] = 0
            
        log_error(f"Devolviendo: {resultado}")
        return jsonify(resultado)
        
    except Exception as e:
        error_msg = f"ERROR en /entrenar: {str(e)}\n{traceback.format_exc()}"
        log_error(error_msg)
        return jsonify({
            "error": str(e),
            "accuracy": 0,
            "detalle": "Revisa error_log.txt para más información"
        }), 500


@app.route("/predecir", methods=["POST"])
def predecir():
    global modelo, scaler, encoder

    if modelo is None:
        try:
            modelo = joblib.load(os.path.join(MODEL_FOLDER, "modelo.pkl"))
            scaler = joblib.load(os.path.join(MODEL_FOLDER, "scaler.pkl"))
            encoder = joblib.load(os.path.join(MODEL_FOLDER, "encoder.pkl"))
        except Exception as e:
            return jsonify({"error": f"Modelo no entrenado. Error: {str(e)}"}), 400

    data = request.get_json()

    try:
        resultado = predecir_evento(
            modelo, scaler, encoder,
            float(data["frecuencia"]),
            float(data["duracion"]),
            float(data["energia"])
        )
        return jsonify(resultado)

    except Exception as e:
        log_error(f"ERROR en /predecir: {str(e)}\n{traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)