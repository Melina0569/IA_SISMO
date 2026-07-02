from flask import Flask, render_template, send_from_directory, request, jsonify
import os
import pandas as pd
import joblib
import shutil
from utils import entrenar_modelo, predecir_evento
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# =====================================================
# CONFIGURACIÓN
# =====================================================
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


# =====================================================
# RUTAS
# =====================================================
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
            "tamaño": os.path.getsize(ruta_uploads),
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
        return jsonify({"error": f"Error al leer el archivo: {str(e)}"}), 400


@app.route("/entrenar", methods=["POST"])
def entrenar():
    global modelo, scaler, encoder

    print(f"\n{'='*60}")
    print(f"PETICIÓN /entrenar recibida")
    print(f"{'='*60}")

    # VALIDACIÓN CRÍTICA DEL JSON
    data = request.get_json()
    if not data or not isinstance(data, dict):
        print("ERROR: No se recibió JSON válido")
        return jsonify({
            "error": "No se recibieron datos JSON válidos. Verifica el Content-Type.",
            "accuracy": 0
        }), 400

    ruta = data.get("ruta")
    print(f"Ruta recibida: {ruta}")

    if not ruta:
        print("ERROR: Falta el campo 'ruta'")
        return jsonify({
            "error": "Falta el campo 'ruta' en el body de la petición",
            "accuracy": 0
        }), 400

    if not os.path.exists(ruta):
        print(f"ERROR: Archivo no encontrado: {ruta}")
        return jsonify({
            "error": f"Archivo no encontrado: {ruta}",
            "accuracy": 0
        }), 404

    try:
        resultado, modelo, scaler, encoder = entrenar_modelo(ruta)
        
        if "accuracy" not in resultado:
            resultado["accuracy"] = 0
            
        print(f"Devolviendo resultado: {resultado}")
        return jsonify(resultado)
        
    except Exception as e:
        import traceback
        print(f"\nERROR en /entrenar: {str(e)}")
        traceback.print_exc()
        return jsonify({
            "error": str(e),
            "accuracy": 0,
            "detalle": "Revisa la terminal del servidor para más información"
        }), 500


@app.route("/predecir", methods=["POST"])
def predecir():
    global modelo, scaler, encoder

    if modelo is None:
        try:
            modelo = joblib.load(os.path.join(MODEL_FOLDER, "modelo.pkl"))
            scaler = joblib.load(os.path.join(MODEL_FOLDER, "scaler.pkl"))
            encoder = joblib.load(os.path.join(MODEL_FOLDER, "encoder.pkl"))
        except:
            return jsonify({"error": "Modelo no entrenado. Entrena primero."}), 400

    # VALIDACIÓN CRÍTICA DEL JSON
    data = request.get_json()
    if not data or not isinstance(data, dict):
        return jsonify({
            "error": "No se recibieron datos JSON válidos",
            "accuracy": 0
        }), 400

    try:
        resultado = predecir_evento(
            modelo, scaler, encoder,
            float(data["frecuencia"]),
            float(data["duracion"]),
            float(data["energia"])
        )
        return jsonify(resultado)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
