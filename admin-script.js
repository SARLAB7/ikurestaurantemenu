import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, getDocs, serverTimestamp, addDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

const CORREO_MASTER = "cb01grupo@gmail.com";
const correosAutorizados = [CORREO_MASTER, "kelly.araujotafur@gmail.com"];

const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');

if (loginBtn) loginBtn.onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
if (logoutBtn) logoutBtn.onclick = () => signOut(auth);

let menuGlobal = {};
let pedidosGlobales = [];

onAuthStateChanged(auth, (u) => {
    if(u && correosAutorizados.includes(u.email)) {
        document.getElementById('admin-panel').style.display = 'flex';
        document.getElementById('login-screen').style.display = 'none';
        
        const superZone = document.getElementById('super-admin-zone');
        if(superZone) superZone.style.display = (u.email === CORREO_MASTER) ? 'block' : 'none';

        escucharCarta(); escucharPedidos(); 
    } else {
        if(u) signOut(auth);
        document.getElementById('admin-panel').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
    }
});

// NAVEGACIÓN DESDE EL PLANO DE MESAS
window.verPedidoDeMesa = (nombreMesa) => {
    // 1. Cambiar a la vista de pedidos
    const navPedidos = document.querySelector('.nav-item[onclick*="v-pedidos"]');
    cambiarVista('v-pedidos', navPedidos);

    // 2. Buscar la tarjeta y resaltarla
    setTimeout(() => {
        const tarjetas = document.querySelectorAll('.pedido-card');
        tarjetas.forEach(card => {
            if (card.innerText.toLowerCase().includes(nombreMesa.toLowerCase())) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.style.outline = "4px solid var(--accent)";
                card.style.transform = "scale(1.02)";
                setTimeout(() => {
                    card.style.outline = "none";
                    card.style.transform = "scale(1)";
                }, 3000);
            }
        });
    }, 450);
};

// RESET EXCLUSIVO PARA DAGOBERTO
window.resetearEstadisticas = async () => {
    if (confirm("¡ATENCIÓN DAGOBERTO!\n\nEsto borrará todos los pedidos históricos y de hoy. ¿Deseas continuar?")) {
        try {
            const batch = writeBatch(db);
            const snp = await getDocs(collection(db, "pedidos"));
            snp.forEach(d => batch.delete(d.ref));
            await batch.commit();
            alert("Métricas reiniciadas con éxito.");
        } catch (e) { alert("Error al borrar datos."); }
    }
};

function escucharPedidos() {
    const q = query(collection(db, "pedidos"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snapshot) => {
        pedidosGlobales = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
        renderizarPedidos();
        actualizarMétricas();
        renderizarPlanoMesas(pedidosGlobales);
    });
}

