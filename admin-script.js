import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, serverTimestamp, addDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

const correosAutorizados = ["cb01grupo@gmail.com", "kelly.araujotafur@gmail.com"];
const formatPrice = (num) => Number(num).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

let menuGlobal = {}; 
let pedidosGlobales = [];

// --- AUTENTICACIÓN ---
onAuthStateChanged(auth, (user) => {
    const loginScreen = document.getElementById('login-screen');
    const adminPanel = document.getElementById('admin-panel');
    if (user && correosAutorizados.includes(user.email)) {
        loginScreen.style.display = 'none';
        adminPanel.style.display = 'flex';
        iniciarAppAdmin();
    } else {
        if (user) signOut(auth);
        loginScreen.style.display = 'flex';
        adminPanel.style.display = 'none';
    }
});

document.getElementById('login-btn').onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
window.logout = () => signOut(auth);

function iniciarAppAdmin() {
    escucharPedidos();
    escucharCarta();
}

// --- MONITOR DE PEDIDOS ---
function escucharPedidos() {
    onSnapshot(query(collection(db, "pedidos"), orderBy("fecha", "desc")), (snapshot) => {
        pedidosGlobales = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const listaActivos = document.getElementById('l-activos');
        const listaAtendidos = document.getElementById('l-atendidos');
        listaActivos.innerHTML = ''; listaAtendidos.innerHTML = '';

        pedidosGlobales.forEach(p => {
            const card = document.createElement('div');
            card.className = `pedido-card state-${p.estado}`;
            card.innerHTML = `
                <div class="order-header">
                    <h4>${p.cliente} <span>(${p.tipo})</span></h4>
                    <button onclick="window.imprimirComanda('${encodeURIComponent(JSON.stringify(p))}')" class="btn-print">🖨️ Comanda</button>
                </div>
                <div class="order-body">
                    ${p.items.map(i => `
                        <p>• ${i.cantidad}x <strong>${i.nombre}</strong> 
                        ${i.excluidos?.length > 0 ? `<br><small style="color:var(--danger)">❌ SIN: ${i.excluidos.join(', ')}</small>` : ''}</p>
                    `).join('')}
                    <hr>
                    <p><strong>Total: ${formatPrice(p.total)}</strong></p>
                </div>
                <div class="order-actions">
                    ${p.estado === 'recibido' ? `<button onclick="window.cambiarEstado('${p.id}', 'preparando')">Cocinar</button>` : ''}
                    ${p.estado === 'preparando' ? `<button onclick="window.cambiarEstado('${p.id}', 'listo')">Listo</button>` : ''}
                    ${p.estado !== 'entregado' ? `<button onclick="window.cambiarEstado('${p.id}', 'entregado')">Entregar</button>` : ''}
                    <button class="btn-danger-outline" onclick="window.eliminarPedido('${p.id}')">🗑️</button>
                </div>
            `;
            p.estado === 'entregado' ? listaAtendidos.appendChild(card) : listaActivos.appendChild(card);
        });
        actualizarMétricas();
        renderizarPlanoMesas();
    });
}

// --- IMPRESIÓN DE COMANDA ---
window.imprimirComanda = (pJsonStr) => {
    const p = JSON.parse(decodeURIComponent(pJsonStr));
    const fecha = new Date().toLocaleString();
    let ticket = `
        <div id="ticket-impresion">
            <h2 style="text-align:center">IKU RESTAURANTE</h2>
            <p><strong>Cliente:</strong> ${p.cliente} | <strong>Tipo:</strong> ${p.tipo}</p>
            <p><strong>Fecha:</strong> ${fecha}</p>
            <hr>
            ${p.items.map(i => `<p>1x <strong>${i.nombre}</strong> ${i.excluidos?.length > 0 ? `<br>- Sin: ${i.excluidos.join(', ')}` : ''}</p>`).join('')}
            <hr>
        </div>`;
    
    const printWindow = window.open('', '', 'width=300,height=600');
    printWindow.document.write(`<html><head><style>body{font-family:monospace;padding:10px}hr{border-top:1px dashed #000}</style></head><body>${ticket}</body></html>`);
    printWindow.document.close();
    printWindow.print();
    printWindow.close();
};

