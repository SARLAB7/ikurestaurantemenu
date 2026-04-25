import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, getDoc, getDocs, serverTimestamp, addDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
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

        sn.docChanges().forEach(ch => { 
            if (ch.type === "added" && !primeraCarga && ch.doc.data().estado === 'pendiente') {
                document.getElementById('notif-sound')?.play().catch(()=>{});
            }
        });
        primeraCarga = false; 
        lp.innerHTML = ''; la.innerHTML = '';

        sn.docs.forEach(docSnap => {
            const p = docSnap.data(); 
            listaPedidos.push(p);
            const itemsHTML = p.items.map(i => `<div style="margin-bottom:5px;">• <strong>${i.nombre}</strong> ${i.nota ? `<span class="item-nota">⚠️ ${i.nota}</span>` : ''}</div>`).join('');
            const pJson = encodeURIComponent(JSON.stringify(p));

            if (p.estado === 'pendiente' || p.estado === 'preparando') {
                const esPrep = p.estado === 'preparando';
                let btns = esPrep 
                    ? `<div style="display:flex; flex-wrap:wrap; gap:5px; margin-top:10px;">
                        <button onclick="finalizarPedido('${docSnap.id}', 'nequi')" style="background:#818cf8; color:white; border:none; padding:10px; border-radius:8px; cursor:pointer; font-size:0.7rem; flex:1;">🟣 NEQUI</button>
                        <button onclick="finalizarPedido('${docSnap.id}', 'bancolombia')" style="background:#fbbf24; color:white; border:none; padding:10px; border-radius:8px; cursor:pointer; font-size:0.7rem; flex:1;">🟡 BANC.</button>
                        <button onclick="finalizarPedido('${docSnap.id}', 'efectivo')" style="background:#22c55e; color:white; border:none; padding:10px; border-radius:8px; cursor:pointer; font-size:0.7rem; flex:1;">💵 EFEC.</button>
                       </div>`
                    : `<div style="display:flex; gap:10px; margin-top:10px; width:100%;">
                        <button onclick="cambiarEstado('${docSnap.id}', 'preparando', '${encodeURIComponent(JSON.stringify(p.items))}')" style="background:#f59e0b; color:white; border:none; padding:12px; border-radius:10px; cursor:pointer; font-weight:bold; flex:1;">🍳 PREPARAR</button>
                        <button onclick="imprimirComanda('${pJson}')" style="background:#e2e8f0; border:none; padding:12px; border-radius:10px; cursor:pointer; width:50px;">🖨️</button>
                       </div>`;

                lp.innerHTML += `
                <div class="pedido-card" style="border-left-color: ${esPrep ? '#3b82f6' : '#ffcc00'}">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <strong>👤 ${p.cliente}</strong>
                        <span style="font-size:0.7rem; opacity:0.6;">${p.tipo.toUpperCase()}</span>
                    </div>
                    <div style="margin-bottom:15px;">${itemsHTML}</div>
                    <div style="display:flex; flex-direction:column;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-weight:700; font-size:1.1rem;">$${Number(p.total).toLocaleString()}</span>
                            ${esPrep ? '<span style="color:#3b82f6; font-size:0.7rem; font-weight:bold;">EN COCINA...</span>' : ''}
                        </div>
                        ${btns}
                    </div>
                </div>`;
            } else if (p.estado === 'completado' && p.timestamp?.toDate().toDateString() === hoy) {
                la.innerHTML += `<div style="padding:12px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; font-size:0.85rem;"><span>${p.cliente} (${p.metodoPago || 'Efe'})</span><strong>$${Number(p.total).toLocaleString()}</strong></div>`;
            }
        });
        procesarEstadisticas(listaPedidos);
    });
};

window.imprimirComanda = (pJson) => {
    const p = JSON.parse(decodeURIComponent(pJson));
    const v = window.open('', '_blank', 'width=300');
    v.document.write(`<style>body{font-family:monospace; padding:10px;} h3{text-align:center;}</style><h3>IKU</h3><hr><h4>Cliente: ${p.cliente}</h4><p>Servicio: ${p.tipo.toUpperCase()}</p><hr>${p.items.map(i => `<div>1x ${i.nombre}</div>${i.nota?`<small>Nota: ${i.nota}</small><br>`:''}`).join('')}<hr><h4>Total: $${Number(p.total).toLocaleString()}</h4><script>setTimeout(()=>{window.print();window.close();},500);</script>`);
};

