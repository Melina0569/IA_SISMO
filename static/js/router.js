// =====================================================
// ENRUTADOR SPA
// =====================================================

const Router = {
    currentRoute: null,
    routes: {
        dashboard: { title: 'Panel Principal', icon: 'dashboard', file: 'dashboard.html' },
        data: { title: 'Ingesta de Datos', icon: 'dataset', file: 'data.html' },
        prediction: { title: 'Predicción', icon: 'query_stats', file: 'prediction.html' },
        results: { title: 'Resultados', icon: 'analytics', file: 'results.html' }
    },

    init() {
        // Cargar ruta inicial
        this.navigate('dashboard');

        // Manejar navegador atrás/adelante
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.route) {
                this.loadRoute(e.state.route, false);
            }
        });
    },

    navigate(route) {
        if (!this.routes[route]) return;
        if (this.currentRoute === route) return;

        this.loadRoute(route, true);
    },

    async loadRoute(route, pushState = true) {
        const routeConfig = this.routes[route];
        if (!routeConfig) return;

        // Mostrar carga
        this.showLoading(true);

        try {
            // Obtener el HTML de la vista
            const response = await fetch(`/static/views/${routeConfig.file}`);
            const html = await response.text();

            // Actualizar contenido con transición de desvanecimiento
            const contentEl = document.getElementById('content');

            // Desvanecer
            contentEl.style.opacity = '0';
            contentEl.style.transform = 'translateY(8px)';
            contentEl.style.transition = 'opacity 0.2s ease, transform 0.2s ease';

            await new Promise(r => setTimeout(r, 200));

            // Actualizar contenido
            contentEl.innerHTML = html;

            // Actualizar UI
            this.updateActiveNav(route);
            this.updatePageHeader(routeConfig);

            // Aparecer
            contentEl.style.opacity = '1';
            contentEl.style.transform = 'translateY(0)';

            // Guardar estado
            if (pushState) {
                history.pushState({ route }, '', `#${route}`);
            }

            this.currentRoute = route;

            // Inicializar lógica específica de la vista
            this.initView(route);

        } catch (error) {
            console.error('Error al cargar ruta:', error);
            Animations.showToast('Error al cargar la vista', 'error');
        } finally {
            this.showLoading(false);
        }
    },

    updateActiveNav(route) {
        document.querySelectorAll('.nav-item').forEach(item => {
            const itemRoute = item.dataset.route;
            const indicator = item.querySelector('.nav-indicator');

            if (itemRoute === route) {
                item.classList.add('bg-surface-container-high', 'text-on-surface');
                item.classList.remove('text-on-surface-variant');
                indicator.classList.remove('opacity-0');
                indicator.classList.add('opacity-100');
            } else {
                item.classList.remove('bg-surface-container-high', 'text-on-surface');
                item.classList.add('text-on-surface-variant');
                indicator.classList.remove('opacity-100');
                indicator.classList.add('opacity-0');
            }
        });
    },

    updatePageHeader(routeConfig) {
        document.getElementById('page-title').textContent = routeConfig.title;
        document.getElementById('page-icon').textContent = routeConfig.icon;
    },

    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (show) {
            overlay.style.opacity = '1';
            overlay.style.pointerEvents = 'auto';
        } else {
            setTimeout(() => {
                overlay.style.opacity = '0';
                overlay.style.pointerEvents = 'none';
            }, 300);
        }
    },

    initView(route) {
        switch(route) {
            case 'dashboard':
                this.initDashboard();
                break;
            case 'data':
                this.initDataView();
                break;
            case 'prediction':
                this.initPredictionView();
                break;
            case 'results':
                this.initResultsView();
                break;
        }
    },

    initDashboard() {
        if (typeof loadDashboardDatasetStats === 'function') {
            loadDashboardDatasetStats();
        }

        // Animar contadores
        document.querySelectorAll('.counter').forEach(counter => {
            const target = parseInt(counter.dataset.target);
            Animations.animateCounter(counter, target, 1500);
        });

        // Tarjetas escalonadas
        Animations.staggerFadeIn(document.querySelector('.dashboard-view'), '.stat-card', 80);

        // Iniciar forma de onda
        const waveformSvg = document.getElementById('waveform-svg');
        if (waveformSvg) {
            Animations.animateWaveform(waveformSvg);
        }

        // Scroll del feed en vivo
        const feed = document.querySelector('.live-feed-scroll');
        if (feed) {
            feed.style.animation = 'liveFeed 20s linear infinite';
        }
    },

    initDataView() {
        Animations.staggerFadeIn(document.querySelector('.data-view'), '.bg-surface-container', 100);

        if (typeof loadStoredDatasetView === 'function') {
            loadStoredDatasetView();
        }
    },

    initPredictionView() {
        Animations.staggerFadeIn(document.querySelector('.prediction-view'), '.bg-surface-container', 100);

        if (typeof syncParamFromRange === 'function') {
            syncParamFromRange('freq', document.getElementById('pred-frecuencia')?.value || 0);
            syncParamFromRange('dur', document.getElementById('pred-duracion')?.value || 0);
            syncParamFromRange('energy', document.getElementById('pred-energia')?.value || 0);
        }
    },

    initResultsView() {
        Animations.staggerFadeIn(document.querySelector('.results-view'), '.bg-surface-container', 80);

        if (typeof renderResultsView === 'function') {
            renderResultsView();
        }
    }
};

// Inicializar enrutador cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.router = Router;
    Router.init();
});