import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, getDoc, getDocs, serverTimestamp, writeBatch, addDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

const CORREO_MASTER = "cb01grupo@gmail.com";
const correosAutorizados = [CORREO_MASTER, "kelly.araujotafur@gmail.com"];

const ICON_EDIT = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>`;
const ICON_TRASH = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

let primeraCarga = true;
let catalogoPlatos = {}; 

const escucharPedidos = () => {
    onSnapshot(query(collection(db, "pedidos"), orderBy("timestamp", "desc")), (sn) => {
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
                <div style="margin-bottom:8px;">• <strong>${i.nombre}</strong> ${i.nota ? `<span class="item-nota">⚠️ NOTA: ${i.nota}</span>` : ''}</div>
            `).join('');

            if (p.estado === 'pendiente') {
                lp.innerHTML += `
                <div class="pedido-card">
                    <div style="display:flex; justify-content:space-between; align-items:center;"><strong>👤 ${p.cliente}</strong><span style="font-size:0.65rem; font-weight:700; padding:4px 10px; border-radius:20px; background:#f1f5f9; color:#64748b;">${p.tipo.toUpperCase()}</span></div>
                    <div style="margin:15px 0;">${itemsHTML}</div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-weight:700; color:var(--success); font-size:1.1rem;">$${Number(p.total).toLocaleString()}</span>
                        <button style="background:var(--success); color:white; border:none; padding:10px 20px; border-radius:10px; cursor:pointer; font-weight:bold;" onclick="completar('${docSnap.id}')">LISTO</button>
                    </div>
                </div>`;
            } else if (p.estado === 'completado' && p.timestamp?.toDate().toDateString() === hoy) {
                la.innerHTML += `
                <div style="display:flex; justify-content:space-between; padding:12px 20px; border-bottom:1px solid #f1f5f9; font-size:0.9rem;">
                    <span><strong>${p.cliente}</strong> <small style="color:#94a3b8; margin-left:10px;">${p.tipo}</small></span>
                    <span style="color:var(--success); font-weight:700;">$${Number(p.total).toLocaleString()}</span>
                </div>`;
            }
        });
        procesarEstadisticas(listaPedidos);
    });
};

