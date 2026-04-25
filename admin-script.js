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

        escucharCarta(); 
        escucharPedidos(); 
    } else {
        if(u) signOut(auth);
        document.getElementById('admin-panel').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
    }
});

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
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                <strong>${p.cliente}</strong>
                <button onclick="imprimirComanda('${encodeURIComponent(JSON.stringify(p))}')" class="btn-action btn-outline" style="font-size:0.7rem; padding:4px 8px;">🖨️ Ticket</button>
            </div>
            <div style="font-size:0.9rem; margin-bottom:10px;">
                ${p.items.map(i => `• 1x ${i.nombre} ${i.excluidos?.length > 0 ? `<br><span style="color:red; font-size:0.75rem; margin-left:10px;">- SIN: ${i.excluidos.join(', ')}</span>` : ''}`).join('<br>')}
            </div>
            <div style="font-weight:600; margin-bottom:10px;">Total: $${p.total.toLocaleString()}</div>
            
            <div class="acciones">
                ${p.estado === 'pendiente' ? `<button onclick="actualizarEstado('${p.id}', 'preparando')" class="btn-estado btn-preparar">Cocinar</button>` : ''}
                ${p.estado === 'preparando' ? `
                    <div style="display:flex; gap:5px;">
                        <button onclick="cerrarPedido('${p.id}', 'nequi')" class="btn-pago nequi">Nequi</button>
                        <button onclick="cerrarPedido('${p.id}', 'banco')" class="btn-pago banco">Banco</button>
                        <button onclick="cerrarPedido('${p.id}', 'efectivo')" class="btn-pago efectivo">Efectivo</button>
                    </div>` : ''}
                ${p.estado === 'listo' ? `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <select onchange="cambiarPago('${p.id}', this.value)" style="margin:0; font-size:0.8rem; width:100px; padding:4px;">
                            <option value="nequi" ${p.metodoPago==='nequi'?'selected':''}>Nequi</option>
                            <option value="banco" ${p.metodoPago==='banco'?'selected':''}>Banco</option>
                            <option value="efectivo" ${p.metodoPago==='efectivo'?'selected':''}>Efectivo</option>
                        </select>
                        <button onclick="actualizarEstado('${p.id}', 'preparando')" style="font-size:0.7rem; background:none; border:none; text-decoration:underline; cursor:pointer;">Corregir</button>
                    </div>` : ''}
            </div>
        `;
        if(p.estado === 'listo') la.appendChild(card); else lp.appendChild(card);
    });
}

function actualizarMétricas() {
    let tHoy = 0, tMes = 0, tN = 0, tB = 0, tE = 0;
    const ventasPlatos = {}, usoIngredientes = {};
    const hoy = new Date();

    pedidosGlobales.forEach(p => {
        const f = p.timestamp?.toDate();
        if(!f) return;
        
        if(f.getMonth() === hoy.getMonth()) tMes += p.total;
        if(f.getDate() === hoy.getDate() && f.getMonth() === hoy.getMonth()) {
            tHoy += p.total;
            if(p.metodoPago === 'nequi') tN += p.total;
            if(p.metodoPago === 'banco') tB += p.total;
            if(p.metodoPago === 'efectivo') tE += p.total;
        }

        p.items.forEach(item => {
            ventasPlatos[item.nombre] = (ventasPlatos[item.nombre] || 0) + 1;
            const ingBase = menuGlobal[item.nombre] || [];
            ingBase.forEach(ing => {
                if(!item.excluidos?.includes(ing)) {
                    usoIngredientes[ing] = (usoIngredientes[ing] || 0) + 1;
                }
            });
        });
    });

    document.getElementById('s-hoy').innerText = `$${tHoy.toLocaleString()}`;
    document.getElementById('s-mes').innerText = `$${tMes.toLocaleString()}`;
    document.getElementById('s-nequi').innerText = `$${tN.toLocaleString()}`;
    document.getElementById('s-bancolombia').innerText = `$${tB.toLocaleString()}`;
    document.getElementById('s-efectivo').innerText = `$${tE.toLocaleString()}`;

    document.getElementById('rankings-ingredientes').innerHTML = Object.entries(usoIngredientes)
        .sort((a,b) => b[1]-a[1])
        .map(([n,v]) => `<span style="background:var(--sidebar); color:white; padding:4px 10px; border-radius:20px; font-size:0.75rem;">${n} (${v})</span>`).join('');
}

window.actualizarEstado = async (id, est) => await updateDoc(doc(db, "pedidos", id), { estado: est });
window.cerrarPedido = async (id, met) => await updateDoc(doc(db, "pedidos", id), { estado: 'listo', metodoPago: met });
window.cambiarPago = async (id, met) => await updateDoc(doc(db, "pedidos", id), { metodoPago: met });

window.resetearEstadisticas = async () => {
    if(confirm("Dagoberto, ¿estás seguro de borrar TODAS las métricas? Esto no se puede deshacer.")){
        const batch = writeBatch(db);
        const snp = await getDocs(collection(db, "pedidos"));
        snp.forEach(d => batch.delete(d.ref));
        await batch.commit();
        alert("Métricas reseteadas.");
    }
};

function escucharCarta() {
    onSnapshot(collection(db, "platos"), (snap) => {
        const list = document.getElementById('inv-list');
        list.innerHTML = ''; menuGlobal = {};
        snap.forEach(d => {
            const p = d.data(); p.id = d.id;
            menuGlobal[p.nombre] = p.ingredientes || [];
            list.innerHTML += `<div style="background:white; padding:10px; margin-bottom:5px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                <span>${p.nombre} - $${p.precio.toLocaleString()}</span>
                <button onclick="editarPlato('${p.id}','${p.nombre}',${p.precio},'${p.categoria}','${p.descripcion||''}','${(p.ingredientes||[]).join(',')}')" class="btn-action btn-outline">Editar</button>
            </div>`;
        });
    });
}

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
        grid.innerHTML += `<div class="mesa-card ${ocupada?'mesa-ocupada':''}">
            <strong>Mesa ${i}</strong><br>
            <small>${ocupada?'OCUPADA':'Libre'}</small>
        </div>`;
    }
};

window.imprimirComanda = (pJson) => {
    const p = JSON.parse(decodeURIComponent(pJson));
    const win = window.open('', '', 'width=300,height=600');
    win.document.write(`<html><body style="font-family:monospace; padding:10px;">
        <h3 style="text-align:center;">IKU RESTAURANTE</h3>
        <hr>
        Cliente: ${p.cliente}<br>
        Tipo: ${p.tipo}<br><hr>
        ${p.items.map(i => `1x ${i.nombre}${i.excluidos?.length?`<br>- SIN: ${i.excluidos.join(',')}`:''}`).join('<br>')}
        <hr>Total: $${p.total.toLocaleString()}
    </body></html>`);
    win.print(); win.close();
};
