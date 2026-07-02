// =====================================================
// LÓGICA PRINCIPAL DE LA APP
// =====================================================

// Estado global
let uploadedFilePath = '';
let isModelTrained = false;
let predictionHistory = [];

const DATASET_STORAGE_KEY = 'lastDatasetInfo';
const DATASET_PATH_STORAGE_KEY = 'lastDatasetPath';
const LAST_PREDICTION_KEY = 'lastPredictionResult';
const LAST_ACCURACY_KEY = 'lastTrainingAccuracy';

// =====================================================
// PERFILES SÍSMICOS PARA PREDICCIÓN POR REGLAS
// =====================================================
const PERFILES_SISMICOS = {
    VT: {
        freq: [3.0, 15.0],
        dur: [0.5, 30.0],
        eng: [100.0, 10000.0],
        nombre: "Evento Volcano-Tectónico (VT)",
        desc: "Fracturamiento de roca sólida por presión magmática o ajustes estructurales del volcán.",
        causa: "El magma empuja contra la roca circundante, generando esfuerzos que superan la resistencia del material. Es el evento más común en volcanes activos.",
        implicacion: "Indica actividad magmática activa cerca de la superficie. Si aumenta en frecuencia, puede preceder a una erupción.",
        caracteristicas: {
            frecuencia: "Alta (> 3 Hz). La ruptura de roca dura genera ondas de alta frecuencia.",
            duracion: "Corta (segundos a minutos). El fracturamiento es un evento rápido e instantáneo.",
            energia: "Alta a muy alta. La liberación de energía acumulada en la roca es explosiva."
        }
    },
    VD: {
        freq: [2.0, 5.0],
        dur: [1.0, 45.0],
        eng: [50.0, 5000.0],
        nombre: "Evento Volcano-Tectónico Profundo (VD)",
        desc: "Fracturamiento de roca a profundidades mayores (> 5 km), generalmente relacionado con el ascenso de magma desde cámaras profundas.",
        causa: "Movimiento del magma en conductos profundos o colapso de cámaras magmáticas profundas. La señal se atenúa al llegar a la superficie.",
        implicacion: "Sugiere recarga magmática desde profundidad. Es un indicador temprano de que el sistema volcánico está recibiendo magma nuevo.",
        caracteristicas: {
            frecuencia: "Media-alta (2-5 Hz). La atenuación de la trayectoria larga reduce ligeramente la frecuencia respecto a VT superficial.",
            duracion: "Corta a media. Similar a VT pero con ligero alargamiento por reverberación en trayectos profundos.",
            energia: "Moderada a alta. Aunque la fuente es potente, la distancia atenúa la energía registrada en superficie."
        }
    },
    LP: {
        freq: [0.1, 2.0],
        dur: [30.0, 300.0],
        eng: [10.0, 1000.0],
        nombre: "Sismo de Largo Período (LP)",
        desc: "Resonancia de fluidos volcánicos (magmáticos o hidrotermales) dentro de conductos o cavidades del volcán.",
        causa: "El movimiento de gases o líquidos a través de estrechamientos en chimeneas volcánicas genera una resonancia tipo 'tubo de órgano'. La fuente no es fractura de roca, sino oscilación de fluidos.",
        implicacion: "Indica presencia de fluidos magmáticos o hidrotermales en movimiento. Es precursor clásico de actividad eruptiva.",
        caracteristicas: {
            frecuencia: "Baja (< 2 Hz). Los fluidos pesados y las cavidades grandes generan oscilaciones lentas.",
            duracion: "Larga (minutos a horas). La resonancia de fluidos es un proceso sostenido en el tiempo.",
            energia: "Moderada. La energía se libera de forma continua y sostenida, no explosiva."
        }
    },
    LH: {
        freq: [1.0, 5.0],
        dur: [10.0, 120.0],
        eng: [20.0, 2000.0],
        nombre: "Evento Híbrido (LH)",
        desc: "Señal mixta que combina una fase inicial de baja frecuencia (LP) seguida de una fase de alta frecuencia (VT).",
        causa: "Inicia con el movimiento de fluidos que genera una resonancia (fase LP), seguido de la ruptura de la roca circundante por la presión ejercida por esos mismos fluidos (fase VT).",
        implicacion: "Es una señal de transición crítica: los fluidos están interactuando activamente con la roca circundante. Puede indicar desgasificación intensa o apertura de nuevas chimeneas.",
        caracteristicas: {
            frecuencia: "Variable (baja al inicio, alta al final). La mezcla de ambas fases produce un espectro ancho.",
            duracion: "Variable a larga. Dura más que un VT puro porque incluye la fase de resonancia inicial.",
            energia: "Moderada a alta. Acumula energía tanto de la resonancia fluida como del fracturamiento final."
        }
    },
    TD: {
        freq: [0.1, 1.0],
        dur: [60.0, 1000.0],
        eng: [5.0, 500.0],
        nombre: "Tremor de Degasificación (TD)",
        desc: "Señal sísmica continua de muy baja frecuencia generada por la liberación sostenida de gases volcánicos.",
        causa: "Flujo turbulento de gases magmáticos (principalmente H₂O, CO₂, SO₂) a través de conductos volcánicos. A diferencia del LP, no hay una resonancia definida, sino un tremor continuo.",
        implicacion: "Indica desgasificación activa del magma. Si se intensifica, puede preceder a erupciones efusivas o explosivas con alto contenido de gases.",
        caracteristicas: {
            frecuencia: "Muy baja (< 1 Hz). El flujo de gases es un proceso lento y continuo.",
            duracion: "Muy larga (horas a días). La degasificación es un proceso persistente.",
            energia: "Baja a moderada sostenida. No hay picos de energía, sino una liberación constante en el tiempo."
        }
    }
};

// =====================================================
// FUNCIONES DE INGESTA DE DATOS
// =====================================================
function normalizeEventType(type) {
    return type === 'TO' ? 'TD' : type;
}

