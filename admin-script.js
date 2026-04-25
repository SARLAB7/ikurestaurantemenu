import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, getDoc, getDocs, serverTimestamp, addDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

const CORREO_MASTER = "cb01grupo@gmail.com";
const correosAutorizados = [CORREO_MASTER, "kelly.araujotafur@gmail.com"];

const ICON_EDIT = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const ICON_TRASH = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;

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
        
        // Bloqueo exclusivo: Solo Dagoberto ve el botón de reinicio
        const superZone = document.getElementById('super-admin-zone');
        if(superZone) superZone.style.display = (u.email === CORREO_MASTER) ? 'block' : 'none';

        escucharCarta(); 
        escucharPedidos(); 
    } else {
        if(u) signOut(auth);
        document.getElementById('admin-panel').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
    }
});

// FUNCIÓN DE REINICIO MASIVO (Solo para cb01grupo@gmail.com)
window.resetearEstadisticas = async () => {
    if (confirm("¡ATENCIÓN DAGOBERTO!\n\nEsto eliminará TODOS los pedidos registrados (históricos y de hoy). Las métricas volverán a cero. ¿Deseas continuar?")) {
        try {
            const batch = writeBatch(db);
            const snp = await getDocs(collection(db, "pedidos"));
            snp.forEach(d => batch.delete(d.ref));
            await batch.commit();
            alert("Base de datos de pedidos limpiada correctamente.");
        } catch (error) {
            console.error("Error al resetear:", error);
            alert("No se pudo completar el borrado.");
        }
    }
};

function escucharPedidos() {
    const q = query(collection(db, "pedidos"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snapshot) => {
        pedidosGlobales = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
        renderizarListaPedidos();
        actualizarMétricas();
        renderizarPlanoMesas(pedidosGlobales);
    });
}

