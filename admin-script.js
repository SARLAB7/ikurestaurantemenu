import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, getDoc, getDocs, serverTimestamp, addDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

const CORREO_MASTER = "cb01grupo@gmail.com";
const correosAutorizados = [CORREO_MASTER, "kelly.araujotafur@gmail.com"];

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

// --- LÓGICA DE PEDIDOS Y MÉTRICAS ---
function escucharPedidos() {
    const q = query(collection(db, "pedidos"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snapshot) => {
        pedidosGlobales = [];
        const lp = document.getElementById('l-pendientes');
        const la = document.getElementById('l-atendidos');
        lp.innerHTML = ''; la.innerHTML = '';
        
        snapshot.docs.forEach(docSnap => {
            const p = docSnap.data();
            p.id = docSnap.id;
            pedidosGlobales.push(p);

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
                
                <div class="acciones-pedido" style="margin-top:10px;">
                    ${p.estado === 'pendiente' ? 
                        `<button onclick="actualizarEstado('${p.id}', 'preparando')" class="btn-estado btn-preparar">
                            🍳 Iniciar Preparación
                        </button>` : ''
                    }
                    
                    ${p.estado === 'preparando' ? 
                        `<div style="width: 100%;">
                            <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 6px; text-align: center;">Completar y cobrar con:</div>
                            <div style="display:flex; gap:8px;">
                                <button onclick="cerrarPedido('${p.id}', 'nequi')" class="btn-pago nequi">Nequi</button>
                                <button onclick="cerrarPedido('${p.id}', 'banco')" class="btn-pago banco">Banco</button>
                                <button onclick="cerrarPedido('${p.id}', 'efectivo')" class="btn-pago efectivo">Efectivo</button>
                            </div>
                        </div>` : ''
                    }

                    ${p.estado === 'listo' ? 
                        `<div style="display:flex; justify-content:space-between; align-items:center; background: #f0fdf4; padding: 8px 12px; border-radius: 8px; border: 1px dashed var(--success);">
                            <div style="display:flex; align-items:center; gap: 8px;">
                                <span style="font-size: 1rem;">✅</span>
                                <select onchange="cambiarPago('${p.id}', this.value)" style="margin: 0; padding: 4px 8px; font-size: 0.85rem; font-weight: 600; color: var(--success); border: 1px solid #bbf7d0; border-radius: 6px; background: white; cursor: pointer;">
                                    <option value="nequi" ${p.metodoPago === 'nequi' ? 'selected' : ''}>Nequi</option>
                                    <option value="banco" ${p.metodoPago === 'banco' ? 'selected' : ''}>Banco</option>
                                    <option value="efectivo" ${p.metodoPago === 'efectivo' ? 'selected' : ''}>Efectivo</option>
                                </select>
                            </div>
                            <button onclick="revertirPedido('${p.id}')" style="background:none; border:none; color:var(--text-muted); font-size:0.75rem; cursor:pointer; text-decoration:underline;">Revertir a Preparando</button>
                        </div>` : ''
                    }
                </div>
            `;

            if (p.estado === 'listo') la.appendChild(card);
            else lp.appendChild(card);
        });

        actualizarMétricas();
        renderizarPlanoMesas(pedidosGlobales);
    });
}

function actualizarMétricas() {
    let tHoy = 0, tMes = 0;
    let tNequi = 0, tBanco = 0, tEfectivo = 0;
    const ventasPlatos = {};
    const usoIngredientes = {};
    const hoy = new Date();

    pedidosGlobales.forEach(p => {
        if(p.timestamp) {
            const f = p.timestamp.toDate();
            if(f.getDate() === hoy.getDate() && f.getMonth() === hoy.getMonth()) {
                tHoy += Number(p.total);
                if(p.metodoPago === 'nequi') tNequi += Number(p.total);
                if(p.metodoPago === 'banco') tBanco += Number(p.total);
                if(p.metodoPago === 'efectivo') tEfectivo += Number(p.total);
            }
            if(f.getMonth() === hoy.getMonth()) tMes += Number(p.total);
        }

        p.items.forEach(item => {
            ventasPlatos[item.nombre] = (ventasPlatos[item.nombre] || 0) + 1;
            
            const ingrs = menuGlobal[item.nombre] || [];
            ingrs.forEach(ing => {
                usoIngredientes[ing] = (usoIngredientes[ing] || 0) + 1;
            });
        });
    });

    if(document.getElementById('s-hoy')) document.getElementById('s-hoy').innerText = `$${tHoy.toLocaleString()}`;
    if(document.getElementById('s-mes')) document.getElementById('s-mes').innerText = `$${tMes.toLocaleString()}`;
    if(document.getElementById('s-nequi')) document.getElementById('s-nequi').innerText = `$${tNequi.toLocaleString()}`;
    if(document.getElementById('s-bancolombia')) document.getElementById('s-bancolombia').innerText = `$${tBanco.toLocaleString()}`;
    if(document.getElementById('s-efectivo')) document.getElementById('s-efectivo').innerText = `$${tEfectivo.toLocaleString()}`;

    if(document.getElementById('rankings-categoria')) {
        document.getElementById('rankings-categoria').innerHTML = Object.entries(ventasPlatos)
            .sort((a,b) => b[1] - a[1]).slice(0,5)
            .map(([n,v]) => `<div style="padding:10px; background:#f9fafb; border-radius:8px; border:1px solid #eee; display:flex; justify-content:space-between;"><span>${n}</span> <strong>${v}</strong></div>`).join('');
    }
    if(document.getElementById('rankings-ingredientes')) {
        document.getElementById('rankings-ingredientes').innerHTML = Object.entries(usoIngredientes)
            .sort((a,b) => b[1] - a[1])
            .map(([n,v]) => `<span style="background:var(--sidebar); color:white; padding:4px 10px; border-radius:20px; font-size:0.8rem;">${n} (${v})</span>`).join('');
    }
}

// --- FUNCIONES DE ESTADO ÁGIL ---
window.actualizarEstado = async (id, estado) => await updateDoc(doc(db, "pedidos", id), { estado });
window.cerrarPedido = async (id, metodoPago) => await updateDoc(doc(db, "pedidos", id), { estado: 'listo', metodoPago: metodoPago });
window.revertirPedido = async (id) => await updateDoc(doc(db, "pedidos", id), { estado: 'preparando', metodoPago: null });
window.cambiarPago = async (id, nuevoMetodo) => await updateDoc(doc(db, "pedidos", id), { metodoPago: nuevoMetodo });
window.toggleDisponibilidad = async (id, disp) => await updateDoc(doc(db, "platos", id), { disponible: disp });

// --- LÓGICA DE CARTA AGRUPADA ---
function escucharCarta() {
    onSnapshot(collection(db, "platos"), (snap) => {
        const list = document.getElementById('inv-list');
        if (!list) return;

        // 1. Definir las categorías con sus títulos y un array vacío para sus platos
        const categorias = {
            diario: { titulo: "Menú del Día", platos: [] },
            desayuno: { titulo: "Desayunos", platos: [] },
            especial: { titulo: "Especiales", platos: [] },
            asado: { titulo: "Asados", platos: [] },
            rapida: { titulo: "Comida Rápida", platos: [] },
            bebida: { titulo: "Bebidas", platos: [] },
            otros: { titulo: "Otros", platos: [] }
        };

        // 2. Llenar las categorías con los datos de Firebase
        snap.forEach(d => {
            const item = d.data();
            item.id = d.id;
            menuGlobal[item.nombre] = item.ingredientes || [];

            if (categorias[item.categoria]) {
                categorias[item.categoria].platos.push(item);
            } else {
                categorias['otros'].platos.push(item);
            }
        });

        actualizarMétricas();

        // 3. Generar el HTML
        let htmlFinal = '';
        for (const key in categorias) {
            const cat = categorias[key];
            if (cat.platos.length === 0) continue;

            let platosHtml = '';
            cat.platos.forEach(item => {
                const ingTexto = (item.ingredientes || []).join(', ');
                platosHtml += `
                <div style="background:white; padding:15px; margin-bottom:10px; border-radius:8px; border:1px solid #ddd; display:flex; justify-content:space-between; align-items:center;">
                    <div style="flex:1;">
                        <strong style="font-size:1.05rem;">${item.nombre}</strong> <span style="color:var(--text-muted); font-size:0.95rem;">- $${Number(item.precio).toLocaleString()}</span><br>
                        ${item.descripcion ? `<span style="font-size:0.85rem; color:#6b7280; display:block; margin-top:4px;">${item.descripcion}</span>` : ''}
                    </div>
                    <div style="display:flex; gap:16px; align-items:center;">
                        <label class="switch">
                            <input type="checkbox" ${item.disponible !== false ? 'checked' : ''} onchange="toggleDisponibilidad('${item.id}', this.checked)">
                            <span class="slider"></span>
                        </label>
                        <button onclick="editarPlato('${item.id}', '${item.nombre}', '${item.precio}', '${item.categoria}', '${item.descripcion || ''}', '${ingTexto}')" style="color:#3b82f6; border:none; background:none; cursor:pointer;">${ICON_EDIT}</button>
                        <button onclick="eliminarPlatoModal('${item.id}')" style="color:var(--danger); border:none; background:none; cursor:pointer;">${ICON_TRASH}</button>
                    </div>
                </div>`;
            });

            htmlFinal += `
            <div class="admin-group" style="margin-bottom: 15px;">
                <div class="admin-group-header" onclick="toggleCategoria('cat-${key}', 'chev-${key}')" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; background: white; padding: 14px 16px; border-radius: 8px; border: 1px solid var(--border);">
                    <strong>${cat.titulo} (${cat.platos.length})</strong>
                    <svg id="chev-${key}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
                <div id="cat-${key}" class="lista-categoria-oculta" style="margin-top: 12px; padding: 0 4px;">
                    ${platosHtml}
                </div>
            </div>`;
        }
        list.innerHTML = htmlFinal;
    });
}

        snap.forEach(d => {
            const item = d.data();
            item.id = d.id;
            
            menuGlobal[item.nombre] = item.ingredientes || [];

            if (categorias[item.categoria]) {
                categorias[item.categoria].platos.push(item);
            } else {
                categorias['otros'].platos.push(item);
            }
        });

        actualizarMétricas();

        let htmlFinal = '';
        for (const key in categorias) {
            const cat = categorias[key];
            if (cat.platos.length === 0) continue;

            let platosHtml = '';
            cat.platos.forEach(item => {
                const ingTexto = (item.ingredientes || []).join(', ');
                
                platosHtml += `
                <div style="background:white; padding:15px; margin-bottom:10px; border-radius:8px; border:1px solid #ddd; display:flex; justify-content:space-between; align-items:center;">
                    <div style="flex:1;">
                        <strong style="font-size:1.05rem;">${item.nombre}</strong> <span style="color:var(--text-muted); font-size:0.95rem;">- $${Number(item.precio).toLocaleString()}</span><br>
                        ${item.descripcion ? `<span style="font-size:0.85rem; color:#6b7280; display:block; margin-top:4px;">${item.descripcion}</span>` : ''}
                        ${item.ingredientes && item.ingredientes.length > 0 ? `<div style="margin-top:6px;">${item.ingredientes.map(i => `<span style="background:#f1f5f9; padding:3px 8px; border-radius:6px; font-size:0.75rem; margin-right:4px;">${i}</span>`).join('')}</div>` : ''}
                    </div>
                    <div style="display:flex; gap:16px; align-items:center;">
                        <label class="switch">
                            <input type="checkbox" ${item.disponible !== false ? 'checked' : ''} onchange="toggleDisponibilidad('${item.id}', this.checked)">
                            <span class="slider"></span>
                        </label>
                        <button onclick="editarPlato('${item.id}', '${item.nombre}', '${item.precio}', '${item.categoria}', '${item.descripcion || ''}', '${ingTexto}')" style="color:#3b82f6; border:none; background:none; cursor:pointer;" title="Editar">${ICON_EDIT}</button>
                        <button onclick="eliminarPlatoModal('${item.id}')" style="color:var(--danger); border:none; background:none; cursor:pointer;" title="Eliminar">${ICON_TRASH}</button>
                    </div>
                </div>`;
            });

            htmlFinal += `
            <div class="admin-group" style="margin-bottom: 15px;">
                <div class="admin-group-header" onclick="toggleCategoria('cat-${key}', 'chev-${key}')" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; background: white; padding: 14px 16px; border-radius: 8px; border: 1px solid var(--border); box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                    <strong style="color: var(--sidebar); font-size: 1rem;">${cat.titulo} <span style="color:var(--text-muted); font-size:0.85rem; font-weight:normal;">(${cat.platos.length} platos)</span></strong>
                    <svg id="chev-${key}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transition: transform 0.3s; transform: rotate(0deg);"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
                <div id="cat-${key}" class="lista-categoria-oculta" style="margin-top: 12px; padding: 0 4px;">
                    ${platosHtml}
                </div>
            </div>`;
        }

        list.innerHTML = htmlFinal;
    });
}

// --- LÓGICA PARA EL MODAL PERSONALIZADO ---
let idParaEliminar = null;

window.eliminarPlatoModal = (id) => {
    idParaEliminar = id;
    document.getElementById('modal-title').innerText = '¿Borrar este plato?';
    document.getElementById('delete-modal').style.display = 'flex';
};

const btnConfirmarEliminar = document.getElementById('confirm-delete-btn');
if (btnConfirmarEliminar) {
    btnConfirmarEliminar.onclick = async () => {
        if (idParaEliminar) {
            await deleteDoc(doc(db, "platos", idParaEliminar));
            idParaEliminar = null;
            document.getElementById('delete-modal').style.display = 'none';
        }
    };
}

window.editarPlato = (id, nombre, precio, cat, desc, ing) => {
    document.getElementById('edit-id').value = id;
    document.getElementById('name').value = nombre;
    document.getElementById('price').value = precio;
    document.getElementById('category').value = cat;
    document.getElementById('desc').value = desc;
    document.getElementById('ingredients').value = ing;
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
        ingredientes: document.getElementById('ingredients').value.split(',').map(s => s.trim()).filter(s => s !== ''),
        timestamp: serverTimestamp()
    };
    if(!id) datos.disponible = true;
    
    id ? await updateDoc(doc(db, "platos", id), datos) : await addDoc(collection(db, "platos"), datos);
    window.cancelarEdicion();
};

// --- MESAS E IMPRESIÓN ---
window.renderizarPlanoMesas = function(pedidos) {
    const grid = document.getElementById('grid-mesas');
    if (!grid) return;
    const mesasActivas = pedidos.filter(p => p.estado !== 'listo' && p.cliente.toLowerCase().includes('mesa'));
    
    let html = '';
    for(let i = 1; i <= 12; i++) {
        const nombreMesa = `Mesa ${i}`;
        const pMesa = mesasActivas.find(p => p.cliente.toLowerCase() === nombreMesa.toLowerCase());
        
        if(pMesa) {
            html += `
            <div class="mesa-card mesa-ocupada" onclick="cambiarVista('v-pedidos', document.querySelector('.nav-item:nth-child(2)'))">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 8px; color: #d97706;"><path d="M17 11h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h2"/><path d="M9 11V6a3 3 0 0 1 6 0v5"/><path d="M12 11v6"/></svg>
                <h3 style="margin-bottom:4px; font-weight:600;">${nombreMesa}</h3>
                <span style="font-size:0.75rem; background:var(--accent); color:#000; padding:2px 6px; border-radius:4px; font-weight: 500;">OCUPADA</span>
                <div style="font-size:0.9rem; margin-top:8px; font-weight:600; color:var(--text-main);">$${Number(pMesa.total).toLocaleString()}</div>
            </div>`;
        } else {
            html += `
            <div class="mesa-card mesa-libre">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 8px; color: var(--success); opacity: 0.5;"><rect x="3" y="8" width="18" height="4" rx="1"/><line x1="12" y1="8" x2="12" y2="21"/><line x1="19" y1="12" x2="19" y2="21"/><line x1="5" y1="12" x2="5" y2="21"/></svg>
                <h3 style="margin-bottom:4px; font-weight:600;">${nombreMesa}</h3>
                <span style="font-size:0.8rem; color:var(--success); font-weight: 500;">Disponible</span>
            </div>`;
        }
    }
    grid.innerHTML = html;
};

window.imprimirComanda = function(pJsonStr) {
    const p = JSON.parse(decodeURIComponent(pJsonStr));
    const fecha = new Date().toLocaleString();
    let ticketHTML = `
        <div id="ticket-impresion">
            <h2 style="text-align:center; margin-bottom:5px;">IKU RESTAURANTE</h2>
            <p style="text-align:center; margin-top:0; font-size:12px;">Comanda</p>
            <hr style="border-top:1px dashed #000; margin:10px 0;">
            <p style="margin: 5px 0;"><strong>Cliente:</strong> ${p.cliente}</p>
            <p style="margin: 5px 0;"><strong>Fecha:</strong> ${fecha}</p>
            <hr style="border-top:1px dashed #000; margin:10px 0;">
            <ul style="list-style:none; padding:0; margin:0;">
                ${p.items.map(i => `<li style="margin-bottom:8px; font-size: 14px;"><strong>1x ${i.nombre}</strong> <br>${i.nota ? `<span style="font-size:12px; margin-left:15px;">- Nota: ${i.nota}</span>` : ''}</li>`).join('')}
            </ul>
            <hr style="border-top:1px dashed #000; margin:10px 0;">
            <h3 style="text-align:right; margin: 5px 0;">Total: $${Number(p.total).toLocaleString()}</h3>
        </div>
    `;
    const div = document.createElement('div');
    div.innerHTML = ticketHTML;
    document.body.appendChild(div);
    window.print();
    document.body.removeChild(div);
};