// --- MÉTRICAS Y RANKINGS ---
function actualizarMétricas() {
    let tHoy = 0, tMes = 0, pedidosHoy = 0, nq = 0, bc = 0, ef = 0;
    const ventasPlatos = {};
    const hoy = new Date();

    pedidosGlobales.forEach(p => {
        if (!p.fecha) return;
        const f = p.fecha.toDate();
        const esHoy = f.toDateString() === hoy.toDateString();

        if (esHoy) {
            tHoy += p.total;
            pedidosHoy++;
            if (p.metodoPago === 'nequi') nq += p.total;
            if (p.metodoPago === 'banco') bc += p.total;
            if (p.metodoPago === 'efectivo') ef += p.total;

            p.items.forEach(i => ventasPlatos[i.nombre] = (ventasPlatos[i.nombre] || 0) + 1);
        }
        if (f.getMonth() === hoy.getMonth()) tMes += p.total;
    });

    document.getElementById('s-hoy').innerText = formatPrice(tHoy);
    document.getElementById('s-mes').innerText = formatPrice(tMes);
    document.getElementById('s-nequi').innerText = formatPrice(nq);
    document.getElementById('s-bancolombia').innerText = formatPrice(bc);
    document.getElementById('s-efectivo').innerText = formatPrice(ef);
    document.getElementById('s-ticket-promedio').innerText = formatPrice(pedidosHoy > 0 ? tHoy / pedidosHoy : 0);

    // Ranking de Platos
    const rankingHTML = Object.entries(ventasPlatos)
        .sort((a,b) => b[1] - a[1]).slice(0, 5)
        .map(([name, qty]) => `<div class="rank-item"><span>${name}</span><strong>${qty}</strong></div>`).join('');
    document.getElementById('rankings-categoria').innerHTML = rankingHTML;
}

// --- GESTIÓN DE MESAS ---
function renderizarPlanoMesas() {
    const grid = document.getElementById('grid-mesas');
    if (!grid) return;
    grid.innerHTML = '';
    const mesasOcupadas = pedidosGlobales
        .filter(p => p.estado !== 'entregado' && p.cliente.toLowerCase().includes('mesa'))
        .map(p => p.cliente.match(/\d+/)?.[0]);

    for (let i = 1; i <= 20; i++) {
        const ocupada = mesasOcupadas.includes(i.toString());
        const mesa = document.createElement('div');
        mesa.className = `mesa-card ${ocupada ? 'mesa-ocupada' : 'mesa-libre'}`;
        mesa.innerHTML = `<h3>Mesa ${i}</h3><span>${ocupada ? 'Ocupada' : 'Libre'}</span>`;
        grid.appendChild(mesa);
    }
}

// --- CRUD DE CARTA ---
function escucharCarta() {
    onSnapshot(collection(db, "menu"), (snapshot) => {
        const invList = document.getElementById('inv-list');
        invList.innerHTML = '';
        snapshot.docs.forEach(docSnap => {
            const d = docSnap.data();
            menuGlobal[d.nombre] = d.ingredientes || [];
            const item = document.createElement('div');
            item.className = 'item-carta';
            item.innerHTML = `
                <span><strong>${d.nombre}</strong> - ${formatPrice(d.precio)}</span>
                <div class="actions">
                    <button onclick="window.prepararEdicion('${docSnap.id}', '${encodeURIComponent(JSON.stringify(d))}')">✏️</button>
                    <button onclick="window.eliminarPlato('${docSnap.id}')">🗑️</button>
                </div>
            `;
            invList.appendChild(item);
        });
    });
}

window.prepararEdicion = (id, dataStr) => {
    const d = JSON.parse(decodeURIComponent(dataStr));
    document.getElementById('edit-id').value = id;
    document.getElementById('p-nombre').value = d.nombre;
    document.getElementById('p-precio').value = d.precio;
    document.getElementById('p-categoria').value = d.categoria;
    document.getElementById('p-desc').value = d.descripcion || '';
};

window.guardarPlato = async () => {
    const id = document.getElementById('edit-id').value;
    const plato = {
        nombre: document.getElementById('p-nombre').value,
        precio: Number(document.getElementById('p-precio').value),
        categoria: document.getElementById('p-categoria').value,
        descripcion: document.getElementById('p-desc').value,
        fechaActualizacion: serverTimestamp()
    };

    if (id) await updateDoc(doc(db, "menu", id), plato);
    else await addDoc(collection(db, "menu"), plato);
    
    document.getElementById('edit-id').value = '';
    alert("Carta actualizada");
};

window.cambiarEstado = (id, nuevoEstado) => updateDoc(doc(db, "pedidos", id), { estado: nuevoEstado });
window.eliminarPedido = (id) => confirm("¿Eliminar pedido?") && deleteDoc(doc(db, "pedidos", id));
window.eliminarPlato = (id) => confirm("¿Eliminar plato?") && deleteDoc(doc(db, "menu", id));
