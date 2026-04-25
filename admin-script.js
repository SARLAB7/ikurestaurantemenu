import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, getDoc, getDocs, serverTimestamp, addDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

const CORREO_MASTER = "cb01grupo@gmail.com";
const correosAutorizados = [CORREO_MASTER, "kelly.araujotafur@gmail.com"];

const ICON_EDIT = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const ICON_TRASH = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;
const ICON_USER = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

let primeraCarga = true;
let catalogoPlatos = {}; 

const escucharPedidos = () => {
    onSnapshot(query(collection(db, "pedidos"), orderBy("timestamp", "asc")), (sn) => {
        const lp = document.getElementById('l-pendientes');
        const la = document.getElementById('l-atendidos');
        const listaPedidos = [];
        const hoy = new Date().toDateString();

        sn.docChanges().forEach(change => {
            if (change.type === "added" && !primeraCarga) {
                if (change.doc.data().estado === 'pendiente') {
                    document.getElementById('notif-sound')?.play().catch(() => {});
                }
            }
        });
        primeraCarga = false;

        lp.innerHTML = ''; la.innerHTML = '';
        sn.docs.forEach(docSnap => {
            const p = docSnap.data();
            listaPedidos.push(p);

            const itemsHTML = p.items.map(i => `
                <div style="margin-bottom:8px; display:flex; flex-direction:column; border-bottom:1px solid #f9fafb; padding-bottom:6px;">
                    <strong style="font-weight:500;">1x ${i.nombre}</strong> 
                    ${i.nota ? `<span class="item-nota">Nota cliente: ${i.nota}</span>` : ''}
                </div>
            `).join('');

            const itemsJson = encodeURIComponent(JSON.stringify(p.items));
            const pJson = encodeURIComponent(JSON.stringify(p));

            let horaLlegada = '';
            let tiempoPrepStr = '';

            if (p.timestamp) {
                const fechaLlegada = p.timestamp?.toDate ? p.timestamp.toDate() : new Date();
                horaLlegada = fechaLlegada.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                if (p.estado === 'completado' && p.completadoAt) {
                    const fechaFin = p.completadoAt?.toDate ? p.completadoAt.toDate() : new Date();
                    const diffMinutos = Math.round((fechaFin - fechaLlegada) / 60000);
                    tiempoPrepStr = `<span class="badge badge-time">${diffMinutos} min</span>`;
                }
            }

            if (p.estado === 'pendiente' || p.estado === 'preparando') {
                const esPreparando = p.estado === 'preparando';
                const cardClass = esPreparando ? 'pedido-card preparando' : 'pedido-card';
                
                let btnAccion = esPreparando 
                    ? `<div style="display:flex; flex-wrap:wrap; gap:8px;">
                        <button class="btn-action btn-payment" onclick="finalizarPedido('${docSnap.id}', 'nequi')">Nequi</button>
                        <button class="btn-action btn-payment" onclick="finalizarPedido('${docSnap.id}', 'bancolombia')">Banco</button>
                        <button class="btn-action btn-payment" onclick="finalizarPedido('${docSnap.id}', 'efectivo')">Efectivo</button>
                       </div>`
                    : `<div style="display:flex; gap:10px;">
                        <button class="btn-action btn-primary" style="background:#0f1115;" onclick="cambiarEstado('${docSnap.id}', 'preparando', '${itemsJson}')">Cocinar</button>
                        <button class="btn-action btn-outline" style="padding:10px;" onclick="imprimirComanda('${pJson}')">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                        </button>
                       </div>`;

                lp.innerHTML += `
                <div class="${cardClass}">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:12px; margin-bottom:16px;">
                        <div style="display:flex; flex-direction:column; gap:4px;">
                            <strong style="display:flex; align-items:center; color:var(--text-main); font-size:1rem;">${ICON_USER} ${p.cliente}</strong>
                            <span style="font-size:0.75rem; color:var(--text-muted);">${horaLlegada}</span>
                        </div>
                        <span class="badge badge-outline" style="text-transform:uppercase; letter-spacing:0.5px;">${p.tipo}</span>
                    </div>
                    <div style="margin:16px 0; color:var(--text-main); font-size:0.9rem;">${itemsHTML}</div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px;">
                        <span style="font-weight:600; color:var(--text-main); font-size:1.1rem;">$${Number(p.total).toLocaleString()}</span>
                        ${btnAccion}
                    </div>
                </div>`;
            } else if (p.estado === 'completado' && p.timestamp?.toDate().toDateString() === hoy) {
                la.innerHTML += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:16px 0; border-bottom:1px solid #f3f4f6; font-size:0.9rem;">
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <strong style="color:var(--text-main);">${p.cliente}</strong>
                        <span style="color:var(--text-muted); font-size:0.75rem;">${p.tipo} • Pago: ${p.metodoPago || 'Efectivo'}</span>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
                        <span style="font-weight:600; color:var(--text-main);">$${Number(p.total).toLocaleString()}</span>
                        ${tiempoPrepStr}
                    </div>
                </div>`;
            }
        });
        procesarEstadisticas(listaPedidos);
    });
};

window.imprimirComanda = (pedidoJson) => {
    const p = JSON.parse(decodeURIComponent(pedidoJson));
    const v = window.open('', '_blank', 'width=300,height=600');
    v.document.write(`
        <style>body{font-family:monospace; margin:0; padding:10px; font-size:12px;} h3, h4{margin:5px 0;} .item{display:flex;justify-content:space-between; margin-bottom:5px;} .nota{font-size:10px; font-style:italic; font-weight:bold; border-left: 2px solid #000; padding-left: 5px;}</style>
        <div style="text-align:center;"><h3>IKU RESTAURANTE</h3><p>${new Date().toLocaleString()}</p></div>
        <hr>
        <h4>Cliente: ${p.cliente}</h4>
        <h4>Servicio: ${p.tipo.toUpperCase()}</h4>
        <hr>
        ${p.items.map(i => `<div class="item"><span>1x ${i.nombre}</span></div>${i.nota?`<div class="nota">Nota: ${i.nota}</div>`:''}`).join('')}
        <hr>
        <h3 style="text-align:right;">Total: $${Number(p.total).toLocaleString()}</h3>
        <script>setTimeout(()=>{window.print(); window.close();}, 500);</script>
    `);
};

window.cambiarEstado = async (id, nuevoEstado, itemsStr) => {
    await updateDoc(doc(db, "pedidos", id), { estado: nuevoEstado });
};

window.finalizarPedido = async (id, metodoCaja) => {
    await updateDoc(doc(db, "pedidos", id), { 
        estado: 'completado',
        metodoPago: metodoCaja,
        completadoAt: serverTimestamp() 
    });
};

const procesarEstadisticas = (pedidos) => {
    const ahora = new Date();
    const hoyStr = ahora.toDateString();
    const mesKey = `${ahora.getMonth() + 1}-${ahora.getFullYear()}`;
    
    let totalHoy = 0, totalMes = 0;
    let tNequi = 0, tBanco = 0, tEfec = 0; 
    const conteoPlatos = {};
    const conteoIngredientes = {};

    pedidos.forEach(p => {
        if (p.estado !== 'completado' || !p.timestamp) return;
        const fecha = p.timestamp.toDate();
        const pMesKey = `${fecha.getMonth() + 1}-${fecha.getFullYear()}`;
        
        if (fecha.toDateString() === hoyStr) {
            const valor = Number(p.total);
            totalHoy += valor;
            if(p.metodoPago === 'nequi') tNequi += valor;
            else if(p.metodoPago === 'bancolombia') tBanco += valor;
            else tEfec += valor;
        }
        
        if (pMesKey === mesKey) {
            totalMes += Number(p.total);
            p.items.forEach(i => {
                if (!conteoPlatos[i.nombre]) conteoPlatos[i.nombre] = { cant: 0, cat: catalogoPlatos[i.nombre]?.categoria || 'varios' };
                conteoPlatos[i.nombre].cant++;

                const ings = catalogoPlatos[i.nombre]?.ingredientes || [];
                ings.forEach(ing => {
                    const n = ing.trim().toUpperCase();
                    if(n) conteoIngredientes[n] = (conteoIngredientes[n] || 0) + 1;
                });
            });
        }
    });

    const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);
    document.getElementById('s-hoy').innerText = fmt(totalHoy);
    document.getElementById('s-mes').innerText = fmt(totalMes);
    document.getElementById('s-nequi').innerText = fmt(tNequi);
    document.getElementById('s-bancolombia').innerText = fmt(tBanco);
    document.getElementById('s-efectivo').innerText = fmt(tEfec);

    const rDiv = document.getElementById('rankings-categoria');
    if(rDiv) {
        const tops = { diario: '-', rapida: '-', varios: '-' };
        const max = { diario: 0, rapida: 0, varios: 0 };
        Object.keys(conteoPlatos).forEach(nom => {
            const item = conteoPlatos[nom];
            if (item.cant > max[item.cat]) { max[item.cat] = item.cant; tops[item.cat] = nom; }
        });
        rDiv.innerHTML = `
            <div style="padding:16px; background:#f9fafb; border:1px solid var(--border); border-radius:8px;">
                <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:4px;">Categoría: Menú Día</div>
                <div style="font-weight:600; color:var(--text-main); font-size:0.95rem;">${tops.diario}</div>
            </div>
            <div style="padding:16px; background:#f9fafb; border:1px solid var(--border); border-radius:8px;">
                <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:4px;">Categoría: Rápidas</div>
                <div style="font-weight:600; color:var(--text-main); font-size:0.95rem;">${tops.rapida}</div>
            </div>
            <div style="padding:16px; background:#f9fafb; border:1px solid var(--border); border-radius:8px;">
                <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:4px;">Categoría: Varios</div>
                <div style="font-weight:600; color:var(--text-main); font-size:0.95rem;">${tops.varios}</div>
            </div>`;
    }

    const ingDiv = document.getElementById('rankings-ingredientes');
    if(ingDiv) {
        const sorted = Object.entries(conteoIngredientes).sort((a,b) => b[1] - a[1]).slice(0, 8);
        ingDiv.innerHTML = sorted.map(([n, c]) => `
            <div class="badge badge-outline" style="padding:6px 12px; font-size:0.8rem;">
                ${n} <span style="margin-left:6px; color:var(--sidebar); opacity:0.6;">x${c}</span>
            </div>
        `).join('') || '<span style="color:var(--text-muted); font-size:0.85rem;">Esperando datos...</span>';
    }
};

const escucharCarta = () => {
    onSnapshot(collection(db, "platos"), (sn) => {
        const gruposAbiertos = [];
        document.querySelectorAll('.admin-group.open').forEach(g => gruposAbiertos.push(g.id));
        const scrollActual = document.querySelector('.main-content').scrollTop;

        const inv = document.getElementById('inv-list');
        inv.innerHTML = `
            <div class="admin-group" id="g-diario"><div class="admin-group-header" onclick="toggleSeccion(this)"><span>Menú del Día</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></div><div class="admin-group-content" id="adm-diario"></div></div>
            <div class="admin-group" id="g-rapida"><div class="admin-group-header" onclick="toggleSeccion(this)"><span>Comidas Rápidas</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></div><div class="admin-group-content" id="adm-rapida"></div></div>
            <div class="admin-group" id="g-varios"><div class="admin-group-header" onclick="toggleSeccion(this)"><span>Varios</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></div><div class="admin-group-content" id="adm-varios"></div></div>
        `;
        
        catalogoPlatos = {}; 
        sn.docs.forEach(docSnap => {
            const d = docSnap.data();
            catalogoPlatos[d.nombre] = d; 

            const html = `
            <div class="admin-row">
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <div style="font-weight:500; font-size:0.95rem;">${d.nombre}</div>
                    <span style="font-size:0.85rem; color:var(--text-muted);">$${Number(d.precio).toLocaleString()}</span>
                </div>
                <div class="actions">
                    <label class="switch" style="margin-right:10px;">
                        <input type="checkbox" ${d.disponible !== false ? 'checked' : ''} onchange="toggleStock('${docSnap.id}', this.checked)">
                        <span class="slider"></span>
                    </label>
                    <button onclick="prepararEdicion('${docSnap.id}')" class="btn-icon">${ICON_EDIT}</button>
                    <button onclick="triggerDelete('${docSnap.id}')" class="btn-icon delete">${ICON_TRASH}</button>
                </div>
            </div>`;
            const target = document.getElementById(`adm-${d.categoria}`);
            if(target) target.innerHTML += html;
        });

        gruposAbiertos.forEach(id => {
            const el = document.getElementById(id);
            if(el) el.classList.add('open');
        });
        if(gruposAbiertos.length === 0 && document.getElementById('g-diario')) document.getElementById('g-diario').classList.add('open');

        setTimeout(() => { document.querySelector('.main-content').scrollTop = scrollActual; }, 0);
    });
};

window.toggleStock = (id, val) => updateDoc(doc(db, "platos", id), { disponible: val });

let currentAction = null; let targetId = null;

window.triggerDelete = (id) => { 
    currentAction = 'deletePlato'; targetId = id; 
    document.getElementById('modal-title').innerText = "¿Eliminar plato?"; 
    document.getElementById('delete-modal').style.display = 'flex'; 
};

window.triggerResetStats = () => { 
    currentAction = 'resetStats'; 
    document.getElementById('modal-title').innerText = "Esta acción es irreversible. ¿Continuar?"; 
    document.getElementById('delete-modal').style.display = 'flex'; 
};

window.closeModal = () => { document.getElementById('delete-modal').style.display = 'none'; currentAction = null; targetId = null; };

document.getElementById('confirm-delete-btn').onclick = async () => {
    try {
        if (currentAction === 'deletePlato' && targetId) await deleteDoc(doc(db, "platos", targetId));
        else if (currentAction === 'resetStats' && auth.currentUser.email === CORREO_MASTER) {
            const q = await getDocs(collection(db, "pedidos")); 
            await Promise.all(q.docs.map(d => deleteDoc(d.ref))); 
        }
    } catch (error) { console.error(error); }
    closeModal();
};

window.prepararEdicion = async (id) => {
    const d = (await getDoc(doc(db, "platos", id))).data();
    document.getElementById('edit-id').value = id;
    document.getElementById('name').value = d.nombre;
    document.getElementById('price').value = d.precio;
    document.getElementById('category').value = d.categoria;
    document.getElementById('desc').value = d.descripcion || '';
    document.getElementById('ingredients').value = Array.isArray(d.ingredientes) ? d.ingredientes.join(', ') : d.ingredientes || '';
    document.getElementById('f-title').innerText = "Editar: " + d.nombre;
    document.querySelector('.main-content').scrollTo({ top: 0, behavior: 'smooth' });
    document.getElementById('btn-cancelar').style.display = 'block';
};

window.cancelarEdicion = () => {
    document.getElementById('edit-id').value = "";
    document.getElementById('f-title').innerText = "Configurar Plato";
    document.getElementById('m-form').reset();
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
    cancelarEdicion();
};

onAuthStateChanged(auth, (u) => {
    if(u && correosAutorizados.includes(u.email)) {
        document.getElementById('admin-panel').style.display = 'flex';
        document.getElementById('login-screen').style.display = 'none';
        
        const btnReset = document.getElementById('btn-reset-stats');
        if(btnReset) btnReset.style.display = (u.email === CORREO_MASTER) ? 'block' : 'none';

        escucharPedidos(); escucharCarta();
    } else {
        if(u) signOut(auth);
        document.getElementById('admin-panel').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
    }
});
document.getElementById('login-btn').onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
