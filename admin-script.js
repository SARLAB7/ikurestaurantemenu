import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, serverTimestamp, addDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

const correosAutorizados = ["cb01grupo@gmail.com", "kelly.araujotafur@gmail.com"];
const formatPrice = (num) => Number(num).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

onAuthStateChanged(auth, (user) => {
    const loginScreen = document.getElementById('login-screen');
    const adminPanel = document.getElementById('admin-panel');

    if (user && correosAutorizados.includes(user.email)) {
        if(loginScreen) loginScreen.style.display = 'none';
        if(adminPanel) adminPanel.style.display = 'flex';
        iniciarAppAdmin();
    } else {
        if(loginScreen) loginScreen.style.display = 'flex';
        if(adminPanel) adminPanel.style.display = 'none';
        if (user) signOut(auth);
    }
});

document.getElementById('login-btn').onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
window.logout = () => signOut(auth);

function iniciarAppAdmin() {
    escucharPedidos();
    escucharCarta();
}

function escucharPedidos() {
    onSnapshot(query(collection(db, "pedidos"), orderBy("fecha", "desc")), (snapshot) => {
        const listaActivos = document.getElementById('l-activos');
        const listaAtendidos = document.getElementById('l-atendidos');
        if(!listaActivos || !listaAtendidos) return;

        listaActivos.innerHTML = '';
        listaAtendidos.innerHTML = '';

        snapshot.docs.forEach(docSnap => {
            const p = docSnap.data();
            const id = docSnap.id;
            const card = document.createElement('div');
            card.className = `order-card state-${p.estado}`;
            
            // Verificación de seguridad para items
            const itemsHTML = p.items ? p.items.map(i => `<p>• ${i.cantidad}x ${i.nombre}</p>`).join('') : 'Sin productos';

            card.innerHTML = `
                <div class="order-header">
                    <h4>${p.cliente} <span>(${p.tipo})</span></h4>
                    <span class="badge">${p.estado.toUpperCase()}</span>
                </div>
                <div class="order-body">
                    ${itemsHTML}
                    <hr>
                    <p><strong>Total: ${formatPrice(p.total || 0)}</strong></p>
                </div>
                <div class="order-actions">
                    ${p.estado === 'recibido' ? `<button onclick="window.cambiarEstado('${id}', 'preparando')">Cocinar</button>` : ''}
                    ${p.estado === 'preparando' ? `<button onclick="window.cambiarEstado('${id}', 'listo')">Listo</button>` : ''}
                    ${p.estado !== 'entregado' ? `<button onclick="window.cambiarEstado('${id}', 'entregado')">Entregar</button>` : ''}
                    <button class="btn-danger" onclick="window.eliminarPedido('${id}')">Eliminar</button>
                </div>
            `;

            p.estado === 'entregado' ? listaAtendidos.appendChild(card) : listaActivos.appendChild(card);
        });
    });
}

window.cambiarEstado = (id, nuevoEstado) => updateDoc(doc(db, "pedidos", id), { estado: nuevoEstado });
window.eliminarPedido = (id) => confirm("¿Eliminar pedido?") && deleteDoc(doc(db, "pedidos", id));

function escucharCarta() {
    onSnapshot(collection(db, "menu"), (snapshot) => {
        const invList = document.getElementById('inv-list');
        if(!invList) return;
        invList.innerHTML = '';
        snapshot.docs.forEach(docSnap => {
            const d = docSnap.data();
            const item = document.createElement('div');
            item.className = 'item-carta';
            item.innerHTML = `
                <span><strong>${d.nombre}</strong> - ${formatPrice(d.precio)}</span>
                <div>
                    <button onclick="window.eliminarPlato('${docSnap.id}')">🗑️</button>
                </div>
            `;
            invList.appendChild(item);
        });
    });
}

// Vinculamos guardarPlato a window para que el HTML lo vea
window.guardarPlato = async () => {
    const nombre = document.getElementById('p-nombre').value;
    const precio = document.getElementById('p-precio').value;

    if(!nombre || !precio) return alert("Nombre y precio son obligatorios");

    const plato = {
        nombre: nombre,
        precio: Number(precio),
        categoria: document.getElementById('p-categoria').value,
        descripcion: document.getElementById('p-desc').value,
        fechaCreacion: serverTimestamp()
    };

    try {
        await addDoc(collection(db, "menu"), plato);
        alert("Plato agregado correctamente");
        // Limpiar campos
        document.getElementById('p-nombre').value = '';
        document.getElementById('p-precio').value = '';
    } catch(e) {
        console.error(e);
    }
};

window.eliminarPlato = (id) => confirm("¿Eliminar de la carta?") && deleteDoc(doc(db, "menu", id));
