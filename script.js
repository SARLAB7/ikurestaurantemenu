import { db } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

// --- 1. LÓGICA DE PESTAÑAS ---
const tabs = document.querySelectorAll('.tab-btn');
const sections = document.querySelectorAll('.menu-section');

tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
        const target = e.target.getAttribute('data-tab');
        tabs.forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        sections.forEach(sec => {
            sec.classList.remove('active');
            sec.style.display = 'none';
            if (sec.id === target) {
                sec.classList.add('active');
                sec.style.display = 'block';
            }
        });
    });
});

// --- 2. CARGA DE DATOS ---
const renderMenu = () => {
    const q = query(collection(db, "platos"), orderBy("timestamp", "desc"));
    
    onSnapshot(q, (snapshot) => {
        const categories = { diario: '', rapida: '', varios: '' };
        document.getElementById('loader').style.display = 'none';

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const categoriaPlato = data.categoria || 'diario';
            const formattedPrice = new Intl.NumberFormat('es-CO', {
                style: 'currency', currency: 'COP', minimumFractionDigits: 0
            }).format(data.precio);

            // PROCESAR INGREDIENTES: Si es lista lo une, si es texto lo deja igual
            let textoIngredientes = "Consultar con el personal";
            if (data.ingredientes) {
                textoIngredientes = Array.isArray(data.ingredientes) 
                    ? data.ingredientes.join(' • ') 
                    : data.ingredientes;
            }

            const dishHTML = `
                <div class="dish-item" onclick="this.classList.toggle('expanded')">
                    <div class="dish-header">
                        <h3>${data.nombre}</h3>
                        <span class="price">${formattedPrice}</span>
                    </div>
                    <div class="expand-content">
                        <p class="description">${data.descripcion || 'Sin descripción'}</p>
                        <div class="ingredients-box">
                            <span class="ing-label">INGREDIENTES:</span>
                            <p class="ing-list">${textoIngredientes}</p>
                        </div>
                    </div>
                </div>
            `;

            if (categories[categoriaPlato] !== undefined) {
                categories[categoriaPlato] += dishHTML;
            }
        });

        Object.keys(categories).forEach(cat => {
            const container = document.getElementById(cat);
            if (container) {
                container.innerHTML = categories[cat] || '<p style="text-align:center; color:#999; padding:20px;">Próximamente...</p>';
            }
        });
    });
};

renderMenu();
