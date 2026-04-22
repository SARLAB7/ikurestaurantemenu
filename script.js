import { db } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

// --- 1. MANEJO DE PESTAÑAS (TABS) ---
const tabs = document.querySelectorAll('.tab-btn');
const sections = document.querySelectorAll('.menu-section');

tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
        const target = e.target.getAttribute('data-tab');

        // Cambiar estado de botones
        tabs.forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');

        // Cambiar visibilidad de secciones
        sections.forEach(sec => {
            sec.classList.remove('active');
            if (sec.id === target) {
                sec.classList.add('active');
            }
        });
    });
});

// --- 2. CARGA DE DATOS DESDE FIREBASE ---
const renderMenu = () => {
    const q = query(collection(db, "platos"), orderBy("timestamp", "desc"));
    
    onSnapshot(q, (snapshot) => {
        const categories = { diario: '', rapida: '', varios: '' };
        const loader = document.getElementById('loader');
        
        if (loader) loader.style.display = 'none';

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            
            // Formatear precio a moneda
            const formattedPrice = new Intl.NumberFormat('es-CO', {
                style: 'currency',
                currency: 'COP',
                minimumFractionDigits: 0
            }).format(data.precio);

            const dishHTML = `
                <div class="dish-item" onclick="this.classList.toggle('expanded')">
                    <div class="dish-header">
                        <h3>${data.nombre}</h3>
                        <span class="price">${formattedPrice}</span>
                    </div>
                    <p class="description">${data.descripcion || 'Sin descripción disponible'}</p>
                    <div class="ingredients">
                        <p class="ing-label">Ingredientes:</p>
                        <p>${data.ingredientes ? data.ingredientes.join(' • ') : 'Consultar personal'}</p>
                    </div>
                </div>
            `;

            if (categories[data.categoria] !== undefined) {
                categories[data.categoria] += dishHTML;
            }
        });

        // Inyectar el HTML en cada sección
        Object.keys(categories).forEach(cat => {
            const container = document.getElementById(cat);
            if (container) {
                container.innerHTML = categories[cat] || '<p class="empty-msg">Próximamente más delicias...</p>';
            }
        });
    });
};

renderMenu();