const procesarEstadisticas = (pedidos) => {
    const ahora = new Date();
    const hoyStr = ahora.toDateString();
    const mesKey = `${ahora.getMonth() + 1}-${ahora.getFullYear()}`;
    
    let totalHoy = 0, totalMes = 0;
    const conteoPlatos = {};
    const conteoIngredientes = {};

    pedidos.forEach(p => {
        if (p.estado !== 'completado' || !p.timestamp) return;
        const fecha = p.timestamp.toDate();
        const pMesKey = `${fecha.getMonth() + 1}-${fecha.getFullYear()}`;
        
        if (fecha.toDateString() === hoyStr) totalHoy += Number(p.total);
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

    document.getElementById('s-hoy').innerText = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(totalHoy);
    document.getElementById('s-mes').innerText = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(totalMes);

    const rDiv = document.getElementById('rankings-categoria');
    if(rDiv) {
        const tops = { diario: '---', rapida: '---', varios: '---' };
        const max = { diario: 0, rapida: 0, varios: 0 };
        Object.keys(conteoPlatos).forEach(nom => {
            const item = conteoPlatos[nom];
            if (item.cant > max[item.cat]) { max[item.cat] = item.cant; tops[item.cat] = nom; }
        });
        rDiv.innerHTML = `
            <div style="padding:15px; background:#f8fafc; border-radius:12px; font-size:0.8rem;"><strong>📅 Menú Día</strong><br>${tops.diario}</div>
            <div style="padding:15px; background:#f8fafc; border-radius:12px; font-size:0.8rem;"><strong>🍔 Rápidas</strong><br>${tops.rapida}</div>
            <div style="padding:15px; background:#f8fafc; border-radius:12px; font-size:0.8rem;"><strong>✨ Varios</strong><br>${tops.varios}</div>`;
    }

    const ingDiv = document.getElementById('rankings-ingredientes');
    if(ingDiv) {
        const sorted = Object.entries(conteoIngredientes).sort((a,b) => b[1] - a[1]).slice(0, 8);
        ingDiv.innerHTML = sorted.map(([n, c]) => `
            <div style="background:#fff7ed; border:1px solid #fed7aa; color:#c2410c; padding:8px 12px; border-radius:8px; font-size:0.8rem; font-weight:600;">
                ${n} <span style="margin-left:5px; opacity:0.5;">x${c}</span>
            </div>
        `).join('') || 'Esperando datos...';
    }
};

const escucharCarta = () => {
    onSnapshot(collection(db, "platos"), (sn) => {
        const gruposAbiertos = [];
        document.querySelectorAll('.admin-group.open').forEach(g => gruposAbiertos.push(g.id));
        const scrollActual = document.querySelector('.main-content').scrollTop;

        const inv = document.getElementById('inv-list');
        inv.innerHTML = `
            <div class="admin-group" id="g-diario"><div class="admin-group-header" onclick="toggleSeccion(this)"><h4>📅 Menú del Día</h4><span class="chevron">▼</span></div><div class="admin-group-content" id="adm-diario"></div></div>
            <div class="admin-group" id="g-rapida"><div class="admin-group-header" onclick="toggleSeccion(this)"><h4>🍔 Comidas Rápidas</h4><span class="chevron">▼</span></div><div class="admin-group-content" id="adm-rapida"></div></div>
            <div class="admin-group" id="g-varios"><div class="admin-group-header" onclick="toggleSeccion(this)"><h4>✨ Varios</h4><span class="chevron">▼</span></div><div class="admin-group-content" id="adm-varios"></div></div>
        `;
        
        catalogoPlatos = {}; 
        sn.docs.forEach(docSnap => {
            const d = docSnap.data();
            catalogoPlatos[d.nombre] = d; 

            const html = `
            <div class="admin-row">
                <div style="display:flex; flex-direction:column;"><strong>${d.nombre}</strong><span style="font-size:0.8rem; color:var(--success); font-weight:700;">$${Number(d.precio).toLocaleString()}</span></div>
                <div class="actions">
                    <label class="switch">
                        <input type="checkbox" ${d.disponible !== false ? 'checked' : ''} onchange="toggleStock('${docSnap.id}', this.checked)">
                        <span class="slider"></span>
                    </label>
                    <button onclick="prepararEdicion('${docSnap.id}')" class="btn-icon">${ICON_EDIT}</button>
                    <button onclick="triggerDelete('${docSnap.id}')" class="btn-icon" style="color:var(--danger);">${ICON_TRASH}</button>
                </div>
            </div>`;
            const target = document.getElementById(`adm-${d.categoria}`);
            if(target) target.innerHTML += html;
        });

        gruposAbiertos.forEach(id => {
            const el = document.getElementById(id);
            if(el) el.classList.add('open');
        });
        
        if(gruposAbiertos.length === 0 && document.getElementById('g-diario')) {
            document.getElementById('g-diario').classList.add('open');
        }

        setTimeout(() => {
            document.querySelector('.main-content').scrollTop = scrollActual;
        }, 0);
    });
};

window.completar = (id) => updateDoc(doc(db, "pedidos", id), { estado: 'completado' });
window.toggleStock = (id, val) => updateDoc(doc(db, "platos", id), { disponible: val });

let currentAction = null; let targetId = null;

window.triggerDelete = (id) => { 
    currentAction = 'deletePlato'; 
    targetId = id; 
    document.getElementById('modal-title').innerText = "¿Eliminar este plato de la carta?"; 
    document.getElementById('delete-modal').style.display = 'flex'; 
};

// NUEVO: Función para disparar el reseteo global
window.triggerResetStats = () => { 
    currentAction = 'resetStats'; 
    document.getElementById('modal-title').innerText = "⚠️ ¿Borrar TODOS los pedidos y estadísticas?"; 
    document.getElementById('delete-modal').style.display = 'flex'; 
};

window.closeModal = () => { 
    document.getElementById('delete-modal').style.display = 'none'; 
    currentAction = null; 
    targetId = null; 
};

document.getElementById('confirm-delete-btn').onclick = async () => {
    try {
        if (currentAction === 'deletePlato' && targetId) {
            await deleteDoc(doc(db, "platos", targetId));
        } 
        else if (currentAction === 'resetStats' && auth.currentUser.email === CORREO_MASTER) {
            // Borra todos los pedidos, lo que automáticamente reinicia las estadísticas a 0
            const q = await getDocs(collection(db, "pedidos")); 
            
            // Usamos Promise.all en lugar de batch para evitar el límite de 500 documentos de Firebase
            await Promise.all(q.docs.map(d => deleteDoc(d.ref))); 
            
            alert("✅ Todas las estadísticas y pedidos han sido reiniciados.");
        }
    } catch (error) {
        alert("Hubo un error al ejecutar la acción.");
        console.error(error);
    }
    closeModal();
};

window.prepararEdicion = async (id) => {
    const snap = await getDoc(doc(db, "platos", id));
    const d = snap.data();
    document.getElementById('edit-id').value = id;
    document.getElementById('name').value = d.nombre;
    document.getElementById('price').value = d.precio;
    document.getElementById('category').value = d.categoria;
    document.getElementById('desc').value = d.descripcion || '';
    document.getElementById('ingredients').value = Array.isArray(d.ingredientes) ? d.ingredientes.join(',') : d.ingredientes || '';
    document.getElementById('f-title').innerText = "✏️ Editando: " + d.nombre;
    
    document.querySelector('.main-content').scrollTo({ top: 0, behavior: 'smooth' });
};

window.cancelarEdicion = () => {
    document.getElementById('edit-id').value = "";
    document.getElementById('f-title').innerText = "➕ Gestionar Carta";
    document.getElementById('m-form').reset();
};

document.getElementById('m-form').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const datos = {
        nombre: document.getElementById('name').value,
        precio: Number(document.getElementById('price').value),
        categoria: document.getElementById('category').value,
        descripcion: document.getElementById('desc').value,
        ingredientes: document.getElementById('ingredients').value.split(',').map(s => s.trim()),
        timestamp: serverTimestamp()
    };
    id ? await updateDoc(doc(db, "platos", id), datos) : await addDoc(collection(db, "platos"), { ...datos, disponible: true });
    cancelarEdicion();
};

onAuthStateChanged(auth, (u) => {
    if(u && correosAutorizados.includes(u.email)) {
        document.getElementById('admin-panel').style.display = 'flex';
        document.getElementById('login-screen').style.display = 'none';
        
        // Control de seguridad visual: Solo cb01grupo@gmail.com ve el botón rojo
        const btnReset = document.getElementById('btn-reset-stats');
        if(btnReset) {
            btnReset.style.display = (u.email === CORREO_MASTER) ? 'block' : 'none';
        }

        escucharPedidos(); escucharCarta();
    } else {
        if(u) signOut(auth);
        document.getElementById('admin-panel').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
    }
});
document.getElementById('login-btn').onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
