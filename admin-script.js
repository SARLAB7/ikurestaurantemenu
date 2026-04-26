import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, serverTimestamp, addDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

const CORREO_MASTER = "cb01grupo@gmail.com";
const correosAutorizados = [CORREO_MASTER, "kelly.araujotafur@gmail.com"];
const ICON_PREPARE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>`;
const ICON_CHECK = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
const ICON_X = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
const ICON_EDIT = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const ICON_TRASH = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;

const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');

if (loginBtn) loginBtn.onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
if (logoutBtn) logoutBtn.onclick = () => signOut(auth);

onAuthStateChanged(auth, (u) => {
    if(u && correosAutorizados.includes(u.email)) {
        document.getElementById('admin-panel').style.display = 'flex';
        document.getElementById('login-screen').style.display = 'none';
        const masterTools = document.getElementById('master-tools');
        if (masterTools) masterTools.style.display = (u.email === CORREO_MASTER) ? 'block' : 'none';
        escucharCarta(); 
        escucharPedidos(); 
    } else {
        if(u) signOut(auth);
        document.getElementById('admin-panel').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
    }
});

let menuGlobal = {};
let pedidosGlobales = [];

// --- LÓGICA DE PEDIDOS ---
function escucharPedidos() {
    const q = query(collection(db, "pedidos"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snapshot) => {
        pedidosGlobales = [];
        const lp = document.getElementById('l-pendientes');
        const la = document.getElementById('l-atendidos');
        if(!lp || !la) return;

        lp.innerHTML = ''; la.innerHTML = '';
        
        snapshot.docs.forEach(docSnap => {
            const p = docSnap.data();
            p.id = docSnap.id;
            pedidosGlobales.push(p);

            if (p.estado === 'rechazado') return; // No mostrar rechazados en el monitor principal

            const card = document.createElement('div');
            card.className = `pedido-card ${p.estado}`;
            
            let botonesAccion = '';
            if (p.estado === 'pendiente') {
                botonesAccion = `
                    <div style="display:flex; gap:8px;">
                        <button onclick="actualizarEstado('${p.id}', 'preparando')" class="btn-estado btn-preparar" style="flex:3; background: var(--sidebar); color: var(--accent); border: 1px solid var(--accent);">
                            ${ICON_PREPARE} <span style="margin-left:8px;">PREPARAR</span>
                        </button>
                        <button onclick="rechazarPedido('${p.id}')" class="btn-action" style="background:#f9fafb; color:#ef4444; border: 1px solid #fee2e2; flex:1; display:flex; align-items:center; justify-content:center;">
                            ${ICON_X}
                        </button>
                    </div>`;
            } else if (p.estado === 'preparando') {
                botonesAccion = `
                    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:8px;">
                        <button onclick="cerrarPedido('${p.id}', 'nequi')" class="btn-pago nequi" style="font-size:0.7rem; letter-spacing:1px;">NEQUI</button>
                        <button onclick="cerrarPedido('${p.id}', 'banco')" class="btn-pago banco" style="font-size:0.7rem; letter-spacing:1px;">BANCO</button>
                        <button onclick="cerrarPedido('${p.id}', 'efectivo')" class="btn-pago efectivo" style="font-size:0.7rem; letter-spacing:1px;">EFECTIVO</button>
                    </div>`;
            } else if (p.estado === 'listo') {
                botonesAccion = `<button onclick="revertirPedido('${p.id}')" class="btn-action btn-outline" style="width:100%; font-size:0.8rem;">⬅️ Revertir</button>`;
            }

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 10px;">
                    <div>
                        <strong style="font-size: 1.1rem;">${p.cliente}</strong>
                        <div style="font-size:0.85rem; color:var(--text-muted);">${p.tipo} - $${Number(p.total).toLocaleString()}</div>
                    </div>
                    <button onclick="imprimirComanda('${encodeURIComponent(JSON.stringify(p))}')" style="background:#3b82f6; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size: 0.8rem;">🖨️ Comanda</button>
                </div>
                <div style="margin-bottom:15px; padding-left: 10px; border-left: 2px solid var(--border);">
                    ${p.items.map(i => `
                        <div style="font-size:0.95rem; margin-bottom:4px;">
                            • 1x <strong>${i.nombre}</strong> 
                            ${i.excluidos?.length > 0 ? `<div style="color:var(--danger); font-size:0.8rem; margin-left:12px;">❌ SIN: ${i.excluidos.join(', ')}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
                <div class="acciones-pedido">${botonesAccion}</div>
            `;
            if (p.estado === 'listo') la.appendChild(card);
            else lp.appendChild(card);
        });
        actualizarMétricas();
        renderizarPlanoMesas(pedidosGlobales);
    });
}

