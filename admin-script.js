import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, serverTimestamp, addDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

const CORREO_MASTER = "cb01grupo@gmail.com";
const correosAutorizados = [CORREO_MASTER, "kelly.araujotafur@gmail.com"];

// Iconos Minimalistas
const ICON_PREPARE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>`;
const ICON_X = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
const ICON_EDIT = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const ICON_TRASH = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');

if (loginBtn) loginBtn.onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
if (logoutBtn) logoutBtn.onclick = () => signOut(auth);

onAuthStateChanged(auth, (u) => {
    if(u && correosAutorizados.includes(u.email)) {
        document.getElementById('admin-panel').style.display = 'flex';
        document.getElementById('login-screen').style.display = 'none';
        if(u.email === CORREO_MASTER) document.getElementById('master-tools').style.display = 'block';
        escucharCarta(); escucharPedidos(); 
    } else {
        if(u) signOut(auth);
        document.getElementById('admin-panel').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
    }
});

let menuGlobal = {}, pedidosGlobales = [], idParaEliminar = null;

function escucharPedidos() {
    onSnapshot(query(collection(db, "pedidos"), orderBy("timestamp", "desc")), (snap) => {
        pedidosGlobales = [];
        const lp = document.getElementById('l-pendientes'), la = document.getElementById('l-atendidos');
        if(!lp || !la) return;
        lp.innerHTML = ''; la.innerHTML = '';
        
        snap.docs.forEach(docSnap => {
            const p = docSnap.data(); p.id = docSnap.id;
            pedidosGlobales.push(p);
            if (p.estado === 'rechazado') return;

            const card = document.createElement('div');
            card.className = `pedido-card ${p.estado}`;
            card.id = `card-${p.id}`;
            
            let botonesAccion = '';
            if (p.estado === 'pendiente') {
                botonesAccion = `<div style="display:flex; gap:8px;"><button onclick="actualizarEstado('${p.id}', 'preparando')" class="btn-estado btn-preparar" style="flex:3; background:var(--sidebar); color:var(--accent); border:1px solid var(--accent); display:flex; align-items:center; justify-content:center; gap:8px;">${ICON_PREPARE} PREPARAR</button><button onclick="rechazarPedido('${p.id}')" class="btn-action" style="background:#f9fafb; color:#ef4444; border:1px solid #fee2e2; flex:1; display:flex; align-items:center; justify-content:center;">${ICON_X}</button></div>`;
            } else if (p.estado === 'preparando') {
                botonesAccion = `<div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:8px; margin-bottom:8px;"><button onclick="cerrarPedido('${p.id}', 'nequi')" class="btn-pago nequi">NEQUI</button><button onclick="cerrarPedido('${p.id}', 'banco')" class="btn-pago banco">BANCO</button><button onclick="cerrarPedido('${p.id}', 'efectivo')" class="btn-pago efectivo">EFECTIVO</button></div><button onclick="rechazarPedido('${p.id}')" class="btn-action" style="width:100%; background:#f9fafb; color:#ef4444; font-size:0.7rem;">${ICON_X} RECHAZAR PEDIDO</button>`;
            } else {
                botonesAccion = `<button onclick="revertirPedido('${p.id}')" class="btn-action btn-outline" style="width:100%; font-size:0.8rem;">${ICON_PREPARE} REVERTIR Y REASIGNAR</button>`;
            }

            card.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 10px;"><div><strong style="font-size: 1.1rem;">${p.cliente}</strong><div style="font-size:0.85rem; color:var(--text-muted);">${p.tipo} - $${Number(p.total).toLocaleString()}</div></div><button onclick="imprimirComanda('${encodeURIComponent(JSON.stringify(p))}')" style="background:#3b82f6; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size: 0.8rem;">🖨️</button></div><div style="margin-bottom:15px; padding-left:10px; border-left:2px solid var(--border);">${p.items.map(i => `<div style="font-size:0.95rem;">• 1x ${i.nombre} ${i.excluidos?.length > 0 ? `<span style="color:var(--danger); font-size:0.8rem;">(SIN: ${i.excluidos.join(', ')})</span>` : ''}</div>`).join('')}</div><div class="acciones-pedido">${botonesAccion}</div>`;
            if (p.estado === 'listo') la.appendChild(card); else lp.appendChild(card);
        });
        actualizarMétricas(); renderizarPlanoMesas(pedidosGlobales);
    });
}

