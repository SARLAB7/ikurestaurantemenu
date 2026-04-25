import { db } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

let carrito = [];

// Sistema de Notificación Moderno
const showToast = (msg) => {
    const t = document.getElementById('toast');
    t.innerText = msg; t.className = "show";
    setTimeout(() => { t.className = t.className.replace("show", ""); }, 3000);
};

window.toggleDish = (el) => {
    const parent = el.parentElement;
    const isOpened = parent.classList.contains('expanded');
    document.querySelectorAll('.dish-item').forEach(i => i.classList.remove('expanded'));
    if (!isOpened) parent.classList.add('expanded');
};

window.addCart = (nombre, precio, id) => {
    const nota = document.getElementById(`note-${id}`).value;
    carrito.push({ nombre, precio, nota });
    showToast(`"${nombre}" añadido al pedido`);
    updateCartUI();
};

// Renderizado del Menú sin errores de filtrado
onSnapshot(query(collection(db, "platos"), orderBy("timestamp", "desc")), (sn) => {
    const containers = { diario: '', rapida: '', varios: '' };
    const counts = { diario: 0, rapida: 0, varios: 0 };

    sn.docs.forEach(doc => {
        const d = doc.data();
        if (d.disponible === false) return;

        const html = `
            <div class="dish-item">
                <div class="dish-header" onclick="toggleDish(this)">
                    <h3>${d.nombre}</h3>
                    <strong>$${new Intl.NumberFormat('es-CO').format(d.precio)}</strong>
                </div>
                <div class="expand-content">
                    <p style="color: #a0a0a0; font-size: 0.9rem; margin-bottom: 10px;">${d.descripcion || ''}</p>
                    <input type="text" id="note-${doc.id}" placeholder="Ej: Sin cebolla..." class="modern-input">
                    <button onclick="addCart('${d.nombre}', ${d.precio}, '${doc.id}')" class="btn-accent">PEDIR ESTE PLATO</button>
                </div>
            </div>`;
        
        // CORRECCIÓN: Asignación única por categoría
        if (containers[d.categoria] !== undefined) {
            containers[d.categoria] += html;
            counts[d.categoria]++;
        }
    });

    // Inyectar y manejar mensaje de "Vacío"
    Object.keys(containers).forEach(cat => {
        const el = document.getElementById(cat);
        if (el) {
            el.innerHTML = counts[cat] > 0 ? containers[cat] : '<p class="empty-msg">Próximamente más delicias...</p>';
        }
    });
});