function actualizarMétricas() {
    let tHoy = 0, tMes = 0, pedidosHoyCount = 0, rechazadosHoy = 0, valorRechazados = 0;
    let tNequi = 0, tBanco = 0, tEfectivo = 0;
    const ventasPlatos = {}, usoIngredientes = {}, hoy = new Date();

    pedidosGlobales.forEach(p => {
        if(!p.timestamp) return;
        const f = p.timestamp.toDate();
        const esHoy = f.getDate() === hoy.getDate() && f.getMonth() === hoy.getMonth() && f.getFullYear() === hoy.getFullYear();

        if(esHoy) {
            if(p.estado === 'rechazado') {
                rechazadosHoy++;
                valorRechazados += Number(p.total);
            } else {
                tHoy += Number(p.total);
                pedidosHoyCount++;
                if(p.metodoPago === 'nequi') tNequi += Number(p.total);
                if(p.metodoPago === 'banco') tBanco += Number(p.total);
                if(p.metodoPago === 'efectivo') tEfectivo += Number(p.total);

                p.items.forEach(item => {
                    ventasPlatos[item.nombre] = (ventasPlatos[item.nombre] || 0) + 1;
                });
            }
        }
        if(f.getMonth() === hoy.getMonth() && f.getFullYear() === hoy.getFullYear() && p.estado !== 'rechazado') {
            tMes += Number(p.total);
        }
    });

    const setUI = (id, val) => { if(document.getElementById(id)) document.getElementById(id).innerText = val; };
    
    setUI('s-hoy', `$${tHoy.toLocaleString()}`);
    setUI('s-mes', `$${tMes.toLocaleString()}`);
    setUI('s-pedidos-total', pedidosHoyCount);
    setUI('s-nequi', `$${tNequi.toLocaleString()}`);
    setUI('s-bancolombia', `$${tBanco.toLocaleString()}`);
    setUI('s-efectivo', `$${tEfectivo.toLocaleString()}`);
    
    // Crear dinámicamente la métrica de rechazados si no existe en el HTML
    const rankingCont = document.getElementById('rankings-rechazados');
    if(rankingCont) {
        rankingCont.innerHTML = `
            <div style="width:100%; padding:15px; background:#fff1f2; border-radius:10px; border:1px solid #fecaca; text-align:center;">
                <div style="color:#e11d48; font-size:0.8rem; font-weight:600;">Pedidos Rechazados Hoy</div>
                <strong style="font-size:1.5rem; color:#be123c;">${rechazadosHoy}</strong>
                <div style="font-size:0.85rem; color:#be123c; margin-top:5px;">Pérdida: $${valorRechazados.toLocaleString()}</div>
            </div>
        `;
    }

    if(document.getElementById('rankings-categoria')) {
        document.getElementById('rankings-categoria').innerHTML = Object.entries(ventasPlatos)
            .sort((a,b) => b[1] - a[1]).slice(0,5)
            .map(([n,v]) => `<div style="padding:10px; background:#f9fafb; border-radius:8px; border:1px solid #eee; display:flex; justify-content:space-between;"><span>${n}</span> <strong>${v}</strong></div>`).join('') || "Sin ventas hoy";
    }
}