function renderizarListaPedidos() {
    const lp = document.getElementById('l-pendientes');
    const la = document.getElementById('l-atendidos');
    lp.innerHTML = ''; la.innerHTML = '';
    
    pedidosGlobales.forEach(p => {
        const card = document.createElement('div');
        card.className = `pedido-card ${p.estado}`;
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 10px;">
                <div>
                    <strong style="font-size: 1.1rem;">${p.cliente}</strong>
                    <div style="font-size:0.85rem; color:var(--text-muted);">${p.tipo} - $${Number(p.total).toLocaleString()}</div>
                </div>
                <button onclick="imprimirComanda('${encodeURIComponent(JSON.stringify(p))}')" style="background:#3b82f6; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size: 0.8rem;">🖨️ Imprimir</button>
            </div>
            <div style="margin-bottom:15px; padding-left: 10px; border-left: 2px solid var(--border);">
                ${p.items.map(i => `<div style="font-size:0.9rem; margin-bottom:4px;">• 1x ${i.nombre} ${i.nota ? `<span style="color:#eab308; font-size:0.8rem;">(${i.nota})</span>` : ''}</div>`).join('')}
            </div>
            
            <div class="acciones-pedido">
                ${p.estado === 'pendiente' ? `<button onclick="actualizarEstado('${p.id}', 'preparando')" class="btn-estado btn-preparar">🍳 Iniciar Cocina</button>` : ''}
                ${p.estado === 'preparando' ? `
                    <div style="display:flex; gap:8px;">
                        <button onclick="cerrarPedido('${p.id}', 'nequi')" class="btn-pago nequi">Nequi</button>
                        <button onclick="cerrarPedido('${p.id}', 'banco')" class="btn-pago banco">Banco</button>
                        <button onclick="cerrarPedido('${p.id}', 'efectivo')" class="btn-pago efectivo">Efec.</button>
                    </div>` : ''}
                ${p.estado === 'listo' ? `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <select onchange="cambiarPago('${p.id}', this.value)" style="margin: 0; padding: 4px; font-size: 0.8rem;">
                            <option value="nequi" ${p.metodoPago==='nequi'?'selected':''}>Nequi</option>
                            <option value="banco" ${p.metodoPago==='banco'?'selected':''}>Banco</option>
                            <option value="efectivo" ${p.metodoPago==='efectivo'?'selected':''}>Efectivo</option>
                        </select>
                        <button onclick="actualizarEstado('${p.id}', 'preparando')" style="font-size:0.7rem; background:none; border:none; text-decoration:underline; cursor:pointer;">Corregir</button>
                    </div>` : ''}
            </div>
        `;
        if (p.estado === 'listo') la.appendChild(card); else lp.appendChild(card);
    });
}

function actualizarMétricas() {
    let tHoy = 0, tMes = 0, tN = 0, tB = 0, tE = 0;
    const ventasPlatos = {}, usoIngredientes = {};
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

        p.items.forEach(item => {
            ventasPlatos[item.nombre] = (ventasPlatos[item.nombre] || 0) + 1;
            (menuGlobal[item.nombre] || []).forEach(ing => usoIngredientes[ing] = (usoIngredientes[ing] || 0) + 1);
        });
    });

    document.getElementById('s-hoy').innerText = `$${tHoy.toLocaleString()}`;
    document.getElementById('s-mes').innerText = `$${tMes.toLocaleString()}`;
    document.getElementById('s-nequi').innerText = `$${tN.toLocaleString()}`;
    document.getElementById('s-bancolombia').innerText = `$${tB.toLocaleString()}`;
    document.getElementById('s-efectivo').innerText = `$${tE.toLocaleString()}`;

    document.getElementById('rankings-categoria').innerHTML = Object.entries(ventasPlatos)
        .sort((a,b) => b[1]-a[1]).slice(0,5)
        .map(([n,v]) => `<div style="padding:10px; background:#f9fafb; border-radius:8px; border:1px solid #eee; display:flex; justify-content:space-between;"><span>${n}</span> <strong>${v}</strong></div>`).join('');

    document.getElementById('rankings-ingredientes').innerHTML = Object.entries(usoIngredientes)
        .sort((a,b) => b[1]-a[1])
        .map(([n,v]) => `<span style="background:var(--sidebar); color:white; padding:4px 10px; border-radius:20px; font-size:0.75rem;">${n} (${v})</span>`).join('');
}

window.actualizarEstado = async (id, est) => await updateDoc(doc(db, "pedidos", id), { estado: est });
window.cerrarPedido = async (id, met) => await updateDoc(doc(db, "pedidos", id), { estado: 'listo', metodoPago: met });
window.cambiarPago = async (id, met) => await updateDoc(doc(db, "pedidos", id), { metodoPago: met });

function escucharCarta() {
    onSnapshot(collection(db, "platos"), (snap) => {
        const list = document.getElementById('inv-list');
        list.innerHTML = '';
        snap.forEach(d => {
            const p = d.data(); p.id = d.id;
            menuGlobal[p.nombre] = p.ingredientes || [];
            list.innerHTML += `
                <div style="background:white; padding:15px; margin-bottom:10px; border-radius:8px; border:1px solid #ddd; display:flex; justify-content:space-between; align-items:center;">
                    <div><strong>${p.nombre}</strong> - $${p.precio.toLocaleString()}</div>
                    <div style="display:flex; gap:10px; align-items:center;">
                        <label class="switch"><input type="checkbox" ${p.disponible!==false?'checked':''} onchange="toggleDisp('${p.id}', this.checked)"><span class="slider"></span></label>
                        <button onclick="editarPlato('${p.id}','${p.nombre}',${p.precio},'${p.categoria}','${p.descripcion||''}','${(p.ingredientes||[]).join(',')}')" style="border:none; background:none; color:#3b82f6; cursor:pointer;">${ICON_EDIT}</button>
                    </div>
                </div>`;
        });
    });
}

window.toggleDisp = async (id, disp) => await updateDoc(doc(db, "platos", id), { disponible: disp });

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

window.renderizarPlanoMesas = (pedidos) => {
    const grid = document.getElementById('grid-mesas');
    if(!grid) return;
    grid.innerHTML = '';
    const activas = pedidos.filter(p => p.estado !== 'listo' && p.cliente.toLowerCase().includes('mesa'));
    for(let i=1; i<=12; i++){
        const nombre = `Mesa ${i}`;
        const ocupada = activas.find(p => p.cliente.toLowerCase() === nombre.toLowerCase());
        grid.innerHTML += `<div class="mesa-card ${ocupada?'mesa-ocupada':''}"><strong>${nombre}</strong><br><small>${ocupada?'$'+ocupada.total.toLocaleString():'Libre'}</small></div>`;
    }
};

window.imprimirComanda = (pJson) => {
    const p = JSON.parse(decodeURIComponent(pJson));
    const win = window.open('', '', 'width=300,height=600');
    win.document.write(`<html><body style="font-family:monospace; padding:10px;">
        <h3 style="text-align:center;">IKU RESTAURANTE</h3>
        <hr>Cliente: ${p.cliente}<br>Total: $${p.total.toLocaleString()}<br><hr>
        ${p.items.map(i => `• 1x ${i.nombre}`).join('<br>')}
    </body></html>`);
    win.print(); win.close();
};
