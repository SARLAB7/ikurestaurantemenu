import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, serverTimestamp, addDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

const correosAutorizados = ["cb01grupo@gmail.com", "kelly.araujotafur@gmail.com"];
const formatPrice = (n) => Number(n).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

let pedidosGlobales = [];
let menuGlobal = {};

// --- AUTENTICACIÓN ---
onAuthStateChanged(auth, (user) => {
    const login = document.getElementById('login-screen');
    const panel = document.getElementById('admin-panel');
    if (user && correosAutorizados.includes(user.email)) {
        login.style.display = 'none'; panel.style.display = 'flex';
        iniciarAppAdmin();
    } else {
        if (user) signOut(auth);
        login.style.display = 'flex'; panel.style.display = 'none';
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
        const lPendientes = document.getElementById('l-pendientes');
        const lAtendidos = document.getElementById('l-atendidos');
        lPendientes.innerHTML = ''; lAtendidos.innerHTML = '';

        pedidosGlobales.forEach(p => {
            const card = document.createElement('div');
            card.className = `pedido-card state-${p.estado}`;
            card.innerHTML = `
                <div class="order-header">
                    <h4>${p.cliente} <span>(${p.tipo})</span></h4>
                    <button onclick="window.imprimirComanda('${encodeURIComponent(JSON.stringify(p))}')">🖨️</button>
                </div>
                <div class="order-body">
                    ${p.items.map(i => `<p>• ${i.cantidad}x <strong>${i.nombre}</strong> ${i.excluidos?.length > 0 ? `<br><small>❌ Sin: ${i.excluidos.join(', ')}</small>` : ''}</p>`).join('')}
                    <hr><p>Total: ${formatPrice(p.total || 0)}</p>
                </div>
                <div class="order-actions">
                    ${p.estado === 'recibido' ? `<button onclick="window.cambiarEstado('${p.id}', 'preparando')">Cocinar</button>` : ''}
                    ${p.estado === 'preparando' ? `<button onclick="window.cambiarEstado('${p.id}', 'listo')">Listo</button>` : ''}
                    ${p.estado !== 'entregado' ? `<button onclick="window.cambiarEstado('${p.id}', 'entregado')">Entregar</button>` : ''}
                    <button onclick="window.eliminarPedido('${p.id}')">🗑️</button>
                </div>
            `;
            p.estado === 'entregado' ? lAtendidos.appendChild(card) : lPendientes.appendChild(card);
        });
        actualizarEstadisticas();
        renderizarPlanoMesas();
    });
}

// --- GESTIÓN DE CARTA (AGREGAR / EDITAR) ---
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
                <div>
                    <button onclick="window.prepararEdicion('${docSnap.id}', '${encodeURIComponent(JSON.stringify(d))}')">✏️</button>
                    <button onclick="window.eliminarPlato('${docSnap.id}')">🗑️</button>
                </div>
            `;
            invList.appendChild(item);
        });
    });
}

window.guardarPlato = async () => {
    const id = document.getElementById('edit-id').value;
    const platoData = {
        nombre: document.getElementById('name').value,
        precio: Number(document.getElementById('price').value),
        categoria: document.getElementById('category').value,
        descripcion: document.getElementById('desc').value,
        ingredientes: document.getElementById('ingredients').value.split(',').map(i => i.trim()).filter(i => i !== "")
    };

    try {
        if (id) await updateDoc(doc(db, "menu", id), platoData);
        else await addDoc(collection(db, "menu"), platoData);
        
        document.getElementById('plato-form').reset();
        document.getElementById('edit-id').value = '';
        document.getElementById('form-title').innerText = "Configurar Plato";
        alert("Carta actualizada correctamente.");
    } catch(e) { console.error(e); }
};

window.prepararEdicion = (id, dataStr) => {
    const d = JSON.parse(decodeURIComponent(dataStr));
    document.getElementById('edit-id').value = id;
    document.getElementById('name').value = d.nombre;
    document.getElementById('price').value = d.precio;
    document.getElementById('category').value = d.categoria;
    document.getElementById('desc').value = d.descripcion || '';
    document.getElementById('ingredients').value = d.ingredientes ? d.ingredientes.join(', ') : '';
    document.getElementById('form-title').innerText = "Editando: " + d.nombre;
};

// --- MÉTRICAS E INTELIGENCIA ---
function actualizarEstadisticas() {
    let tHoy = 0, nq = 0, bc = 0, ef = 0, pCant = 0;
    const platosC = {}, rechazosC = {};
    const hoy = new Date().toDateString();

    pedidosGlobales.forEach(p => {
        if (!p.fecha) return;
        const f = p.fecha.toDate();
        if (f.toDateString() === hoy) {
            tHoy += p.total || 0; pCant++;
            if (p.metodoPago === 'nequi') nq += p.total;
            else if (p.metodoPago === 'banco') bc += p.total;
            else ef += p.total;

            p.items.forEach(i => {
                platosC[i.nombre] = (platosC[i.nombre] || 0) + i.cantidad;
                if(i.excluidos) i.excluidos.forEach(ex => rechazosC[ex] = (rechazosC[ex] || 0) + 1);
            });
        }
    });

    document.getElementById('s-hoy').innerText = formatPrice(tHoy);
    document.getElementById('s-nequi').innerText = formatPrice(nq);
    document.getElementById('s-bancolombia').innerText = formatPrice(bc);
    document.getElementById('s-efectivo').innerText = formatPrice(ef);
    document.getElementById('s-ticket-promedio').innerText = formatPrice(pCant > 0 ? tHoy / pCant : 0);

    renderRanking('rankings-categoria', platosC);
    renderRanking('rankings-rechazados', rechazosC);
}

function renderRanking(id, datos) {
    const el = document.getElementById(id);
    if(!el) return;
    el.innerHTML = Object.entries(datos).sort((a,b)=>b[1]-a[1]).slice(0,5)
        .map(([n, q]) => `<div>${n} (${q})</div>`).join('');
}

// --- PLANO DE MESAS ---
function renderizarPlanoMesas() {
    const grid = document.getElementById('grid-mesas');
    if(!grid) return;
    const ocupadas = pedidosGlobales
        .filter(p => p.estado !== 'entregado' && p.cliente.toLowerCase().includes('mesa'))
        .map(p => p.cliente.match(/\d+/)?.[0]);

    grid.innerHTML = '';
    for (let i = 1; i <= 20; i++) {
        const esO = ocupadas.includes(i.toString());
        const mesa = document.createElement('div');
        mesa.className = `mesa-card ${esO ? 'mesa-ocupada' : 'mesa-libre'}`;
        mesa.innerHTML = `Mesa ${i}<br><span>${esO ? 'Ocupada' : 'Libre'}</span>`;
        grid.appendChild(mesa);
    }
}

// --- UTILIDADES ---
window.imprimirComanda = (pStr) => {
    const p = JSON.parse(decodeURIComponent(pStr));
    const win = window.open('', '', 'width=300,height=600');
    win.document.write(`<html><body style="font-family:monospace;">
        <h3>IKU COMANDA</h3><hr>
        <p>Cliente: ${p.cliente}</p>
        ${p.items.map(i => `<p>1x ${i.nombre}</p>`).join('')}
    </body></html>`);
    win.document.close(); win.print(); win.close();
};
window.cambiarEstado = (id, e) => updateDoc(doc(db, "pedidos", id), { estado: e });
window.eliminarPedido = (id) => confirm("¿Eliminar pedido?") && deleteDoc(doc(db, "pedidos", id));
window.eliminarPlato = (id) => confirm("¿Eliminar de la carta?") && deleteDoc(doc(db, "menu", id));