window.cambiarEstado = async (id, est, itemsStr) => {
    await updateDoc(doc(db, "pedidos", id), { estado: est });
    if(est === 'preparando') {
        const items = JSON.parse(decodeURIComponent(itemsStr));
        for (const i of items) { 
            if(i.id) { 
                const pSnap = await getDoc(doc(db, "platos", i.id)); 
                if(pSnap.exists()){ 
                    let s = pSnap.data().stock; 
                    if(s > 0) await updateDoc(doc(db, "platos", i.id), { stock: s-1, disponible: s-1 > 0 }); 
                } 
            } 
        }
    }
};

window.finalizarPedido = (id, met) => updateDoc(doc(db, "pedidos", id), { estado: 'completado', metodoPago: met });

const procesarEstadisticas = (pedidos) => {
    const hoyStr = new Date().toDateString(); let tH = 0, tM = 0, tN = 0, tB = 0, tE = 0; const cP = {}; const cI = {};
    pedidos.forEach(p => {
        if (p.estado !== 'completado' || !p.timestamp) return;
        const fecha = p.timestamp.toDate(); tM += p.total;
        if (fecha.toDateString() === hoyStr) {
            tH += p.total;
            if(p.metodoPago === 'nequi') tN += p.total; else if(p.metodoPago === 'bancolombia') tB += p.total; else tE += p.total;
        }
        p.items.forEach(i => {
            if(!cP[i.nombre]) cP[i.nombre] = { c: 0, cat: catalogoPlatos[i.nombre]?.categoria || 'varios' }; 
            cP[i.nombre].c++;
            const ings = catalogoPlatos[i.nombre]?.ingredientes || []; ings.forEach(ing => { const n = ing.trim().toUpperCase(); if(n) cI[n] = (cI[n] || 0) + 1; });
        });
    });
    const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);
    document.getElementById('s-hoy').innerText = fmt(tH); 
    document.getElementById('s-mes').innerText = fmt(tM);
    document.getElementById('s-nequi').innerText = fmt(tN); 
    document.getElementById('s-bancolombia').innerText = fmt(tB); 
    document.getElementById('s-efectivo').innerText = fmt(tE);
    
    const rDiv = document.getElementById('rankings-categoria');
    if(rDiv) {
        const tops = { diario: '---', rapida: '---', varios: '---' }; const max = { diario: 0, rapida: 0, varios: 0 };
        Object.keys(cP).forEach(nom => { const it = cP[nom]; if(it.c > max[it.cat]) { max[it.cat] = it.c; tops[it.cat] = nom; } });
        rDiv.innerHTML = `
            <div style="background:#f8fafc; padding:10px; border-radius:10px; font-size:0.75rem;">📅 Día: ${tops.diario}</div>
            <div style="background:#f8fafc; padding:10px; border-radius:10px; font-size:0.75rem;">🍔 Rápida: ${tops.rapida}</div>
            <div style="background:#f8fafc; padding:10px; border-radius:10px; font-size:0.75rem;">✨ Varios: ${tops.varios}</div>`;
    }
    const iDiv = document.getElementById('rankings-ingredientes');
    if(iDiv) iDiv.innerHTML = Object.entries(cI).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([n,c])=>`<span style="background:#fff7ed; padding:5px 10px; border-radius:8px; font-size:0.75rem; border:1px solid #fed7aa;">${n} x${c}</span>`).join('');
};