function actualizarMétricas() {
    let tVentas = 0, tMes = 0, pedidosContados = 0, rechazadosContados = 0, valorRechazados = 0;
    let tNequi = 0, tBanco = 0, tEfectivo = 0;
    
    const ventasPlatos = {};
    const usoIngredientes = {}; 
    const ahora = new Date();
    
    // CAPTURAR EL VALOR DEL SELECTOR
    const filtro = document.getElementById('periodo-selector')?.value || 'hoy';

    pedidosGlobales.forEach(p => {
        if(!p.timestamp) return;
        const f = p.timestamp.toDate();
        
        // Lógica de comparación de fechas
        let cumpleFiltro = false;
        
        const esMismoDia = f.getDate() === ahora.getDate() && 
                           f.getMonth() === ahora.getMonth() && 
                           f.getFullYear() === ahora.getFullYear();

        if (filtro === 'hoy') {
            cumpleFiltro = esMismoDia;
        } else if (filtro === 'semana') {
            const haceUnaSemana = new Date();
            haceUnaSemana.setDate(ahora.getDate() - 7);
            cumpleFiltro = f >= haceUnaSemana;
        } else if (filtro === 'mes') {
            cumpleFiltro = f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear();
        } else if (filtro === 'total') {
            cumpleFiltro = true;
        }

        if(cumpleFiltro) {
            if(p.estado === 'rechazado') {
                rechazadosContados++;
                valorRechazados += Number(p.total);
            } else {
                tVentas += Number(p.total);
                pedidosContados++;
                
                if(p.metodoPago === 'nequi') tNequi += Number(p.total);
                if(p.metodoPago === 'banco') tBanco += Number(p.total);
                if(p.metodoPago === 'efectivo') tEfectivo += Number(p.total);

                // Top Platos e Ingredientes
                p.items.forEach(item => {
                    ventasPlatos[item.nombre] = (ventasPlatos[item.nombre] || 0) + 1;
                    const ingBase = menuGlobal[item.nombre] || [];
                    const excluidos = item.excluidos || [];
                    ingBase.forEach(ing => {
                        if (!excluidos.includes(ing)) {
                            usoIngredientes[ing] = (usoIngredientes[ing] || 0) + 1;
                        }
                    });
                });
            }
        }
        // El acumulado del mes siempre se calcula para la tarjeta fija si lo deseas
        if(f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear() && p.estado !== 'rechazado') {
            tMes += Number(p.total);
        }
    });

    // RENDERIZADO (IDs del HTML)
    const setUI = (id, val) => { if(document.getElementById(id)) document.getElementById(id).innerText = val; };
    
    setUI('s-hoy', `$${tVentas.toLocaleString()}`);
    setUI('s-pedidos-total', pedidosContados);
    setUI('s-mes', `$${tMes.toLocaleString()}`);
    setUI('s-nequi', `$${tNequi.toLocaleString()}`);
    setUI('s-bancolombia', `$${tBanco.toLocaleString()}`);
    setUI('s-efectivo', `$${tEfectivo.toLocaleString()}`);

    // Refrescar rankings
    renderizarRankings(ventasPlatos, usoIngredientes, valorRechazados, rechazadosContados);
}

