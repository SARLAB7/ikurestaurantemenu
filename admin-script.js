import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, getDoc, getDocs, serverTimestamp, writeBatch, addDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

const CORREO_MASTER = "cb01grupo@gmail.com";
const correosAutorizados = [CORREO_MASTER, "kelly.araujotafur@gmail.com"];
let totalPAnterior = 0;

// Restauración de Iconos SVG Originales
const ICON_EDIT = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>`;
const ICON_TRASH = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

const sonar = () => { const a = document.getElementById('notif-sound'); if(a) a.play().catch(e => {}); };

// PROCESAR ESTADÍSTICAS SIMPLES
const procesarEstadisticas = async (pedidos) => {
    const ahora = new Date();
    const mesActual = `${ahora.getMonth() + 1}-${ahora.getFullYear()}`;
    const hoyStr = ahora.toDateString();
    let vHoy = 0, vMes = 0;
    const conteoGlobal = {};

    const platosSnap = await getDocs(collection(db, "platos"));
    const catMapa = {};
    platosSnap.forEach(d => { catMapa[d.data().nombre] = d.data().categoria; });

    pedidos.forEach(p => {
        if (p.estado !== 'completado' || !p.timestamp) return;
        const f = p.timestamp.toDate();
        const mKey = `${f.getMonth() + 1}-${f.getFullYear()}`;
        if (f.toDateString() === hoyStr) vHoy += p.total;
        if (mKey === mesActual) vMes += p.total;
        p.items.forEach(i => {
            if (mKey === mesActual) {
                if (!conteoGlobal[i.nombre]) conteoGlobal[i.nombre] = { cantidad: 0, cat: catMapa[i.nombre] || 'varios' };
                conteoGlobal[i.nombre].cantidad++;
            }
        });
    });

    const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);
    document.getElementById('s-hoy').innerText = fmt(vHoy);
    document.getElementById('s-mes').innerText = fmt(vMes);

    const rDiv = document.getElementById('rankings-categoria');
    if(rDiv) {
        const tops = { diario: '---', rapida: '---', varios: '---' };
        const maxC = { diario: 0, rapida: 0, varios: 0 };
        Object.keys(conteoGlobal).forEach(nom => {
            const inf = conteoGlobal[nom];
            if (inf.cantidad > maxC[inf.cat]) { maxC[inf.cat] = inf.cantidad; tops[inf.cat] = nom; }
        });
        rDiv.innerHTML = `
            <div style="padding:15px; background:#f8fafc; border-radius:12px; font-size:0.8rem;"><strong>📅 Menú Día</strong><br>${tops.diario}</div>
            <div style="padding:15px; background:#f8fafc; border-radius:12px; font-size:0.8rem;"><strong>🍔 Rápidas</strong><br>${tops.rapida}</div>
            <div style="padding:15px; background:#f8fafc; border-radius:12px; font-size:0.8rem;"><strong>✨ Varios</strong><br>${tops.varios}</div>`;
    }
};

const escucharData = () => {
    onSnapshot(query(collection(db, "pedidos"), orderBy("timestamp", "desc")), (sn) => {
        const lp = document.getElementById('l-pendientes');
        const la = document.getElementById('l-atendidos');
        const allPedidos = [];
        let pCount = 0;
        const hoy = new Date().toDateString();

        lp.innerHTML = ''; la.innerHTML = '';
        sn.docs.forEach(docSnap => {
            const p = docSnap.data();
            allPedidos.push(p);

            const itemsHTML = p.items.map(i => `
                <div style="margin-bottom:8px;">• <strong>${i.nombre}</strong> ${i.nota ? `<span class="item-nota">⚠️ NOTA: ${i.nota}</span>` : ''}</div>
            `).join('');

            if (p.estado === 'pendiente') {
                pCount++;
                lp.innerHTML += `
                <div class="pedido-card">
                    <div style="display:flex; justify-content:space-between; align-items:center;"><strong>👤 ${p.cliente}</strong><span style="font-size:0.65rem; font-weight:700; padding:4px 10px; border-radius:20px; background:#f1f5f9; color:#64748b;">${p.tipo.toUpperCase()}</span></div>
                    <div style="margin:15px 0; font-size:0.95rem;">${itemsHTML}</div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-weight:bold; color:var(--success); font-size:1.1rem;">$${Number(p.total).toLocaleString()}</span>
                        <button class="btn-ready" onclick="completar('${docSnap.id}')">LISTO</button>
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
        if(pCount > totalPAnterior) sonar();
        totalPAnterior = pCount;
        procesarEstadisticas(allPedidos);
    });
};

