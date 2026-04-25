import { db, auth } from './firebase-config.js';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

const correosAutorizados = ["cb01grupo@gmail.com", "kelly.araujotafur@gmail.com"];

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
            item.className = 'plato-item'; // Clase para la grilla estilo tabla
            
            const precioFormateado = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(d.precio);

            item.innerHTML = `
                <span class="plato-name">${d.nombre}</span>
                <span class="plato-price">${precioFormateado}</span>
                <div class="action-btns">
                    <button class="btn-icon btn-edit" onclick="prepararEdicion('${id}')">Editar</button>
                    <button class="btn-icon btn-delete" onclick="borrarPlato('${id}')">Borrar</button>
                </div>
            `;
            if (listas[d.categoria]) listas[d.categoria].appendChild(item);
        });
    });
};

const escucharPedidos = () => {
    const q = query(collection(db, "pedidos"), orderBy("timestamp", "desc"));
    onSnapshot(q, (sn) => {
        const cont = document.getElementById('lista-pedidos-realtime');
        if (!cont) return;
        cont.innerHTML = '';

        if (sn.empty) {
            cont.innerHTML = '<p style="color:#888;">No hay pedidos pendientes por ahora.</p>';
            return;
        }

        sn.docs.forEach(d => {
            const p = d.data();
            const esCompletado = p.estado === 'completado';
            const card = document.createElement('div');
            card.className = `pedido-card ${esCompletado ? 'completado' : ''}`;
            
            const precioFormateado = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(p.total);

            card.innerHTML = `
                <div class="pedido-header">
                    <h5>👤 Mesa/Cliente: ${p.cliente}</h5>
                    <span class="pedido-total">${precioFormateado}</span>
                </div>
                <ul class="pedido-items">
                    ${p.items.map(i => `<li><strong>${i.nombre}</strong> ${i.nota ? `<br><em>Nota: ${i.nota}</em>` : ''}</li>`).join('')}
                </ul>
                <div style="display:flex; gap:10px;">
                    ${!esCompletado ? `<button style="background:var(--success); color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; width:100%; font-weight:600;" onclick="completarPedido('${d.id}')">Marcar Listo</button>` : ''}
                    <button style="background:var(--danger); color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; width:100%; font-weight:600;" onclick="eliminarPedido('${d.id}')">Borrar Registro</button>
                </div>
            `;
            cont.appendChild(card);
        });
    });
};

// --- LOGICA DE ACCESO ---
onAuthStateChanged(auth, (user) => {
    const panel = document.getElementById('admin-panel');
    const login = document.getElementById('login-screen');
    
    if (user && correosAutorizados.includes(user.email)) {
        panel.style.display = 'flex'; // Usamos flex para el dashboard layout
        login.style.display = 'none';
        escucharPedidos();
        escucharMenu();
    } else {
        if(user) { alert("Acceso denegado"); signOut(auth); }
        panel.style.display = 'none';
        login.style.display = 'flex';
    }
});

const loginBtn = document.getElementById('login-btn');
if (loginBtn) loginBtn.onclick = () => signInWithPopup(auth, new GoogleAuthProvider());

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) logoutBtn.onclick = () => signOut(auth);

// --- GESTIÓN DE FORMULARIO ---
const form = document.getElementById('menu-form');
if (form) {
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
            if (id) {
                await updateDoc(doc(db, "platos", id), datos);
            } else {
                await addDoc(collection(db, "platos"), datos);
            }
            form.reset();
            window.cancelarEdicion();
        } catch (err) { alert("Error al guardar"); }
    };
}

// --- FUNCIONES GLOBALES (Window) ---
window.borrarPlato = async (id) => { if(confirm("¿Estás seguro de borrar este plato del menú?")) await deleteDoc(doc(db, "platos", id)); };
window.completarPedido = async (id) => await updateDoc(doc(db, "pedidos", id), { estado: "completado" });
window.eliminarPedido = async (id) => { if(confirm("¿Eliminar este pedido del registro?")) await deleteDoc(doc(db, "pedidos", id)); };

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
            document.getElementById('cancel-edit').style.display = "block";
            
            // Nos movemos al inicio donde está el form
            document.querySelector('.content-area').scrollTo({top: 0, behavior: 'smooth'});
        }
    }, {onlyOnce: true});
};

window.cancelarEdicion = () => {
    document.getElementById('edit-id').value = "";
    document.getElementById('form-title').innerText = "Añadir Nuevo Plato";
    document.getElementById('submit-btn').innerText = "Guardar Plato";
    document.getElementById('cancel-edit').style.display = "none";
    form.reset();
};
