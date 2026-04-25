import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

// CORRECCIÓN ERROR NULL: Añadir verificadores de existencia de elementos
const safeStyle = (id, property, value) => {
    const el = document.getElementById(id);
    if (el) el.style[property] = value; // Esto evita el error "reading style of null"
};

const playNotif = () => {
    const audio = document.getElementById('notif-sound');
    if (audio) audio.play();
};

let lastOrderCount = 0;

// Escuchar Pedidos con Colapsable de Historial
onSnapshot(query(collection(db, "pedidos"), orderBy("timestamp", "desc")), (sn) => {
    const pend = document.getElementById('l-pendientes');
    const aten = document.getElementById('l-atendidos');
    let currentPendings = 0;

    if (!pend || !aten) return; // Evitar errores si los elementos no están cargados

    pend.innerHTML = ''; aten.innerHTML = '';

    sn.docs.forEach(d => {
        const p = d.data();
        if (p.estado === 'pendiente') {
            currentPendings++;
            pend.innerHTML += `<div class="p-card">...</div>`; // Estructura de pedido pendiente
        } else {
            // Lista compacta para despachados para no saturar
            aten.innerHTML += `<div class="atendido-mini"><span>${p.cliente}</span> - $${p.total}</div>`;
        }
    });

    if (currentPendings > lastOrderCount) playNotif();
    lastOrderCount = currentPendings;
});

// Función para colapsar (puedes llamarla desde un botón en admin.html)
window.toggleHistory = () => {
    const wrapper = document.getElementById('atendidos-wrapper');
    if (wrapper) wrapper.classList.toggle('collapsed');
};