// --- FUNCIONES DE ESTADO ---
window.actualizarEstado = async (id, estado) => await updateDoc(doc(db, "pedidos", id), { estado });
window.cerrarPedido = async (id, metodoPago) => await updateDoc(doc(db, "pedidos", id), { estado: 'listo', metodoPago: metodoPago });
window.revertirPedido = async (id) => await updateDoc(doc(db, "pedidos", id), { estado: 'preparando', metodoPago: null });
window.rechazarPedido = async (id) => {
    if(confirm("¿Seguro que deseas rechazar/eliminar este pedido?")) {
        await updateDoc(doc(db, "pedidos", id), { estado: 'rechazado' });
    }
};
window.toggleDisponibilidad = async (id, disp) => await updateDoc(doc(db, "platos", id), { disponible: disp });

// --- GESTIÓN DE CARTA ---
function escucharCarta() {
    onSnapshot(collection(db, "platos"), (snap) => {
        const list = document.getElementById('inv-list');
        if (!list) return;
        const categorias = { diario: { titulo: "Menú del Día", platos: [] }, desayuno: { titulo: "Desayunos", platos: [] }, especial: { titulo: "Especiales", platos: [] }, asado: { titulo: "Asados", platos: [] }, rapida: { titulo: "Comida Rápida", platos: [] }, bebida: { titulo: "Bebidas", platos: [] }, otros: { titulo: "Otros", platos: [] } };
        snap.forEach(d => {
            const item = d.data(); item.id = d.id;
            menuGlobal[item.nombre] = item.ingredientes || [];
            if (categorias[item.categoria]) categorias[item.categoria].platos.push(item);
            else categorias['otros'].platos.push(item);
        });
        let htmlFinal = '';
        for (const key in categorias) {
            const cat = categorias[key]; if (cat.platos.length === 0) continue;
            let platosHtml = cat.platos.map(item => `
                <div style="background:white; padding:15px; margin-bottom:10px; border-radius:8px; border:1px solid #ddd; display:flex; justify-content:space-between; align-items:center;">
                    <div style="flex:1;"><strong style="font-size:1.05rem;">${item.nombre}</strong> <span style="color:var(--text-muted); font-size:0.95rem;">- $${Number(item.precio).toLocaleString()}</span></div>
                    <div style="display:flex; gap:16px; align-items:center;">
                        <label class="switch"><input type="checkbox" ${item.disponible !== false ? 'checked' : ''} onchange="toggleDisponibilidad('${item.id}', this.checked)"><span class="slider"></span></label>
                        <button onclick="editarPlato('${item.id}', '${item.nombre}', '${item.precio}', '${item.categoria}', '${item.descripcion || ''}', '${(item.ingredientes || []).join(', ')}')" style="color:#3b82f6; border:none; background:none; cursor:pointer;">${ICON_EDIT}</button>
                        <button onclick="eliminarPlatoModal('${item.id}')" style="color:var(--danger); border:none; background:none; cursor:pointer;">${ICON_TRASH}</button>
                    </div>
                </div>`).join('');
            htmlFinal += `<div class="admin-group"><div class="admin-group-header" onclick="toggleCategoria('cat-${key}', 'chev-${key}')" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; background: white; padding: 14px 16px; border-radius: 8px; border: 1px solid var(--border);"><strong>${cat.titulo} (${cat.platos.length})</strong><svg id="chev-${key}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></div><div id="cat-${key}" class="lista-categoria-oculta">${platosHtml}</div></div>`;
        }
        list.innerHTML = htmlFinal;
    });
}

// --- MODALES Y ELIMINACIÓN ---
let idParaEliminar = null;
window.eliminarPlatoModal = (id) => { idParaEliminar = id; document.getElementById('modal-title').innerText = '¿Borrar este plato?'; document.getElementById('delete-modal').style.display = 'flex'; };
window.confirmarReinicioTotal = () => { if (auth.currentUser.email !== CORREO_MASTER) return; idParaEliminar = "REINICIO_TOTAL"; document.getElementById('modal-title').innerHTML = `<span style="color:var(--danger)">¿ESTÁS SEGURO?</span><br>Se borrarán todos los pedidos y las métricas volverán a cero.`; document.getElementById('delete-modal').style.display = 'flex'; };
const btnConfirmarEliminar = document.getElementById('confirm-delete-btn');
if (btnConfirmarEliminar) {
    btnConfirmarEliminar.onclick = async () => {
        if (idParaEliminar === "REINICIO_TOTAL") {
            const promesas = pedidosGlobales.map(p => deleteDoc(doc(db, "pedidos", p.id)));
            await Promise.all(promesas);
            alert("Métricas reiniciadas.");
        } else if (idParaEliminar) await deleteDoc(doc(db, "platos", idParaEliminar));
        idParaEliminar = null; document.getElementById('delete-modal').style.display = 'none';
    };
}