function getClassProbability(probs, type) {
    if (!probs) return 0;
    const normalizedType = normalizeEventType(type);
    if (normalizedType === 'TD') {
        return probs.TD || probs.TO || 0;
    }
    return probs[normalizedType] || 0;
}

function getClassBarColor(type) {
    const normalizedType = normalizeEventType(type);
    const classColors = {
        VT: 'bg-primary',
        VD: 'bg-secondary',
        LP: 'bg-tertiary',
        LH: 'bg-error',
        TD: 'bg-primary',
        TO: 'bg-primary'
    };
    return classColors[normalizedType] || 'bg-surface-variant';
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropZone = document.getElementById('drop-zone');
    dropZone.classList.add('drag-active');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropZone = document.getElementById('drop-zone');
    dropZone.classList.remove('drag-active');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropZone = document.getElementById('drop-zone');
    dropZone.classList.remove('drag-active');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        uploadFile(files[0]);
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        uploadFile(file);
    }
}

function uploadFile(file) {
    const formData = new FormData();
    formData.append('archivo', file);

    const progressEl = document.getElementById('upload-progress');
    const barEl = document.getElementById('upload-bar');
    const percentEl = document.getElementById('upload-percent');

    progressEl.classList.remove('hidden');

    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90;
        barEl.style.width = progress + '%';
        percentEl.textContent = Math.floor(progress) + '%';
    }, 200);

    fetch('/subir', {
        method: 'POST',
        body: formData
    })
    .then(r => r.json())
    .then(data => {
        clearInterval(interval);
        barEl.style.width = '100%';
        percentEl.textContent = '100%';

        uploadedFilePath = data.ruta_procesada || data.ruta;

        if (data.info) {
            localStorage.setItem(DATASET_STORAGE_KEY, JSON.stringify(data.info));
            localStorage.setItem(DATASET_PATH_STORAGE_KEY, uploadedFilePath);
        }

        if (!uploadedFilePath) {
            throw new Error('El servidor no devolvió una ruta válida');
        }

        setTimeout(() => {
            renderDatasetSummary(data.info || null, file);
            renderDataPreview(data.info || null);
            updateDashboardDatasetStats(data.info || null);
            progressEl.classList.add('hidden');
            Animations.showToast('Archivo subido correctamente', 'success');
        }, 500);
    })
    .catch(err => {
        clearInterval(interval);
        progressEl.classList.add('hidden');
        Animations.showToast('Error al subir: ' + err.message, 'error');
    });
}

function showFileInfo(file, info = null) {
    renderDatasetSummary(info, file);
}

function renderDatasetSummary(info = null, file = null) {
    const infoEl = document.getElementById('file-info');
    const nameEl = document.getElementById('file-name');
    const sizeEl = document.getElementById('file-size');
    const statusEl = document.getElementById('file-status');

    if (!infoEl || !nameEl || !sizeEl || !statusEl) return;

    nameEl.textContent = info?.nombre || file?.name || '--';
    sizeEl.textContent = file?.size ? formatFileSize(file.size) : info?.registros ? `${info.registros} filas cargadas` : '--';
    if (statusEl) {
        statusEl.textContent = info?.registros ? `${info.registros} filas` : 'Listo';
    }

    infoEl.classList.remove('hidden');
    infoEl.style.opacity = '0';
    infoEl.style.transform = 'translateY(10px)';
    infoEl.style.transition = 'all 0.4s ease';

    requestAnimationFrame(() => {
        infoEl.style.opacity = '1';
        infoEl.style.transform = 'translateY(0)';
    });

    const previewEl = document.getElementById('data-preview');
    if (previewEl) {
        previewEl.classList.toggle('hidden', !info);
    }
}

function renderDataPreview(info) {
    const previewEl = document.getElementById('data-preview');
    const headEl = document.getElementById('preview-table-head');
    const bodyEl = document.getElementById('preview-table-body');
    const rowCountEl = document.getElementById('preview-row-count');
    const colCountEl = document.getElementById('preview-col-count');

    if (!previewEl || !headEl || !bodyEl) return;

    if (!info || !Array.isArray(info.columnas) || !Array.isArray(info.preview)) {
        rowCountEl.textContent = '0 filas';
        colCountEl.textContent = '0 columnas';
        headEl.innerHTML = '<tr><th class="px-6 py-3 text-[10px] font-mono text-on-surface-variant/50 uppercase tracking-widest">Sin datos</th></tr>';
        bodyEl.innerHTML = '<tr><td class="px-6 py-6 text-center text-on-surface-variant/40">No se pudo cargar la vista previa</td></tr>';
        previewEl.classList.remove('hidden');
        return;
    }

    const columns = info.columnas;
    const rows = info.preview;

    rowCountEl.textContent = `${info.registros || rows.length} filas`;
    colCountEl.textContent = `${columns.length} columnas`;

    headEl.innerHTML = `
        <tr>
            ${columns.map(col => `<th class="px-6 py-3 text-[10px] font-mono text-on-surface-variant/60 uppercase tracking-widest whitespace-nowrap">${escapeHtml(col)}</th>`).join('')}
        </tr>
    `;

    bodyEl.innerHTML = rows.map(row => `
        <tr class="border-b border-outline-variant/5 hover:bg-surface-container-high transition-colors">
            ${columns.map(col => `<td class="px-6 py-3 whitespace-nowrap">${formatPreviewCell(row[col])}</td>`).join('')}
        </tr>
    `).join('');

    previewEl.classList.remove('hidden');
}

function formatPreviewCell(value) {
    if (value === null || value === undefined || value === '') {
        return '<span class="text-on-surface-variant/30">--</span>';
    }

    if (typeof value === 'number') {
        return String(value);
    }

    return escapeHtml(String(value));
}

