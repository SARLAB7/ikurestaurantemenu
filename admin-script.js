/* =========================================
   LOGICA DEL PANEL ADMIN - IKU PUEBLO BELLO
   ========================================= */
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

// --- 2. RENDERIZAR PEDIDOS ---
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

// --- 3. CALCULAR ESTADÍSTICAS ---
const escucharEstadisticas = () => {
    const q = query(collection(db, "pedidos"));
    
    onSnapshot(q, (sn) => {
        let totalHoy = 0;
        let totalMes = 0;
        const conteoPlatos = {};

        const hoy = new Date();
        const mesActual = hoy.getMonth();
        const anioActual = hoy.getFullYear();
        const diaActual = hoy.getDate();

        sn.docs.forEach(d => {
            const p = d.data();
            
            // Solo calculamos en base a pedidos completados para no falsear ventas
            if (p.estado === 'completado' && p.timestamp) {
                const fechaPedido = p.timestamp.toDate();
                
                // Sumar al Mes
                if (fechaPedido.getMonth() === mesActual && fechaPedido.getFullYear() === anioActual) {
                    totalMes += p.total;
                    
                    // Sumar a Hoy
                    if (fechaPedido.getDate() === diaActual) {
                        totalHoy += p.total;
                    }
                }

                // Contar cuántas veces se pidió cada plato
                p.items.forEach(item => {
                    conteoPlatos[item.nombre] = (conteoPlatos[item.nombre] || 0) + 1;
                });
            }
        });

        // 1. Imprimir Totales
        const formatoCOP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });
        const vHoyEl = document.getElementById('ventas-hoy');
        const vMesEl = document.getElementById('ventas-mes');
        
        if(vHoyEl) vHoyEl.innerText = formatoCOP.format(totalHoy);
        if(vMesEl) vMesEl.innerText = formatoCOP.format(totalMes);

        // 2. Ordenar Ranking
        const platosOrdenados = Object.keys(conteoPlatos).map(nombre => {
            return { nombre: nombre, cantidad: conteoPlatos[nombre] };
        }).sort((a, b) => b.cantidad - a.cantidad);

        const topLista = document.getElementById('top-platos');
        const bottomLista = document.getElementById('bottom-platos');
        
        if (topLista && bottomLista) {
            topLista.innerHTML = '';
            bottomLista.innerHTML = '';
            
            if(platosOrdenados.length > 0) {
                // Top 5 (Más vendidos)
                platosOrdenados.slice(0, 5).forEach(p => {
                    topLista.innerHTML += `<li><strong>${p.nombre}</strong> (${p.cantidad} uds)</li>`;
                });
                
                // Bottom 5 (Menos vendidos)
                const bottom5 = platosOrdenados.slice(-5).reverse();
                bottom5.forEach(p => {
                    bottomLista.innerHTML += `<li><strong>${p.nombre}</strong> (${p.cantidad} uds)</li>`;
                });
            } else {
                topLista.innerHTML = '<li style="list-style: none; color: #888;">Faltan ventas completadas</li>';
                bottomLista.innerHTML = '<li style="list-style: none; color: #888;">Faltan ventas completadas</li>';
            }
        }
    });
};

// --- 4. AUTENTICACIÓN ---
onAuthStateChanged(auth, (user) => {
    const panel = document.getElementById('admin-panel');
    const login = document.getElementById('login-screen');
    
    if (user && correosAutorizados.includes(user.email)) {
        if(panel) panel.style.display = 'flex'; 
        if(login) login.style.display = 'none';
        escucharPedidos();
        escucharMenu();
        escucharEstadisticas(); // Iniciamos el motor financiero
    } else {
        if(user) { alert("Acceso denegado"); signOut(auth); }
        if(panel) panel.style.display = 'none';
        if(login) login.style.display = 'flex';
    }
});

const loginBtn = document.getElementById('login-btn');
if (loginBtn) loginBtn.onclick = () => signInWithPopup(auth, new GoogleAuthProvider());

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) logoutBtn.onclick = () => signOut(auth);

// --- 5. GESTIÓN DEL FORMULARIO ---
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
        } catch (err) { alert("Error al guardar en la base de datos."); }
    };
}

// --- 6. FUNCIONES GLOBALES ---
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
            
            const titleEl = document.getElementById('form-title');
            if(titleEl) titleEl.innerText = "Editando Plato";
            
            const btnEl = document.getElementById('submit-btn');
            if(btnEl) btnEl.innerText = "Actualizar Cambios";
            
            const closeBtn = document.getElementById('close-edit-btn');
            if(closeBtn) closeBtn.style.display = "block";
            
            const contentArea = document.querySelector('.content-area');
            if(contentArea) contentArea.scrollTo({top: 0, behavior: 'smooth'});
        }
    }, {onlyOnce: true});
};

window.cancelarEdicion = () => {
    document.getElementById('edit-id').value = "";
    
    const titleEl = document.getElementById('form-title');
    if(titleEl) titleEl.innerText = "Añadir Nuevo Plato";
    
    const btnEl = document.getElementById('submit-btn');
    if(btnEl) btnEl.innerText = "Guardar Plato";
    
    const closeBtn = document.getElementById('close-edit-btn');
    if(closeBtn) closeBtn.style.display = "none";
    
    if(form) form.reset();
};