// Función auxiliar para limpiar el código de arriba
function renderizarRankings(ventasPlatos, usoIngredientes, valorRechazados, rechazadosContados) {
    const rPlatos = document.getElementById('rankings-categoria');
    if(rPlatos) {
        const sorted = Object.entries(ventasPlatos).sort((a,b) => b[1] - a[1]).slice(0,5);
        rPlatos.innerHTML = sorted.map(([n,v]) => `
            <div style="padding:10px; background:#f9fafb; border-radius:8px; border:1px solid #eee; display:flex; justify-content:space-between;">
                <span>${n}</span> <strong>${v}</strong>
            </div>`).join('') || "Sin datos";
    }

    const rIng = document.getElementById('rankings-ingredientes');
    if(rIng) {
        const sortedIng = Object.entries(usoIngredientes).sort((a,b) => b[1] - a[1]);
        rIng.innerHTML = sortedIng.map(([n,v]) => `
            <span style="background:#f0fdf4; color:#166534; border:1px solid #bbf7d0; padding:4px 10px; border-radius:20px; font-size:0.75rem;">${n} (${v})</span>
        `).join('') || "Sin datos";
    }

    const rRechazados = document.getElementById('rankings-rechazados');
    if(rRechazados) {
        rRechazados.innerHTML = `
            <div style="width:100%; padding:20px; background:white; border-radius:12px; border:1px solid #f3f4f6; display:flex; align-items:center; gap:15px;">
                <div style="background:#fff1f2; padding:12px; border-radius:10px; color:#e11d48;">${ICON_X}</div>
                <div style="text-align:left;">
                    <div style="color:var(--text-muted); font-size:0.75rem; font-weight:600; text-transform:uppercase;">Pérdidas Periodo</div>
                    <strong style="font-size:1.4rem;">$${valorRechazados.toLocaleString()}</strong>
                    <div style="font-size:0.8rem; color:#be123c;">${rechazadosContados} pedidos cancelados</div>
                </div>
            </div>`;
    }
}
        // Acumulado del mes para la tarjeta fija
        if(f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear() && p.estado !== 'rechazado') tMes += Number(p.total);
    });

    const setUI = (id, val) => { if(document.getElementById(id)) document.getElementById(id).innerText = val; };
    setUI('s-hoy', `$${tVentas.toLocaleString()}`);
    setUI('s-pedidos-total', pedidosContados);
    setUI('s-mes', `$${tMes.toLocaleString()}`);
    setUI('s-nequi', `$${tNequi.toLocaleString()}`);
    setUI('s-bancolombia', `$${tBanco.toLocaleString()}`);
    setUI('s-efectivo', `$${tEfectivo.toLocaleString()}`);

    const rRechazados = document.getElementById('rankings-rechazados');
    if(rRechazados) {
        rRechazados.innerHTML = `<div style="width:100%; padding:20px; background:white; border-radius:12px; border:1px solid #f3f4f6; display:flex; align-items:center; gap:15px;"><div style="background:#fff1f2; padding:12px; border-radius:10px; color:#e11d48;">${ICON_X}</div><div style="text-align:left;"><div style="color:var(--text-muted); font-size:0.75rem; font-weight:600; text-transform:uppercase;">Pérdidas Periodo</div><strong style="font-size:1.4rem;">$${valorRechazados.toLocaleString()}</strong><div style="font-size:0.8rem; color:#be123c;">${rechazadosContados} pedidos cancelados</div></div></div>`;
    }

    const rPlatos = document.getElementById('rankings-categoria');
    if(rPlatos) {
        const sorted = Object.entries(ventasPlatos).sort((a,b) => b[1] - a[1]).slice(0,5);
        rPlatos.innerHTML = sorted.map(([n,v]) => `<div style="padding:10px; background:#f9fafb; border-radius:8px; border:1px solid #eee; display:flex; justify-content:space-between;"><span>${n}</span> <strong>${v}</strong></div>`).join('') || "Sin datos";
    }

    const rIng = document.getElementById('rankings-ingredientes');
    if(rIng) {
        const sortedIng = Object.entries(usoIngredientes).sort((a,b) => b[1] - a[1]);
        rIng.innerHTML = sortedIng.map(([n,v]) => `<span style="background:#f0fdf4; color:#166534; border:1px solid #bbf7d0; padding:4px 10px; border-radius:20px; font-size:0.75rem;">${n} (${v})</span>`).join('') || "Sin datos";
    }
}