function escapeHtml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function clearDatasetData() {
    uploadedFilePath = '';
    localStorage.removeItem(DATASET_STORAGE_KEY);
    localStorage.removeItem(DATASET_PATH_STORAGE_KEY);

    const fileInfoEl = document.getElementById('file-info');
    const previewEl = document.getElementById('data-preview');
    const rowsEl = document.getElementById('dataset-rows');
    const fileNameEl = document.getElementById('dataset-file-name');

    if (fileInfoEl) {
        fileInfoEl.classList.add('hidden');
    }

    if (previewEl) {
        previewEl.classList.add('hidden');
    }

    const headEl = document.getElementById('preview-table-head');
    const bodyEl = document.getElementById('preview-table-body');
    const rowCountEl = document.getElementById('preview-row-count');
    const colCountEl = document.getElementById('preview-col-count');

    if (headEl) {
        headEl.innerHTML = '<tr><th class="px-6 py-3 text-[10px] font-mono text-on-surface-variant/50 uppercase tracking-widest">Sin datos</th></tr>';
    }

    if (bodyEl) {
        bodyEl.innerHTML = '<tr><td class="px-6 py-6 text-center text-on-surface-variant/40">Sube un archivo para ver la vista previa real</td></tr>';
    }

    if (rowCountEl) {
        rowCountEl.textContent = '0 filas';
    }

    if (colCountEl) {
        colCountEl.textContent = '0 columnas';
    }

    if (rowsEl) {
        rowsEl.textContent = '--';
    }

    if (fileNameEl) {
        fileNameEl.textContent = 'Sube un archivo para ver el total';
    }

    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.value = '';
    }

    Animations.showToast('Data limpiada', 'info');
}

function updateDashboardDatasetStats(info = null) {
    const rowsEl = document.getElementById('dataset-rows');
    const fileNameEl = document.getElementById('dataset-file-name');

    if (rowsEl) {
        rowsEl.textContent = info?.registros ?? '--';
    }

    if (fileNameEl) {
        fileNameEl.textContent = info?.nombre ? `Archivo: ${info.nombre}` : 'Sube un archivo para ver el total';
    }
}

function getAccuracyInterpretation(accuracy) {
    if (accuracy >= 95) return 'Precisión excelente. El modelo clasifica con mucha consistencia para este dataset.';
    if (accuracy >= 90) return 'Precisión alta. El modelo es útil, aunque todavía puede mejorar en algunos casos.';
    if (accuracy >= 80) return 'Precisión aceptable. Conviene revisar más datos o ajustar el entrenamiento.';
    return 'Precisión baja. El modelo necesita más datos, limpieza del dataset o ajuste de parámetros.';
}

function syncParamFromRange(param, value) {
    const formatted = formatParamValue(param, value);
    const numberInput = document.getElementById(`${param}-input`);

    if (numberInput) {
        numberInput.value = param === 'energy' ? Number(value).toFixed(2) : Number(value).toFixed(1);
    }

    document.getElementById(`${param}-value`).textContent = formatted;
}

function syncParamFromInput(param, value) {
    const rangeEl = document.getElementById(`pred-${param === 'energy' ? 'energia' : param === 'freq' ? 'frecuencia' : 'duracion'}`);
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) return;

    if (rangeEl) {
        rangeEl.value = numericValue;
    }

    syncParamFromRange(param, numericValue);
}

function formatParamValue(param, value) {
    const unit = param === 'energy' ? 'J' : param === 'dur' ? 's' : 'Hz';
    const decimals = param === 'energy' ? 2 : 1;
    return `${Number(value).toFixed(decimals)} ${unit}`;
}

// =====================================================
// FUNCIONES DE ENTRENAMIENTO
// =====================================================

function entrenarModelo() {
    if (!uploadedFilePath) {
        Animations.showToast('Primero sube un dataset', 'warning');
        return;
    }

    const btn = document.getElementById('train-btn');
    const btnText = document.getElementById('train-btn-text');
    const progressEl = document.getElementById('train-progress');
    const barEl = document.getElementById('train-bar');
    const percentEl = document.getElementById('train-percent');
    const statusEl = document.getElementById('train-status');

    btn.disabled = true;
    btnText.textContent = 'Entrenando...';
    progressEl.classList.remove('hidden');

    const statuses = [
        'Cargando dataset...',
        'Preprocesando características...',
        'Escalando datos...',
        'Entrenando clasificador MLP...',
        'Optimizando pesos...',
        'Finalizando modelo...'
    ];

    let progress = 0;
    let statusIndex = 0;

    const interval = setInterval(() => {
        progress += Math.random() * 8 + 2;
        if (progress > 95) progress = 95;
        barEl.style.width = progress + '%';
        percentEl.textContent = Math.floor(progress) + '%';
        if (progress > (statusIndex + 1) * 16 && statusIndex < statuses.length - 1) {
            statusIndex++;
            statusEl.textContent = statuses[statusIndex];
        }
    }, 300);

    fetch('/entrenar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruta: uploadedFilePath })
    })
    .then(async r => {
        clearInterval(interval);
        const text = await r.text();
        
        const contentType = r.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            console.error('RESPUESTA DEL SERVIDOR (NO JSON):', text.substring(0, 500));
            throw new Error(`El servidor devolvió ${r.status} ${r.statusText} (HTML/Texto). Revisa los logs de Render.`);
        }

        try {
            return JSON.parse(text);
        } catch (e) {
            console.error('TEXTO RECIBIDO:', text.substring(0, 500));
            throw new Error('El servidor respondió con texto que no es JSON válido');
        }
    })
    .then(data => {
        barEl.style.width = '100%';
        percentEl.textContent = '100%';
        statusEl.textContent = '¡Completado!';

        if (data.error) {
            throw new Error(data.error);
        }

        setTimeout(() => {
            showTrainingResult(data.accuracy);
            isModelTrained = true;
            updateTrainingWidget(data.accuracy);
            saveTrainingAccuracy(data.accuracy);

            btn.disabled = false;
            btnText.textContent = 'Entrenar Modelo';
            progressEl.classList.add('hidden');

            Animations.showToast(`Modelo entrenado con ${data.accuracy}% de precisión`, 'success');
        }, 500);
    })
    .catch(err => {
        btn.disabled = false;
        btnText.textContent = 'Entrenar Modelo';
        progressEl.classList.add('hidden');
        statusEl.textContent = 'Error';
        
        Animations.showToast('Error en entrenamiento: ' + err.message, 'error');
        console.error('Error completo:', err);
    });
}