const escucharCarta = () => {
    onSnapshot(collection(db, "platos"), (sn) => {
        const grupos = []; document.querySelectorAll('.admin-group.open').forEach(g => grupos.push(g.id));
        const scroll = document.querySelector('.main-content').scrollTop;
        const inv = document.getElementById('inv-list');
        
        inv.innerHTML = `
            <div class="admin-group" id="g-diario"><div class="admin-group-header" onclick="toggleSeccion(this)"><h4>📅 Menú del Día</h4></div><div class="admin-group-content" id="adm-diario"></div></div>
            <div class="admin-group" id="g-rapida"><div class="admin-group-header" onclick="toggleSeccion(this)"><h4>🍔 Comidas Rápidas</h4></div><div class="admin-group-content" id="adm-rapida"></div></div>
            <div class="admin-group" id="g-varios"><div class="admin-group-header" onclick="toggleSeccion(this)"><h4>✨ Varios</h4></div><div class="admin-group-content" id="adm-varios"></div></div>
        `;
        
        catalogoPlatos = {};
        sn.docs.forEach(docSnap => {
            const d = docSnap.data(); catalogoPlatos[d.nombre] = d;
            const html = `
            <div class="admin-row">
                <div style="flex:1;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <strong>${d.nombre}</strong>
                        <small style="color:${d.stock <= 5 ? 'var(--danger)' : '#64748b'}; font-weight:bold;">(${d.stock} disp.)</small>
                    </div>
                    <span style="color:var(--success); font-weight:bold; font-size:0.85rem;">$${Number(d.precio).toLocaleString()}</span>
                </div>
                <div class="actions">
                    <label class="switch"><input type="checkbox" ${d.disponible!==false?'checked':''} onchange="toggleStock('${docSnap.id}', this.checked)"><span class="slider"></span></label>
                    <div style="display:flex; gap:5px;">
                        <button onclick="prepararEdicion('${docSnap.id}')" class="btn-icon">${ICON_EDIT}</button>
                        <button onclick="triggerDelete('${docSnap.id}')" class="btn-icon" style="color:var(--danger);">${ICON_TRASH}</button>
                    </div>
                </div>
            </div>`;
            const target = document.getElementById(`adm-${d.categoria}`); if(target) target.innerHTML += html;
        });
        grupos.forEach(id => { if(document.getElementById(id)) document.getElementById(id).classList.add('open'); });
        document.querySelector('.main-content').scrollTop = scroll;
    });
};

window.toggleStock = (id, val) => updateDoc(doc(db, "platos", id), { disponible: val });

let currentAction = null; let targetId = null;
window.triggerDelete = (id) => { currentAction = 'deletePlato'; targetId = id; document.getElementById('modal-title').innerText = "¿Eliminar este plato?"; document.getElementById('delete-modal').style.display = 'flex'; };
window.triggerResetStats = () => { currentAction = 'resetStats'; document.getElementById('modal-title').innerText = "⚠️ ¿Cerrar caja y borrar historial?"; document.getElementById('delete-modal').style.display = 'flex'; };
window.closeModal = () => { document.getElementById('delete-modal').style.display = 'none'; };

document.getElementById('confirm-delete-btn').onclick = async () => {
    if (currentAction === 'deletePlato') await deleteDoc(doc(db, "platos", targetId));
    else if (currentAction === 'resetStats') { const q = await getDocs(collection(db, "pedidos")); await Promise.all(q.docs.map(d => deleteDoc(d.ref))); alert("✅ Caja cerrada."); }
    closeModal();
};

window.prepararEdicion = async (id) => {
    const d = (await getDoc(doc(db, "platos", id))).data();
    document.getElementById('edit-id').value = id; document.getElementById('name').value = d.nombre;
    document.getElementById('price').value = d.precio; document.getElementById('category').value = d.categoria;
    document.getElementById('stock').value = d.stock || 0; document.getElementById('desc').value = d.descripcion || '';
    document.getElementById('ingredients').value = Array.isArray(d.ingredientes) ? d.ingredientes.join(',') : (d.ingredientes || '');
    document.getElementById('f-title').innerText = "✏️ Editando: " + d.nombre;
    document.querySelector('.main-content').scrollTo({ top: 0, behavior: 'smooth' });
};

window.cancelarEdicion = () => { document.getElementById('edit-id').value = ""; document.getElementById('m-form').reset(); document.getElementById('f-title').innerText = "➕ Gestionar Carta"; };

document.getElementById('m-form').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value; const s = Number(document.getElementById('stock').value);
    const d = { nombre: document.getElementById('name').value, precio: Number(document.getElementById('price').value), categoria: document.getElementById('category').value, stock: s, descripcion: document.getElementById('desc').value, ingredientes: document.getElementById('ingredients').value.split(',').map(x=>x.trim()), timestamp: serverTimestamp() };
    if(!id) d.disponible = s > 0;
    id ? await updateDoc(doc(db, "platos", id), d) : await addDoc(collection(db, "platos"), d);
    cancelarEdicion();
};

onAuthStateChanged(auth, (u) => {
    if(u && correosAutorizados.includes(u.email)) {
        document.getElementById('admin-panel').style.display = 'flex'; 
        document.getElementById('login-screen').style.display = 'none';
        const br = document.getElementById('btn-reset-stats'); if(br) br.style.display = (u.email === CORREO_MASTER) ? 'block' : 'none';
        escucharPedidos(); escucharCarta();
    } else { 
        if(u) signOut(auth); 
        document.getElementById('admin-panel').style.display = 'none'; 
        document.getElementById('login-screen').style.display = 'flex'; 
    }
});
document.getElementById('login-btn').onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