// Funciones de estado
window.actualizarEstado = async (id, estado) => await updateDoc(doc(db, "pedidos", id), { estado });
window.cerrarPedido = async (id, m) => await updateDoc(doc(db, "pedidos", id), { estado: 'listo', metodoPago: m });
window.revertirPedido = async (id) => await updateDoc(doc(db, "pedidos", id), { estado: 'preparando', metodoPago: null });
window.rechazarPedido = (id) => { idParaEliminar = "RECHAZAR:" + id; document.getElementById('modal-title').innerHTML = `<span style="color:var(--danger)">¿Rechazar pedido?</span>`; document.getElementById('delete-modal').style.display = 'flex'; };
window.eliminarPlatoModal = (id) => { idParaEliminar = id; document.getElementById('modal-title').innerText = '¿Borrar plato?'; document.getElementById('delete-modal').style.display = 'flex'; };
window.confirmarReinicioTotal = () => { idParaEliminar = "MASTER"; document.getElementById('modal-title').innerText = '¿REINICIAR TODO?'; document.getElementById('delete-modal').style.display = 'flex'; };

const btnConfirmar = document.getElementById('confirm-delete-btn');
if(btnConfirmar) {
    btnConfirmar.onclick = async () => {
        if(idParaEliminar === "MASTER") {
            const ps = pedidosGlobales.map(p => deleteDoc(doc(db, "pedidos", p.id))); await Promise.all(ps);
        } else if(idParaEliminar?.startsWith("RECHAZAR:")) {
            await updateDoc(doc(db, "pedidos", idParaEliminar.split(":")[1]), { estado: 'rechazado' });
        } else if(idParaEliminar) {
            await deleteDoc(doc(db, "platos", idParaEliminar));
        }
        idParaEliminar = null; document.getElementById('delete-modal').style.display = 'none';
    };
}

window.irAPedido = (id) => {
    document.querySelector('[onclick*="v-pedidos"]').click();
    setTimeout(() => {
        const el = document.getElementById(`card-${id}`);
        if(el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.style.border = "2px solid var(--accent)"; setTimeout(() => el.style.border = "none", 2000); }
    }, 200);
};

window.renderizarPlanoMesas = (ps) => {
    const g = document.getElementById('grid-mesas'); if(!g) return;
    const mas = ps.filter(p => p.estado !== 'listo' && p.estado !== 'rechazado' && p.cliente.toLowerCase().includes('mesa'));
    let h = '';
    for(let i=1; i<=12; i++) {
        const n = `Mesa ${i}`, p = mas.find(x => x.cliente.toLowerCase() === n.toLowerCase());
        h += p ? `<div class="mesa-card mesa-ocupada" onclick="irAPedido('${p.id}')" style="cursor:pointer;"><h3>${n}</h3><span style="font-size:0.75rem; background:var(--accent); padding:2px 6px; border-radius:4px;">OCUPADA</span><div>$${Number(p.total).toLocaleString()}</div></div>` : `<div class="mesa-card mesa-libre"><h3>${n}</h3><span style="color:var(--success);">Disponible</span></div>`;
    }
    g.innerHTML = h;
};

