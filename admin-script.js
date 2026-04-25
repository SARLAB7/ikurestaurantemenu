import { db, auth } from './firebase-config.js';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

const correosAutorizados = ["cb01grupo@gmail.com", "kelly.araujotafur@gmail.com"];

// --- 1. RENDERIZAR MENÚ ---
const escucharMenu = () => {
    const q = query(collection(db, "platos"), orderBy("timestamp", "desc"));
    onSnapshot(q, (sn) => {
        const listas = {
            diario: document.getElementById('lista-diario'),
            rapida: document.getElementById('lista-rapida'),
            varios: document.getElementById('lista-varios')
        };
        if (!listas.diario) return;
        Object.values(listas).forEach(l => l.innerHTML = '');

        sn.docs.forEach(docSnap => {
            const d = docSnap.data();
            const id = docSnap.id;
            const item = document.createElement('div');
            item.className = 'plato-item';
            const precio = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(d.precio);
            item.innerHTML = `
                <span style="font-weight:500;">${d.nombre}</span>
                <span style="color:#888;">${precio}</span>
                <div style="display:flex; gap:8px;">
                    <button class="btn-icon btn-edit" onclick="prepararEdicion('${id}')">Editar</button>
                    <button class="btn-icon btn-delete" onclick="borrarPlato('${id}')">Borrar</button>
                </div>`;
            if (listas[d.categoria]) listas[d.categoria].appendChild(item);
        });
    });
};

// --- 2. RENDERIZAR PEDIDOS (PENDIENTES Y ATENDIDOS) ---
const escucharPedidos = () => {
    const q = query(collection(db, "pedidos"), orderBy("timestamp", "desc"));
    onSnapshot(q, (sn) => {
        const contPendientes = document.getElementById('lista-pedidos-realtime');
        const contAtendidos = document.getElementById('lista-atendidos');
        
        if (!contPendientes || !contAtendidos) return;
        
        contPendientes.innerHTML = '';
        contAtendidos.innerHTML = '';

        sn.docs.forEach(d => {
            const p = d.data();
            const id = d.id;
            const precioFormateado = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(p.total);

            if (p.estado === 'pendiente') {
                // CUADRO GRANDE PARA COCINA
                const card = document.createElement('div');
                card.className = 'pedido-card';
                card.innerHTML = `
                    <div class="pedido-header">
                        <h5>👤 ${p.cliente}</h5>
                        <strong style="color:var(--success); font-size:1.1rem;">${precioFormateado}</strong>
                    </div>
                    <ul class="pedido-items">
                        ${p.items.map(i => `<li><strong>${i.nombre}</strong> ${i.nota ? `<br><small style="color:#666;">📝 ${i.nota}</small>` : ''}</li>`).join('')}
                    </ul>
                    <button style="background:var(--success); color:white; border:none; padding:12px; border-radius:8px; cursor:pointer; width:100%; font-weight:700;" onclick="completarPedido('${id}')">MARCAR COMO LISTO</button>
                `;
                contPendientes.appendChild(card);
            } else {
                // FILA PEQUEÑA PARA ATENDIDOS
                const row = document.createElement('div');
                row.className = 'atendido-item';
                row.innerHTML = `
                    <div class="atendido-info">
                        <span>Mesa/Cliente: <strong>${p.cliente}</strong></span>
                        <span class="atendido-total">${precioFormateado}</span>
                    </div>
                    <button onclick="eliminarPedido('${id}')" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:0.8rem; font-weight:600;">BORRAR REGISTRO</button>
                `;
                contAtendidos.appendChild(row);
            }
        });

        if (contPendientes.innerHTML === '') contPendientes.innerHTML = '<p style="color:#888;">No hay platos en cocina.</p>';
        if (contAtendidos.innerHTML === '') contAtendidos.innerHTML = '<p style="color:#888; font-size:0.8rem;">Aún no hay pedidos despachados hoy.</p>';
    });
};

// --- 3. ESTADÍSTICAS ---
const escucharEstadisticas = () => {
    const q = query(collection(db, "pedidos"));
    onSnapshot(q, (sn) => {
        let tHoy = 0, tMes = 0;
        const ahora = new Date();
        sn.docs.forEach(d => {
            const p = d.data();
            if (p.estado === 'completado' && p.timestamp) {
                const f = p.timestamp.toDate();
                if (f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear()) {
                    tMes += p.total;
                    if (f.getDate() === ahora.getDate()) tHoy += p.total;
                }
            }
        });
        const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });
        if(document.getElementById('ventas-hoy')) document.getElementById('ventas-hoy').innerText = fmt.format(tHoy);
        if(document.getElementById('ventas-mes')) document.getElementById('ventas-mes').innerText = fmt.format(tMes);
    });
};

// --- LOGICA DE ACCESO Y BOTONES ---
onAuthStateChanged(auth, (user) => {
    if (user && correosAutorizados.includes(user.email)) {
        document.getElementById('admin-panel').style.display = 'flex';
        document.getElementById('login-screen').style.display = 'none';
        escucharPedidos(); escucharMenu(); escucharEstadisticas();
    } else {
        if(user) { alert("Acceso denegado"); signOut(auth); }
        document.getElementById('admin-panel').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
    }
});

document.getElementById('login-btn').onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
document.getElementById('logout-btn').onclick = () => signOut(auth);

const form = document.getElementById('menu-form');
form.onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const datos = {
        nombre: document.getElementById('name').value,
        precio: Number(document.getElementById('price').value),
        categoria: document.getElementById('category').value,
        descripcion: document.getElementById('desc').value,
        ingredientes: document.getElementById('ingredients').value.split(',').map(i => i.trim()),
        timestamp: serverTimestamp()
    };
    try {
        if (id) await updateDoc(doc(db, "platos", id), datos);
        else await addDoc(collection(db, "platos"), datos);
        form.reset(); window.cancelarEdicion();
    } catch (err) { alert("Error al guardar"); }
};

window.borrarPlato = async (id) => { if(confirm("¿Borrar plato?")) await deleteDoc(doc(db, "platos", id)); };
window.completarPedido = async (id) => await updateDoc(doc(db, "pedidos", id), { estado: "completado" });
window.eliminarPedido = async (id) => { if(confirm("¿Eliminar registro?")) await deleteDoc(doc(db, "pedidos", id)); };

window.prepararEdicion = (id) => {
    const q = query(collection(db, "platos"));
    onSnapshot(q, (sn) => {
        const d = sn.docs.find(doc => doc.id === id)?.data();
        if(d) {
            document.getElementById('edit-id').value = id;
            document.getElementById('name').value = d.nombre;
            document.getElementById('price').value = d.precio;
            document.getElementById('category').value = d.categoria;
            document.getElementById('desc').value = d.descripcion || '';
            document.getElementById('ingredients').value = d.ingredientes ? d.ingredientes.join(', ') : '';
            document.getElementById('form-title').innerText = "Editando Plato";
            document.getElementById('submit-btn').innerText = "Actualizar Cambios";
            document.getElementById('close-edit-btn').style.display = "block";
            document.querySelector('.content-area').scrollTo({top: 0, behavior: 'smooth'});
        }
    }, {onlyOnce: true});
};

window.cancelarEdicion = () => {
    document.getElementById('edit-id').value = "";
    document.getElementById('form-title').innerText = "Añadir Nuevo Plato";
    document.getElementById('submit-btn').innerText = "Guardar Plato";
    document.getElementById('close-edit-btn').style.display = "none";
    form.reset();
};