function showTrainingResult(accuracy) {
    const resultEl = document.getElementById('train-result');
    const accuracyEl = document.getElementById('accuracy-value');
    const interpretationEl = document.getElementById('accuracy-interpretation');

    accuracyEl.textContent = accuracy;
    if (interpretationEl) {
        interpretationEl.textContent = getAccuracyInterpretation(Number(accuracy));
    }
    resultEl.classList.remove('hidden');

    resultEl.style.opacity = '0';
    resultEl.style.transform = 'scale(0.95)';
    resultEl.style.transition = 'all 0.5s ease';

    requestAnimationFrame(() => {
        resultEl.style.opacity = '1';
        resultEl.style.transform = 'scale(1)';
    });

    Animations.animateCounter(accuracyEl, accuracy, 1500);
}

function renderResultsView() {
    const container = document.querySelector('.results-view');
    if (!container) return;

    const prediction = loadStoredPrediction();
    const accuracy = loadStoredTrainingAccuracy();
    const displayTipo = normalizeEventType(prediction?.tipo);
    const probs = prediction?.probabilidades || {};
    const ordered = ['VT', 'VD', 'LP', 'LH', 'TD'];

    const tipo = displayTipo || '--';
    const confianza = prediction?.confianza ? (prediction.confianza * 100).toFixed(2) : '--';
    const interpretacion = prediction?.interpretacion || 'Todavía no hay una predicción guardada para interpretar.';
    const fecha = prediction?.fecha ? new Date(prediction.fecha).toLocaleString('es-ES') : '--';
    const accuracyValue = accuracy !== null ? accuracy.toFixed(2) : '--';
    const accuracyText = accuracy !== null ? getAccuracyInterpretation(accuracy) : 'Entrena el modelo para ver la interpretación de la precisión.';
    const modelStatus = accuracy !== null
        ? (accuracy >= 95 ? 'Alta confianza' : accuracy >= 90 ? 'Confianza buena' : accuracy >= 80 ? 'Confianza media' : 'Confianza baja')
        : '--';

    container.innerHTML = `
        <div class="space-y-6">
            <div class="flex items-center justify-between">
                <div>
                    <h2 class="font-display font-semibold text-2xl text-on-surface">Resultado de la Clasificación</h2>
                    <p class="text-sm text-on-surface-variant/60 mt-1">Resumen claro del último análisis realizado</p>
                </div>
                <div class="flex gap-2">
                    <button class="px-4 py-2 bg-surface-container-high rounded-lg text-xs font-mono text-on-surface-variant hover:text-on-surface transition-colors border border-outline-variant/20 flex items-center gap-2">
                        <span class="material-symbols-outlined text-sm">filter_list</span>
                        Filtrar
                    </button>
                    <button class="px-4 py-2 bg-primary-container rounded-lg text-xs font-mono text-on-primary hover:brightness-110 transition-all flex items-center gap-2">
                        <span class="material-symbols-outlined text-sm">download</span>
                        Exportar
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div class="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
                    <span class="text-[10px] font-mono text-on-surface-variant/40 uppercase tracking-widest block mb-2">Resultado Principal</span>
                    <span class="font-display text-2xl font-bold text-primary">${tipo}</span>
                    <p class="text-[10px] font-mono text-primary mt-2">${prediction?.tipo ? 'Última predicción guardada' : 'Sin predicción guardada'}</p>
                </div>
                <div class="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
                    <span class="text-[10px] font-mono text-on-surface-variant/40 uppercase tracking-widest block mb-2">Confianza</span>
                    <span class="font-display text-2xl font-bold text-secondary">${confianza}%</span>
                    <div class="mt-2 w-full bg-surface-container-highest rounded-full h-1 overflow-hidden">
                        <div class="h-full bg-secondary rounded-full" style="width:${prediction ? confianza : 0}%"></div>
                    </div>
                </div>
                <div class="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
                    <span class="text-[10px] font-mono text-on-surface-variant/40 uppercase tracking-widest block mb-2">Acierto del Modelo</span>
                    <span class="font-display text-2xl font-bold text-tertiary">${accuracyValue}%</span>
                    <p class="text-[10px] font-mono text-tertiary mt-2">${modelStatus}</p>
                </div>
                <div class="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
                    <span class="text-[10px] font-mono text-on-surface-variant/40 uppercase tracking-widest block mb-2">Fecha y Hora</span>
                    <span class="font-display text-xl font-bold text-on-surface">${fecha}</span>
                    <p class="text-[10px] font-mono text-on-surface-variant/40 mt-2">Última clasificación</p>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="bg-surface-container rounded-xl border border-outline-variant/20 p-6">
                    <div class="flex items-center justify-between mb-6">
                        <div>
                            <h3 class="font-display font-semibold text-on-surface">Interpretación del Evento</h3>
                            <p class="text-[11px] text-on-surface-variant/50 font-mono mt-0.5">Lectura automática del modelo</p>
                        </div>
                        <span class="material-symbols-outlined text-on-surface-variant/30">analytics</span>
                    </div>

                    <div class="rounded-2xl bg-surface-dim border border-outline-variant/10 p-5 mb-5">
                        <div class="flex items-center gap-3 mb-4">
                            <span class="text-2xl">🌋</span>
                            <div>
                                <h4 class="font-display font-semibold text-on-surface">${tipo}</h4>
                                <p class="text-[10px] font-mono text-on-surface-variant/50 uppercase tracking-widest">Modelo Neuronal Artificial</p>
                            </div>
                        </div>
                        <p class="text-sm text-on-surface-variant leading-relaxed whitespace-pre-line">${interpretacion}</p>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div class="bg-surface-dim rounded-lg p-4 border border-outline-variant/10">
                            <span class="text-[10px] font-mono text-on-surface-variant/40 uppercase tracking-widest block mb-1">Frecuencia</span>
                            <span class="text-sm font-mono text-secondary">${prediction ? `${Number(prediction.frecuencia).toFixed(2)} Hz` : '--'}</span>
                        </div>
                        <div class="bg-surface-dim rounded-lg p-4 border border-outline-variant/10">
                            <span class="text-[10px] font-mono text-on-surface-variant/40 uppercase tracking-widest block mb-1">Duración</span>
                            <span class="text-sm font-mono text-primary">${prediction ? `${Number(prediction.duracion).toFixed(2)} s` : '--'}</span>
                        </div>
                        <div class="bg-surface-dim rounded-lg p-4 border border-outline-variant/10">
                            <span class="text-[10px] font-mono text-on-surface-variant/40 uppercase tracking-widest block mb-1">Energía</span>
                            <span class="text-sm font-mono text-tertiary">${prediction ? `${Number(prediction.energia).toFixed(2)} J` : '--'}</span>
                        </div>
                    </div>
                </div>

                <div class="bg-surface-container rounded-xl border border-outline-variant/20 p-6">
                    <div class="flex items-center justify-between mb-6">
                        <div>
                            <h3 class="font-display font-semibold text-on-surface">Probabilidades</h3>
                            <p class="text-[11px] text-on-surface-variant/50 font-mono mt-0.5">Distribución por clase</p>
                        </div>
                        <span class="material-symbols-outlined text-on-surface-variant/30">bar_chart</span>
                    </div>

                    <div class="space-y-4">
                        ${ordered.map((clase) => {
                            const prob = getClassProbability(probs, clase) * 100;
                            const classes = {
                                VT: ['bg-primary', 'text-primary'],
                                VD: ['bg-secondary', 'text-secondary'],
                                LP: ['bg-tertiary', 'text-tertiary'],
                                LH: ['bg-error', 'text-error'],
                                TD: ['bg-primary', 'text-primary']
                            };
                            const [barClass, textClass] = classes[clase];
                            return `
                                <div class="grid grid-cols-[44px_1fr_64px] gap-3 items-center">
                                    <span class="text-[10px] font-mono ${textClass} uppercase tracking-widest">${clase}</span>
                                    <div class="bg-surface-dim rounded-full h-3 overflow-hidden border border-outline-variant/10">
                                        <div class="${barClass} h-full rounded-full" style="width:${prob}%"></div>
                                    </div>
                                    <span class="text-[10px] font-mono text-on-surface-variant text-right">${prob.toFixed(2)}%</span>
                                </div>
                            `;
                        }).join('')}
                    </div>

                    <div class="mt-6 rounded-2xl bg-[#120d0b] border border-outline-variant/10 p-5">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-[10px] font-mono text-on-surface-variant/50 uppercase tracking-widest">Lectura Rápida</span>
                            <span class="text-[10px] font-mono text-secondary uppercase tracking-widest">${modelStatus}</span>
                        </div>
                        <p class="text-sm text-on-surface-variant leading-relaxed">${accuracyText}</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    Animations.staggerFadeIn(container, '.bg-surface-container', 80);
}

function updateTrainingWidget(accuracy) {
    const widget = document.getElementById('training-widget');
    const progress = document.getElementById('training-progress');
    const status = document.getElementById('training-status');

    widget.style.opacity = '1';
    widget.style.transform = 'translateY(0)';

    setTimeout(() => {
        progress.style.width = accuracy + '%';
        status.textContent = `Modelo cargado • ${accuracy}% precisión`;
    }, 300);
}

// =====================================================
// PREDICCIÓN POR REGLAS (SIN MODELO - PREDICCIÓN RÁPIDA)
// =====================================================

function predictFromDashboardRules() {
    const frecuencia = parseFloat(document.getElementById('dash-frecuencia').value);
    const duracion = parseFloat(document.getElementById('dash-duracion').value);
    const energia = parseFloat(document.getElementById('dash-energia').value);

    if (!frecuencia || !duracion || !energia) {
        Animations.showToast('Completa todos los parámetros', 'warning');
        return;
    }

    const btn = document.getElementById('dash-predict-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin">refresh</span> Analizando...';

    // Calcular puntuación para cada tipo
    function calcularScore(tipo) {
        const p = PERFILES_SISMICOS[tipo];
        
        // Distancia normalizada al centro de cada rango (0 = perfecto, 1 = límite)
        const dFreq = Math.abs(frecuencia - (p.freq[0] + p.freq[1]) / 2) / ((p.freq[1] - p.freq[0]) / 2);
        const dDur = Math.abs(duracion - (p.dur[0] + p.dur[1]) / 2) / ((p.dur[1] - p.dur[0]) / 2);
        const dEng = Math.abs(energia - (p.eng[0] + p.eng[1]) / 2) / ((p.eng[1] - p.eng[0]) / 2);
        
        // Peso: frecuencia 40%, duración 30%, energía 30%
        const score = Math.max(0, 1 - (dFreq * 0.4 + dDur * 0.3 + dEng * 0.3));
        return score;
    }

    // Calcular para todos los tipos
    const resultados = Object.keys(PERFILES_SISMICOS).map(tipo => ({
        tipo,
        score: calcularScore(tipo),
        ...PERFILES_SISMICOS[tipo]
    }));

    // Ordenar por puntuación descendente
    resultados.sort((a, b) => b.score - a.score);
    
    const ganador = resultados[0];
    const segundo = resultados[1];
    
    // Normalizar scores a probabilidades
    const totalScore = resultados.reduce((sum, r) => sum + r.score, 0);
    const probabilidades = {};
    resultados.forEach(r => {
        probabilidades[r.tipo] = totalScore > 0 ? r.score / totalScore : 0.2;
    });

    const confianza = probabilidades[ganador.tipo] * 100;

    // Determinar parámetro más determinante
    const p = ganador;
    const dFreq = Math.abs(frecuencia - (p.freq[0] + p.freq[1]) / 2) / ((p.freq[1] - p.freq[0]) / 2);
    const dDur = Math.abs(duracion - (p.dur[0] + p.dur[1]) / 2) / ((p.dur[1] - p.dur[0]) / 2);
    const dEng = Math.abs(energia - (p.eng[0] + p.eng[1]) / 2) / ((p.eng[1] - p.eng[0]) / 2);
    
    const determinantes = [
        ["Frecuencia", frecuencia, "Hz", 1 - dFreq],
        ["Duración", duracion, "s", 1 - dDur],
        ["Energía", energia, "J", 1 - dEng]
    ];
    determinantes.sort((a, b) => b[3] - a[3]);
    const [paramClave, valClave, unidad, tipicidad] = determinantes[0];

    // Construir interpretación detallada
    let interpretacion = `🌋 ${ganador.nombre}

📊 ¿Por qué esta clasificación?
Este evento se clasificó como ${ganador.tipo} porque sus parámetros de entrada se alinean fuertemente con el perfil típico de este tipo de evento sísmico.

🔬 Análisis de parámetros ingresados:
• Frecuencia: ${frecuencia.toFixed(2)} Hz → ${ganador.caracteristicas.frecuencia}
• Duración: ${duracion.toFixed(2)} s → ${ganador.caracteristicas.duracion}
• Energía: ${energia.toFixed(2)} J → ${ganador.caracteristicas.energia}

🎯 Parámetro más determinante: ${paramClave.toUpperCase()} (${valClave.toFixed(2)} ${unidad})
Este valor tiene un ${(tipicidad * 100).toFixed(0)}% de coincidencia con el perfil típico de ${ganador.tipo}, lo que fue clave para la clasificación.

📖 Descripción:
${ganador.desc}

🔍 Causa física:
${ganador.causa}

⚠️ Implicación volcánica:
${ganador.implicacion}`;

    // Si hay ambigüedad significativa
    if (segundo.score > 0.25) {
        interpretacion += `\n\n⚡ Nota de ambigüedad: El modelo detectó una similitud del ${(segundo.score * 100).toFixed(1)}% con ${segundo.tipo} (${segundo.nombre}). Esto sugiere que el evento podría tener características mixtas o estar en una fase de transición entre ambos tipos.`;
    }

    // Mostrar resultado
    mostrarResultadoDashboardRules({
        tipo: ganador.tipo,
        confianza: confianza,
        probabilidades: probabilidades,
        interpretacion: interpretacion,
        parametros_entrada: { frecuencia, duracion, energia }
    });

    btn.disabled = false;
    btn.innerHTML = '<span class="material-symbols-outlined">auto_fix_high</span> Ejecutar Clasificación';
}

function mostrarResultadoDashboardRules(data) {
    const resultEl = document.getElementById('dash-result');
    const tipoEl = document.getElementById('dash-result-type');
    const barEl = document.getElementById('dash-result-bar');
    const probEl = document.getElementById('dash-result-prob');

    resultEl.classList.remove('hidden');
    resultEl.style.opacity = '0';
    resultEl.style.transform = 'translateY(10px)';
    resultEl.style.transition = 'all 0.4s ease';

    requestAnimationFrame(() => {
        resultEl.style.opacity = '1';
        resultEl.style.transform = 'translateY(0)';
    });

    const colors = {
        'VT': ['text-primary', 'bg-primary'],
        'VD': ['text-secondary', 'bg-secondary'],
        'LP': ['text-tertiary', 'bg-tertiary'],
        'LH': ['text-error', 'bg-error'],
        'TD': ['text-primary', 'bg-primary']
    };

    const [textColor, barColor] = colors[data.tipo] || colors['VT'];

    tipoEl.textContent = data.tipo;
    tipoEl.className = 'text-sm font-bold font-display ' + textColor;

    barEl.className = 'h-full rounded-full transition-all duration-1000 ' + barColor;
    barEl.style.width = '0%';

    setTimeout(() => {
        barEl.style.width = data.confianza + '%';
    }, 100);

    probEl.textContent = data.confianza.toFixed(1) + '% de confianza';

    // Guardar para la vista de Resultados
    const payload = {
        tipo: data.tipo,
        interpretacion: data.interpretacion,
        probabilidades: data.probabilidades,
        frecuencia: data.parametros_entrada.frecuencia,
        duracion: data.parametros_entrada.duracion,
        energia: data.parametros_entrada.energia,
        confianza: data.confianza / 100,
        fecha: new Date().toISOString(),
        metodo: 'reglas'  // Indica que fue por reglas, no por modelo
    };
    localStorage.setItem(LAST_PREDICTION_KEY, JSON.stringify(payload));

    Animations.showToast(`Clasificado como: ${data.tipo} (por reglas)`, 'success');
}

// =====================================================
// PREDICCIÓN CON MODELO ENTRENADO (PREDICCIÓN TAB)
// =====================================================

function updateParamDisplay(param, value, unit) {
    document.getElementById(param + '-value').textContent = parseFloat(value).toFixed(param === 'energy' ? 2 : 1) + ' ' + unit;
}

function setPreset(freq, dur, energy) {
    document.getElementById('pred-frecuencia').value = freq;
    document.getElementById('pred-duracion').value = dur;
    document.getElementById('pred-energia').value = energy;

    const freqInput = document.getElementById('freq-input');
    const durInput = document.getElementById('dur-input');
    const energyInput = document.getElementById('energy-input');

    if (freqInput) freqInput.value = Number(freq).toFixed(1);
    if (durInput) durInput.value = Number(dur).toFixed(0);
    if (energyInput) energyInput.value = Number(energy).toFixed(2);

    syncParamFromRange('freq', freq);
    syncParamFromRange('dur', dur);
    syncParamFromRange('energy', energy);

    Animations.pulse(document.querySelector('.param-group'), 'primary');
}

function runPrediction() {
    const frecuencia = parseFloat(document.getElementById('pred-frecuencia').value);
    const duracion = parseFloat(document.getElementById('pred-duracion').value);
    const energia = parseFloat(document.getElementById('pred-energia').value);

    if (!frecuencia || !duracion || !energia) {
        Animations.showToast('Completa todos los parámetros', 'warning');
        return;
    }

    const btn = document.getElementById('predict-btn');
    const btnText = document.getElementById('predict-btn-text');
    const processingEl = document.getElementById('result-processing');

    btn.disabled = true;
    btnText.textContent = 'Procesando...';
    processingEl.classList.remove('hidden');

    fetch('/predecir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            frecuencia: frecuencia,
            duracion: duracion,
            energia: energia
        })
    })
    .then(r => r.json())
    .then(data => {
        processingEl.classList.add('hidden');
        btn.disabled = false;
        btnText.textContent = 'Ejecutar Clasificación';

        showPredictionResult(data);
        addToHistory(data, frecuencia, duracion, energia);
        saveLastPrediction(data, frecuencia, duracion, energia);

        Animations.showToast(`Clasificado como: ${data.tipo}`, 'success');
    })
    .catch(err => {
        processingEl.classList.add('hidden');
        btn.disabled = false;
        btnText.textContent = 'Ejecutar Clasificación';
        Animations.showToast('Error en predicción: ' + err.message, 'error');
    });
}

function showPredictionResult(data) {
    const emptyEl = document.getElementById('result-empty');
    const contentEl = document.getElementById('result-content');
    const tipoEl = document.getElementById('result-tipo');
    const interpretacionEl = document.getElementById('result-interpretacion');
    const barsEl = document.getElementById('prob-bars');
    const confidenceChartEl = document.getElementById('confidence-chart');
    const resultIcon = document.getElementById('result-icon');
    const resultIconSymbol = document.getElementById('result-icon-symbol');

    emptyEl.classList.add('hidden');
    contentEl.classList.remove('hidden');

    contentEl.style.opacity = '0';
    contentEl.style.transform = 'translateY(10px)';
    contentEl.style.transition = 'all 0.5s ease';

    requestAnimationFrame(() => {
        contentEl.style.opacity = '1';
        contentEl.style.transform = 'translateY(0)';
    });

    const colors = {
        'VT': 'text-primary',
        'VD': 'text-secondary',
        'LP': 'text-tertiary',
        'LH': 'text-error',
        'TD': 'text-primary',
        'TO': 'text-primary'
    };

    const iconConfig = {
        'VT': { icon: 'volcano', tint: 'bg-primary/10 text-primary' },
        'VD': { icon: 'waves', tint: 'bg-secondary/10 text-secondary' },
        'LP': { icon: 'humidity_low', tint: 'bg-tertiary/10 text-tertiary' },
        'LH': { icon: 'flare', tint: 'bg-error/10 text-error' },
        'TD': { icon: 'cloud', tint: 'bg-primary/10 text-primary' },
        'TO': { icon: 'cloud', tint: 'bg-primary/10 text-primary' }
    };

    const activeIcon = iconConfig[data.tipo] || iconConfig.VT;

    tipoEl.textContent = data.tipo;
    tipoEl.className = 'font-display font-bold text-3xl ' + (colors[data.tipo] || 'text-on-surface');

    if (resultIcon) {
        resultIcon.className = `w-14 h-14 rounded-full flex items-center justify-center ${activeIcon.tint}`;
    }

    if (resultIconSymbol) {
        resultIconSymbol.textContent = activeIcon.icon;
        resultIconSymbol.className = `material-symbols-outlined text-2xl ${colors[data.tipo] || 'text-primary'}`;
    }

    if (interpretacionEl) {
        interpretacionEl.textContent = data.interpretacion || 'Sin interpretación disponible.';
    }

    barsEl.innerHTML = '';
    if (confidenceChartEl) {
        confidenceChartEl.innerHTML = '';
    }
    const probs = data.probabilidades || {};
    const topProbability = Number(data.confianza || 0);
    const ranking = Array.isArray(data.ranking) ? data.ranking : Object.entries(probs).sort((a, b) => b[1] - a[1]);
    const topType = normalizeEventType(data.tipo);

    if (confidenceChartEl) {
        confidenceChartEl.insertAdjacentHTML('beforeend', `
            <div class="mb-4 rounded-xl bg-surface-dim border border-outline-variant/10 p-4">
                <div class="flex items-center justify-between gap-4">
                    <div>
                        <span class="text-[10px] font-mono text-on-surface-variant/50 uppercase tracking-widest block mb-1">Mayor probabilidad</span>
                        <h4 class="font-display text-lg font-semibold text-on-surface">${topType}</h4>
                    </div>
                    <div class="text-right">
                        <span class="text-2xl font-display font-bold text-secondary">${topProbability.toFixed(2)}%</span>
                        <p class="text-[10px] font-mono text-on-surface-variant/40 uppercase">Confianza</p>
                    </div>
                </div>
                <div class="mt-3 text-[10px] font-mono text-on-surface-variant/50 uppercase tracking-widest">Ranking de clases</div>
                <div class="mt-2 space-y-2">
                    ${ranking.map(([clase, prob]) => `
                        <div class="flex items-center justify-between gap-3">
                            <span class="text-xs font-mono text-on-surface-variant">${normalizeEventType(clase)}</span>
                            <div class="flex-1 bg-surface-container-highest rounded-full h-2 overflow-hidden">
                                <div class="${getClassBarColor(clase)} h-full rounded-full" style="width:${(prob * 100).toFixed(2)}%"></div>
                            </div>
                            <span class="text-[10px] font-mono text-on-surface-variant w-12 text-right">${(prob * 100).toFixed(2)}%</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `);
    }

    const chartOrder = ['VT', 'VD', 'LP', 'LH', 'TD'];

    chartOrder.forEach((clase) => {
        const prob = probs[clase] || 0;
        const classColors = {
            'VT': ['bg-primary', 'text-primary'],
            'VD': ['bg-secondary', 'text-secondary'],
            'LP': ['bg-tertiary', 'text-tertiary'],
            'LH': ['bg-error', 'text-error'],
            'TD': ['bg-primary', 'text-primary'],
            'TO': ['bg-primary', 'text-primary']
        };
        const [barColor, textColor] = classColors[clase] || ['bg-surface-variant', 'text-on-surface-variant'];

        const barHtml = `
            <div class="flex items-center gap-3">
                <span class="text-xs font-mono text-on-surface-variant w-20">${clase}</span>
                <div class="flex-1 bg-surface-container-highest rounded-full h-2 overflow-hidden">
                    <div class="${barColor} h-full rounded-full transition-all duration-1000" style="width: 0%" data-width="${(prob * 100).toFixed(1)}%"></div>
                </div>
                <span class="text-xs font-mono ${textColor} w-12 text-right">${(prob * 100).toFixed(1)}%</span>
            </div>
        `;
        barsEl.insertAdjacentHTML('beforeend', barHtml);
    });

    setTimeout(() => {
        barsEl.querySelectorAll('[data-width]').forEach(bar => {
            bar.style.width = bar.dataset.width;
        });
    }, 100);

    updateVolcanoAnimation(data.tipo, probs);
}