function escucharCarta() {
    onSnapshot(collection(db, "platos"), (snap) => {
        const list = document.getElementById('inv-list'); if (!list) return;
        const cats = { diario: { titulo: "Menú del Día", platos: [] }, desayuno: { titulo: "Desayunos", platos: [] }, especial: { titulo: "Especiales", platos: [] }, asado: { titulo: "Asados", platos: [] }, rapida: { titulo: "Comida Rápida", platos: [] }, bebida: { titulo: "Bebidas", platos: [] }, otros: { titulo: "Otros", platos: [] } };
        snap.forEach(d => {
            const it = d.data(); it.id = d.id; menuGlobal[it.nombre] = it.ingredientes || [];
            if (cats[it.categoria]) cats[it.categoria].platos.push(it); else cats['otros'].platos.push(it);
        });
        let h = '';
        for (const k in cats) {
            if (cats[k].platos.length === 0) continue;
            let ph = cats[k].platos.map(it => `<div style="background:white; padding:15px; margin-bottom:10px; border-radius:8px; border:1px solid #ddd; display:flex; justify-content:space-between; align-items:center;"><div style="flex:1;"><strong>${it.nombre}</strong> <span style="color:var(--text-muted);">$${Number(it.precio).toLocaleString()}</span></div><div style="display:flex; gap:16px; align-items:center;"><button onclick="editarPlato('${it.id}', '${it.nombre}', '${it.precio}', '${it.categoria}', '${it.descripcion || ''}', '${(it.ingredientes || []).join(', ')}')" style="color:#3b82f6; border:none; background:none;">${ICON_EDIT}</button><button onclick="eliminarPlatoModal('${it.id}')" style="color:var(--danger); border:none; background:none;">${ICON_TRASH}</button></div></div>`).join('');
            h += `<div class="admin-group"><div class="admin-group-header" onclick="toggleCategoria('cat-${k}', 'chev-${k}')"><strong>${cats[k].titulo} (${cats[k].platos.length})</strong></div><div id="cat-${k}" class="lista-categoria-oculta">${ph}</div></div>`;
        }
        list.innerHTML = h;
    });
}

window.editarPlato = (id, n, p, c, d, i) => {
    document.getElementById('edit-id').value = id; document.getElementById('name').value = n; document.getElementById('price').value = p; document.getElementById('category').value = c; document.getElementById('desc').value = d; document.getElementById('ingredients').value = i; document.getElementById('f-title').innerText = "Editando Plato"; document.getElementById('btn-cancelar').style.display = 'block';
};
window.cancelarEdicion = () => { document.getElementById('m-form').reset(); document.getElementById('edit-id').value = ''; document.getElementById('f-title').innerText = "Configurar Plato"; document.getElementById('btn-cancelar').style.display = 'none'; };
document.getElementById('m-form').onsubmit = async (e) => {
    e.preventDefault(); const id = document.getElementById('edit-id').value;
    const datos = { nombre: document.getElementById('name').value, precio: Number(document.getElementById('price').value), categoria: document.getElementById('category').value, descripcion: document.getElementById('desc').value, ingredientes: document.getElementById('ingredients').value.split(',').map(s => s.trim()).filter(s => s !== ''), timestamp: serverTimestamp() };
    if(!id) datos.disponible = true; id ? await updateDoc(doc(db, "platos", id), datos) : await addDoc(collection(db, "platos"), datos); window.cancelarEdicion();
};

window.imprimirComanda = (ps) => {
    const p = JSON.parse(decodeURIComponent(ps));
    const div = document.createElement('div');
    div.innerHTML = `<div id="ticket-impresion"><h2 style="text-align:center;">IKU</h2><hr><p><strong>Cliente:</strong> ${p.cliente}</p><p><strong>Fecha:</strong> ${new Date().toLocaleString()}</p><hr><ul style="list-style:none; padding:0;">${p.items.map(i => `<li><strong>1x ${i.nombre}</strong> ${i.excluidos?.length > 0 ? `<br><small>- Sin: ${i.excluidos.join(', ')}</small>` : ''}</li>`).join('')}</ul><hr><h3 style="text-align:right;">Total: $${Number(p.total).toLocaleString()}</h3></div>`;
    document.body.appendChild(div); window.print(); document.body.removeChild(div);
};