// --- FORMULARIO CARTA ---
window.editarPlato = (id, nombre, precio, cat, desc, ing) => {
    document.getElementById('edit-id').value = id; document.getElementById('name').value = nombre; document.getElementById('price').value = precio; document.getElementById('category').value = cat; document.getElementById('desc').value = desc; document.getElementById('ingredients').value = ing; document.getElementById('f-title').innerText = "Editando Plato"; document.getElementById('btn-cancelar').style.display = 'block';
};
window.cancelarEdicion = () => { document.getElementById('m-form').reset(); document.getElementById('edit-id').value = ''; document.getElementById('f-title').innerText = "Configurar Plato"; document.getElementById('btn-cancelar').style.display = 'none'; };
document.getElementById('m-form').onsubmit = async (e) => {
    e.preventDefault(); const id = document.getElementById('edit-id').value;
    const datos = { nombre: document.getElementById('name').value, precio: Number(document.getElementById('price').value), categoria: document.getElementById('category').value, descripcion: document.getElementById('desc').value, ingredientes: document.getElementById('ingredients').value.split(',').map(s => s.trim()).filter(s => s !== ''), timestamp: serverTimestamp() };
    if(!id) datos.disponible = true;
    id ? await updateDoc(doc(db, "platos", id), datos) : await addDoc(collection(db, "platos"), datos);
    window.cancelarEdicion();
};

// --- PLANO DE MESAS ---
window.renderizarPlanoMesas = function(pedidos) {
    const grid = document.getElementById('grid-mesas'); if (!grid) return;
    const mesasActivas = pedidos.filter(p => p.estado !== 'listo' && p.estado !== 'rechazado' && p.cliente.toLowerCase().includes('mesa'));
    let html = '';
    for(let i = 1; i <= 12; i++) {
        const nombreMesa = `Mesa ${i}`; const pMesa = mesasActivas.find(p => p.cliente.toLowerCase() === nombreMesa.toLowerCase());
        html += pMesa ? `<div class="mesa-card mesa-ocupada"><h3>${nombreMesa}</h3><span style="font-size:0.75rem; background:var(--accent); padding:2px 6px; border-radius:4px;">OCUPADA</span><div style="margin-top:8px;">$${Number(pMesa.total).toLocaleString()}</div></div>` : `<div class="mesa-card mesa-libre"><h3>${nombreMesa}</h3><span style="color:var(--success);">Disponible</span></div>`;
    }
    grid.innerHTML = html;
};

// --- IMPRESIÓN ---
window.imprimirComanda = function(pJsonStr) {
    const p = JSON.parse(decodeURIComponent(pJsonStr));
    const div = document.createElement('div');
    div.innerHTML = `<div id="ticket-impresion"><h2 style="text-align:center;">IKU</h2><hr><p><strong>Cliente:</strong> ${p.cliente}</p><p><strong>Fecha:</strong> ${new Date().toLocaleString()}</p><hr><ul style="list-style:none; padding:0;">${p.items.map(i => `<li><strong>1x ${i.nombre}</strong> ${i.excluidos?.length > 0 ? `<br><small>- Sin: ${i.excluidos.join(', ')}</small>` : ''}</li>`).join('')}</ul><hr><h3 style="text-align:right;">Total: $${Number(p.total).toLocaleString()}</h3></div>`;
    document.body.appendChild(div); window.print(); document.body.removeChild(div);
};