function updateVolcanoAnimation(tipo, probs) {
    const lavaGlow = document.getElementById('lava-glow');
    const lavaStream = document.getElementById('lava-stream');
    const eruptionSmoke = document.getElementById('eruption-smoke');
    const eruptionLabel = document.getElementById('eruption-label');

    const intensity = Math.round(((probs[tipo] || 0) * 100));

    if (lavaGlow) {
        lavaGlow.classList.add('opacity-100');
        lavaGlow.style.animation = 'none';
        lavaGlow.offsetHeight;
        lavaGlow.style.animation = '';
    }

    if (lavaStream) {
        lavaStream.style.height = `${Math.max(24, Math.min(96, intensity))}px`;
        lavaStream.style.opacity = '1';
        lavaStream.style.boxShadow = '0 0 18px rgba(255, 107, 53, 0.45)';
    }

    if (eruptionSmoke) {
        eruptionSmoke.classList.add('eruption-active');
    }

    if (eruptionLabel) {
        eruptionLabel.textContent = `${tipo} • ${intensity}%`;
    }
}

function saveLastPrediction(data, frecuencia, duracion, energia) {
    const confidence = Math.max(...Object.values(data.probabilidades || { [data.tipo]: 0 }));
    const payload = {
        tipo: data.tipo,
        interpretacion: data.interpretacion || '',
        probabilidades: data.probabilidades || {},
        frecuencia,
        duracion,
        energia,
        confianza: confidence,
        fecha: new Date().toISOString()
    };

    localStorage.setItem(LAST_PREDICTION_KEY, JSON.stringify(payload));
}