function renderizarPedidos() {
    const lp = document.getElementById('l-pendientes');
    const la = document.getElementById('l-atendidos');
    lp.innerHTML = ''; la.innerHTML = '';

    pedidosGlobales.forEach(p => {
        const card = document.createElement('div');
        card.className = `pedido-card ${p.estado}`;
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                <strong>${p.cliente}</strong>
                <button onclick="imprimirComanda('${encodeURIComponent(JSON.stringify(p))}')" style="background:#3b82f6; color:white; border:none; padding:4px 8px; border-radius:4px; font-size:0.7rem; cursor:pointer;">🖨️ Ticket</button>
            </div>
            <div style="font-size:0.9rem; margin-bottom:12px; padding-left:8px; border-left:2px solid #eee;">
                ${p.items.map(i => `• 1x ${i.nombre} ${i.nota ? `<br><small style='color:#eab308; margin-left:10px;'>(${i.nota})</small>` : ''}`).join('<br>')}
            </div>
            <div style="display:flex; gap:8px;">
                ${p.estado === 'pendiente' ? `<button onclick="actualizarEstado('${p.id}', 'preparando')" class="btn-estado btn-preparar">Cocinar</button>` : ''}
                ${p.estado === 'preparando' ? `
                    <button onclick="cerrarPedido('${p.id}', 'nequi')" class="btn-pago nequi">Nequi</button>
                    <button onclick="cerrarPedido('${p.id}', 'banco')" class="btn-pago banco">Banco</button>
                    <button onclick="cerrarPedido('${p.id}', 'efectivo')" class="btn-pago efectivo">Efec.</button>` : ''}
            </div>
        `;
        if (p.estado === 'listo') la.appendChild(card); else lp.appendChild(card);
    });
}

function actualizarMétricas() {
    let tHoy = 0, tMes = 0, tN = 0, tB = 0, tE = 0;
    const hoy = new Date();
    pedidosGlobales.forEach(p => {
        if(!p.timestamp) return;
        const f = p.timestamp.toDate();
        if(f.getMonth() === hoy.getMonth()) tMes += p.total;
        if(f.getDate() === hoy.getDate() && f.getMonth() === hoy.getMonth()) {
            tHoy += p.total;
            if(p.metodoPago === 'nequi') tN += p.total;
            if(p.metodoPago === 'banco') tB += p.total;
            if(p.metodoPago === 'efectivo') tE += p.total;
        }
    });
    document.getElementById('s-hoy').innerText = `$${tHoy.toLocaleString()}`;
    document.getElementById('s-mes').innerText = `$${tMes.toLocaleString()}`;
    document.getElementById('s-nequi').innerText = `$${tN.toLocaleString()}`;
    document.getElementById('s-bancolombia').innerText = `$${tB.toLocaleString()}`;
    document.getElementById('s-efectivo').innerText = `$${tE.toLocaleString()}`;
}

window.actualizarEstado = async (id, est) => await updateDoc(doc(db, "pedidos", id), { estado: est });
window.cerrarPedido = async (id, met) => await updateDoc(doc(db, "pedidos", id), { estado: 'listo', metodoPago: met });

function escucharCarta() // --- COMIENZO DEL CAMBIO EN admin-script.js ---

// Función para abrir y cerrar las categorías
window.toggleCategory = (categoryId) => {
    const content = document.getElementById(categoryId);
    const header = content.previousElementSibling;
    const chevron = header.querySelector('.chevron');
    
    const isHidden = content.style.display === 'none' || content.style.display === '';
    
    if (isHidden) {
        content.style.display = 'block';
        chevron.style.transform = 'rotate(180deg)';
        header.classList.add('active-cat');
    } else {
        content.style.display = 'none';
        chevron.style.transform = 'rotate(0deg)';
        header.classList.remove('active-cat');
    }
};

const escucharCarta = () => {
    onSnapshot(query(collection(db, "platos"), orderBy("timestamp", "desc")), (snap) => {
        const container = document.getElementById('lista-menu');
        container.innerHTML = '';

        // 1. Agrupamos los platos por categoría
        const grupos = {};
        snap.forEach(docSnap => {
            const d = docSnap.data();
            const cat = d.categoria || 'Sin Categoría';
            if (!grupos[cat]) grupos[cat] = [];
            grupos[cat].push({ id: docSnap.id, ...d });
        });

        // 2. Creamos el HTML para cada categoría (Acordeón)
        for (const [categoria, platos] of Object.entries(grupos)) {
            const catId = `cat-${categoria.replace(/\s+/g, '-')}`; // ID único sin espacios
            
            const section = document.createElement('div');
            section.className = 'category-accordion';
            
            section.innerHTML = `
                <div class="category-header" onclick="toggleCategory('${catId}')">
                    <h3>${categoria.toUpperCase()} <span class="count">${platos.length}</span></h3>
                    <span class="chevron">▼</span>
                </div>
                <div id="${catId}" class="category-content" style="display: none;">
                    <div class="admin-grid">
                        ${platos.map(p => `
                            <div class="admin-dish-card ${p.disponible === false ? 'not-available' : ''}">
                                <div class="dish-info">
                                    <h4>${p.nombre}</h4>
                                    <p>$${p.precio.toLocaleString()}</p>
                                </div>
                                <div class="dish-actions">
                                    <button onclick="editarPlato('${p.id}', '${p.nombre}', ${p.precio}, '${p.categoria}', '${p.descripcion||''}', '${(p.ingredientes||[]).join(', ')}')" class="btn-edit" title="Editar">
                                        ✏️
                                    </button>
                                    <button onclick="eliminarPlato('${p.id}')" class="btn-delete" title="Eliminar">
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            container.appendChild(section);
        }
    });
};

// --- FIN DEL CAMBIO EN admin-script.js ---

window.toggleDisp = async (id, disp) => await updateDoc(doc(db, "platos", id), { disponible: disp });

window.renderizarPlanoMesas = (pedidos) => {
    const grid = document.getElementById('grid-mesas');
    if(!grid) return;
    grid.innerHTML = '';
    const activas = pedidos.filter(p => p.estado !== 'listo' && p.cliente.toLowerCase().includes('mesa'));
    for(let i=1; i<=12; i++){
        const nombre = `Mesa ${i}`;
        const ocupada = activas.find(p => p.cliente.toLowerCase() === nombre.toLowerCase());
        grid.innerHTML += `
            <div class="mesa-card ${ocupada?'mesa-ocupada':''}" 
                 onclick="${ocupada ? `verPedidoDeMesa('${nombre}')` : ''}" 
                 style="${ocupada ? 'cursor:pointer;' : 'cursor:default;'}">
                <strong>${nombre}</strong><br>
                <small>${ocupada ? 'Ocupada - $' + ocupada.total.toLocaleString() : 'Libre'}</small>
            </div>`;
    }
};

window.imprimirComanda = (pJson) => {
    const p = JSON.parse(decodeURIComponent(pJson));
    const win = window.open('', '', 'width=300,height=600');
    win.document.write(`<h3>IKU</h3><hr>${p.cliente}<br><br>${p.items.map(i=>'• 1x '+i.nombre).join('<br>')}<br><hr>Total: $${p.total.toLocaleString()}`);
    win.print(); win.close();
};

// Lógica de formulario igual que siempre
window.editarPlato = (id, n, p, c, d, i) => {
    document.getElementById('edit-id').value = id;
    document.getElementById('name').value = n;
    document.getElementById('price').value = p;
    document.getElementById('category').value = c;
    document.getElementById('desc').value = d;
    document.getElementById('ingredients').value = i;
    document.getElementById('f-title').innerText = "Editando Plato";
    document.getElementById('btn-cancelar').style.display = 'block';
};

window.cancelarEdicion = () => {
    document.getElementById('m-form').reset();
    document.getElementById('edit-id').value = '';
    document.getElementById('f-title').innerText = "Configurar Plato";
    document.getElementById('btn-cancelar').style.display = 'none';
};

document.getElementById('m-form').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const datos = {
        nombre: document.getElementById('name').value,
        precio: Number(document.getElementById('price').value),
        categoria: document.getElementById('category').value,
        descripcion: document.getElementById('desc').value,
        ingredientes: document.getElementById('ingredients').value.split(',').map(s=>s.trim()).filter(s=>s!==''),
        timestamp: serverTimestamp()
    };
    id ? await updateDoc(doc(db, "platos", id), datos) : await addDoc(collection(db, "platos"), {...datos, disponible: true});
    cancelarEdicion();
};