const escucharMenu = () => {
    onSnapshot(collection(db, "platos"), (sn) => {
        const inv = document.getElementById('inv-list');
        inv.innerHTML = `
            <div class="admin-group open" id="g-diario"><div class="admin-group-header" onclick="toggleSeccion(this)"><h4>📅 Menú del Día</h4><span class="chevron">▼</span></div><div class="admin-group-content" id="adm-diario"></div></div>
            <div class="admin-group" id="g-rapida"><div class="admin-group-header" onclick="toggleSeccion(this)"><h4>🍔 Comidas Rápidas</h4><span class="chevron">▼</span></div><div class="admin-group-content" id="adm-rapida"></div></div>
            <div class="admin-group" id="g-varios"><div class="admin-group-header" onclick="toggleSeccion(this)"><h4>✨ Varios</h4><span class="chevron">▼</span></div><div class="admin-group-content" id="adm-varios"></div></div>
        `;
        sn.docs.forEach(docSnap => {
            const d = docSnap.data();
            const html = `
            <div class="admin-row">
                <div style="display:flex; flex-direction:column;"><strong>${d.nombre}</strong><span style="font-size:0.8rem; color:var(--success); font-weight:700;">$${Number(d.precio).toLocaleString()}</span></div>
                <div class="actions">
                    <label class="switch"><input type="checkbox" ${d.disponible !== false ? 'checked' : ''} onchange="toggleStock('${docSnap.id}', this.checked)"><span class="slider"></span></label>
                    <button onclick="prepararEdicion('${docSnap.id}')" class="btn-icon btn-edit-icon">${ICON_EDIT}</button>
                    <button onclick="triggerDelete('${docSnap.id}')" class="btn-icon btn-delete-icon">${ICON_TRASH}</button>
                </div>
            </div>`;
            const target = document.getElementById(`adm-${d.categoria}`);
            if(target) target.innerHTML += html;
        });
    });
};

window.completar = (id) => updateDoc(doc(db, "pedidos", id), { estado: 'completado' });
window.toggleStock = (id, val) => updateDoc(doc(db, "platos", id), { disponible: val });

let currentAction = null; let targetId = null;
window.triggerDelete = (id) => { currentAction = 'deletePlato'; targetId = id; document.getElementById('modal-title').innerText = "¿Eliminar plato?"; document.getElementById('delete-modal').style.display = 'flex'; };
window.triggerResetStats = () => { currentAction = 'resetStats'; document.getElementById('modal-title').innerText = "¿Reiniciar Estadísticas?"; document.getElementById('delete-modal').style.display = 'flex'; };
document.getElementById('confirm-delete-btn').onclick = async () => {
    if (currentAction === 'deletePlato' && targetId) { await deleteDoc(doc(db, "platos", targetId)); } 
    else if (currentAction === 'resetStats' && auth.currentUser.email === CORREO_MASTER) {
        const q = await getDocs(collection(db, "pedidos")); const batch = writeBatch(db); q.forEach(d => batch.delete(d.ref)); await batch.commit();
    }
    closeModal();
};
window.closeModal = () => { document.getElementById('delete-modal').style.display = 'none'; currentAction = null; targetId = null; };

window.prepararEdicion = async (id) => {
    const snap = await getDoc(doc(db, "platos", id)); const d = snap.data();
    document.getElementById('edit-id').value = id; document.getElementById('name').value = d.nombre;
    document.getElementById('price').value = d.precio; document.getElementById('category').value = d.categoria;
    document.getElementById('desc').value = d.descripcion || ''; document.getElementById('ingredients').value = d.ingredientes?.join(',') || '';
    document.getElementById('f-title').innerText = "✏️ Editando: " + d.nombre;
    document.querySelector('.main-content').scrollTo({top: 0, behavior: 'smooth'});
};
window.cancelarEdicion = () => { document.getElementById('edit-id').value = ""; document.getElementById('f-title').innerText = "➕ Gestionar Carta"; document.getElementById('m-form').reset(); };
document.getElementById('m-form').onsubmit = async (e) => {
    e.preventDefault(); const id = document.getElementById('edit-id').value;
    const datos = { nombre: document.getElementById('name').value, precio: Number(document.getElementById('price').value), categoria: document.getElementById('category').value, descripcion: document.getElementById('desc').value, ingredientes: document.getElementById('ingredients').value.split(','), timestamp: serverTimestamp() };
    id ? await updateDoc(doc(db, "platos", id), datos) : await addDoc(collection(db, "platos"), { ...datos, disponible: true });
    cancelarEdicion();
};

onAuthStateChanged(auth, (u) => {
    if(u && correosAutorizados.includes(u.email)) {
        document.getElementById('admin-panel').style.display = 'flex';
        document.getElementById('login-screen').style.display = 'none';
        if(u.email === CORREO_MASTER) document.getElementById('btn-reset-stats').style.display = 'block';
        escucharData(); escucharMenu();
    } else { if(u) signOut(auth); document.getElementById('admin-panel').style.display = 'none'; document.getElementById('login-screen').style.display = 'flex'; }
});
document.getElementById('login-btn').onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
