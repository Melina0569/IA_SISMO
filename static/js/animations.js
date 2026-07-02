// =====================================================
// MOTOR DE ANIMACIONES
// =====================================================

const Animations = {

    // Animación de contador para números
    animateCounter: (element, target, duration = 1500, suffix = '') => {
        const start = 0;
        const startTime = performance.now();

        const update = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const current = Math.floor(start + (target - start) * easeOut);

            element.textContent = current + suffix;

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                element.textContent = target + suffix;
            }
        };

        requestAnimationFrame(update);
    },

    // Desvanecimiento escalonado para hijos
    staggerFadeIn: (container, selector, delay = 50) => {
        const elements = container.querySelectorAll(selector);
        elements.forEach((el, i) => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(12px)';
            el.style.transition = `opacity 0.4s ease ${i * delay}ms, transform 0.4s ease ${i * delay}ms`;

            setTimeout(() => {
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }, 10);
        });
    },

    // Deslizar desde dirección
    slideIn: (element, direction = 'left', duration = 500) => {
        const directions = {
            left: { x: -30, y: 0 },
            right: { x: 30, y: 0 },
            up: { x: 0, y: -20 },
            down: { x: 0, y: 20 }
        };

        const dir = directions[direction] || directions.left;

        element.style.opacity = '0';
        element.style.transform = `translate(${dir.x}px, ${dir.y}px)`;
        element.style.transition = `opacity ${duration}ms ease-out, transform ${duration}ms ease-out`;

        requestAnimationFrame(() => {
            element.style.opacity = '1';
            element.style.transform = 'translate(0, 0)';
        });
    },

    // Efecto de pulso
    pulse: (element, color = 'primary') => {
        const colors = {
            primary: 'rgba(255, 87, 34, 0.3)',
            secondary: 'rgba(112, 216, 200, 0.3)',
            tertiary: 'rgba(162, 201, 255, 0.3)'
        };

        element.style.transition = 'box-shadow 0.3s ease';
        element.style.boxShadow = `0 0 0 4px ${colors[color] || colors.primary}`;

        setTimeout(() => {
            element.style.boxShadow = '0 0 0 0px transparent';
        }, 300);
    },

    // Animación de barra de progreso
    animateProgress: (barElement, targetPercent, duration = 1000) => {
        barElement.style.width = '0%';
        barElement.style.transition = `width ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;

        requestAnimationFrame(() => {
            barElement.style.width = targetPercent + '%';
        });
    },

    // Animación de forma de onda
    animateWaveform: (svgElement) => {
        const path = svgElement.querySelector('#wave-actual');
        if (!path) return;

        let offset = 0;
        const points = [];
        const numPoints = 100;

        for (let i = 0; i < numPoints; i++) {
            points.push(100);
        }

        const animate = () => {
            offset += 0.05;

            for (let i = 0; i < numPoints; i++) {
                const x = (i / numPoints) * 1000;
                const noise = Math.sin(i * 0.3 + offset) * 15 + 
                             Math.sin(i * 0.7 + offset * 1.5) * 10 +
                             Math.sin(i * 1.1 + offset * 0.5) * 5;
                const spike = (i > 40 && i < 60) ? Math.sin((i - 40) * 0.3) * 40 : 0;
                points[i] = 100 + noise + spike;
            }

            let d = `M0,${points[0]}`;
            for (let i = 1; i < numPoints; i++) {
                const x = (i / numPoints) * 1000;
                d += ` L${x},${points[i]}`;
            }

            path.setAttribute('d', d);

            // Mover indicador de tiempo
            const indicator = svgElement.querySelector('#time-indicator');
            if (indicator) {
                const indicatorX = ((Math.sin(offset * 0.5) + 1) / 2) * 800 + 100;
                indicator.setAttribute('x1', indicatorX);
                indicator.setAttribute('x2', indicatorX);
            }

            requestAnimationFrame(animate);
        };

        animate();
    },

    // Efecto máquina de escribir
    typewriter: (element, text, speed = 30) => {
        element.textContent = '';
        let i = 0;

        const type = () => {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
                setTimeout(type, speed);
            }
        };

        type();
    },

    // Notificación tipo toast
    showToast: (message, type = 'info', duration = 3000) => {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');

        const colors = {
            info: 'border-primary/30 bg-surface-container',
            success: 'border-secondary/30 bg-surface-container',
            error: 'border-error/30 bg-surface-container',
            warning: 'border-primary/30 bg-surface-container'
        };

        const icons = {
            info: 'info',
            success: 'check_circle',
            error: 'error',
            warning: 'warning'
        };

        toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border ${colors[type]} shadow-lg min-w-[280px] transform translate-x-full transition-transform duration-300`;
        toast.innerHTML = `
            <span class="material-symbols-outlined text-sm ${type === 'success' ? 'text-secondary' : type === 'error' ? 'text-error' : 'text-primary'}">${icons[type]}</span>
            <span class="text-sm text-on-surface">${message}</span>
        `;

        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(0)';
        });

        setTimeout(() => {
            toast.style.transform = 'translateX(120%)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
};

// =====================================================
// KEYFRAMES CSS (inyectados dinámicamente)
// =====================================================
const style = document.createElement('style');
style.textContent = `
    @keyframes shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
    }

    @keyframes dash {
        from { stroke-dashoffset: 251; }
        to { stroke-dashoffset: 0; }
    }

    @keyframes drawLine {
        from { stroke-dashoffset: 1000; }
        to { stroke-dashoffset: 0; }
    }

    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    @keyframes slideUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }

    @keyframes pulse-ring {
        0% { transform: scale(0.8); opacity: 0.8; }
        100% { transform: scale(2.5); opacity: 0; }
    }

    @keyframes float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-5px); }
    }

    @keyframes liveFeed {
        0% { transform: translateX(0); }
        100% { transform: translateX(-50%); }
    }

    @keyframes lavaPulse {
        0%, 100% { transform: scaleX(1); opacity: 0.75; }
        50% { transform: scaleX(1.08); opacity: 1; }
    }

    @keyframes smokeRise {
        0% { transform: translate(-50%, 0) scale(0.8); opacity: 0; }
        20% { opacity: 0.9; }
        100% { transform: translate(-50%, -50px) scale(1.35); opacity: 0; }
    }

    @keyframes volcanoGlow {
        0%, 100% { filter: drop-shadow(0 0 0 rgba(255, 107, 53, 0)); }
        50% { filter: drop-shadow(0 0 18px rgba(255, 107, 53, 0.55)); }
    }

    .volcano-cone {
        clip-path: polygon(50% 0%, 100% 100%, 0% 100%);
        box-shadow: inset 0 -14px 22px rgba(0, 0, 0, 0.28);
    }

    .volcano-shadow {
        box-shadow: inset 0 10px 24px rgba(255, 255, 255, 0.04);
    }

    .lava-pulse {
        animation: lavaPulse 1.4s ease-in-out infinite;
    }

    .eruption-smoke {
        animation: smokeRise 1.8s ease-out infinite;
    }

    .volcano-glow {
        animation: volcanoGlow 1.6s ease-in-out infinite;
    }

    .animate-slide-up {
        animation: slideUp 0.5s ease-out forwards;
    }

    .animate-fade-in {
        animation: fadeIn 0.4s ease-out forwards;
    }
`;
document.head.appendChild(style);