function addToHistory(data, freq, dur, energy) {
    const now = new Date();
    const time = now.toTimeString().slice(0, 8);

    predictionHistory.unshift({
        time, freq, dur, energy, tipo: data.tipo, probs: data.probabilidades
    });

    if (predictionHistory.length > 10) predictionHistory.pop();

    updateHistoryDisplay();
}

function updateHistoryDisplay() {
    const container = document.getElementById('prediction-history');

    if (predictionHistory.length === 0) {
        container.innerHTML = '<div class="px-6 py-8 text-center text-sm text-on-surface-variant/30">Aún no hay predicciones</div>';
        return;
    }

    const colors = {
        'VT': 'text-primary border-primary/20',
        'VD': 'text-secondary border-secondary/20',
        'LP': 'text-tertiary border-tertiary/20',
        'LH': 'text-error border-error/20',
        'TD': 'text-primary border-primary/20',
        'TO': 'text-primary border-primary/20'
    };

    container.innerHTML = predictionHistory.map((item, i) => `
        <div class="px-6 py-3 border-b border-outline-variant/5 hover:bg-surface-container-high transition-colors flex items-center justify-between" 
             style="animation: slideUp 0.3s ease ${i * 0.05}s both">
            <div class="flex items-center gap-4">
                <span class="text-[10px] font-mono text-on-surface-variant/40">${item.time}</span>
                <span class="text-xs font-mono text-secondary">${item.freq.toFixed(1)} Hz</span>
                <span class="text-xs font-mono text-on-surface-variant/60">${item.dur}s</span>
            </div>
            <span class="px-2 py-0.5 rounded text-[10px] font-semibold border ${colors[item.tipo] || colors['VT']}">${item.tipo}</span>
        </div>
    `).join('');
}

function loadDashboardDatasetStats() {
    try {
        const rawInfo = localStorage.getItem(DATASET_STORAGE_KEY);
        const info = rawInfo ? JSON.parse(rawInfo) : null;
        if (info) {
            uploadedFilePath = localStorage.getItem(DATASET_PATH_STORAGE_KEY) || uploadedFilePath;
        }
        updateDashboardDatasetStats(info);
    } catch (error) {
        updateDashboardDatasetStats(null);
    }
}

function saveTrainingAccuracy(accuracy) {
    localStorage.setItem(LAST_ACCURACY_KEY, String(accuracy));
}

function loadStoredTrainingAccuracy() {
    const raw = localStorage.getItem(LAST_ACCURACY_KEY);
    const accuracy = raw ? Number(raw) : null;
    return Number.isFinite(accuracy) ? accuracy : null;
}

function loadStoredPrediction() {
    try {
        const raw = localStorage.getItem(LAST_PREDICTION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        return null;
    }
}

function loadStoredDatasetView() {
    try {
        const rawInfo = localStorage.getItem(DATASET_STORAGE_KEY);
        const info = rawInfo ? JSON.parse(rawInfo) : null;

        if (!info) {
            renderDatasetSummary(null, null);
            return;
        }

        renderDatasetSummary(info, null);
        renderDataPreview(info);
        updateDashboardDatasetStats(info);
    } catch (error) {
        renderDatasetSummary(null, null);
        renderDataPreview(null);
    }
}

function clearHistory() {
    predictionHistory = [];
    updateHistoryDisplay();
    Animations.showToast('Historial limpiado', 'info');
}

// =====================================================
// TOGGLE DE BARRA LATERAL (móvil)
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('-translate-x-full');
        });
    }
});
