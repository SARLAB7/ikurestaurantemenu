import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

const correos = ["cb01grupo@gmail.com", "kelly.araujotafur@gmail.com"];
let lastCount = 0;

const sonar = () => { try { document.getElementById('notif-sound').play(); } catch(e){} };

const escucharDatos = () => {
    onSnapshot(query(collection(db, "pedidos"), orderBy("timestamp", "desc")), (sn) => {
        const lp = document.getElementById('l-pendientes');
        const la = document.getElementById('l-atendidos');
        const sHoy = document.getElementById('s-hoy');
        const sMes = document.getElementById('s-mes');
        const hBody = document.getElementById('historial-body');
        const t5 = document.getElementById('top-5');
        const b5 = document.getElementById('bot-5');

        let pCount = 0, hoyTotal = 0, mesTotal = 0;
        const rankingActual = {};
        const historialMeses = {}; // { "05-2026": { total: 0, platos: {} } }
        
        const ahora = new Date();
        const mesActualKey = `${ahora.getMonth() + 1}-${ahora.getFullYear()}`;

        if(lp) lp.innerHTML = ''; 
        if(la) la.innerHTML = '';

        sn.docs.forEach(d => {
            const p = d.data();
            const id = d.id;
            const totalFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(p.total);

            if(p.estado === 'pendiente') {
                pCount++;
                lp.innerHTML += `<div class="pedido-card"><strong>${p.cliente}</strong><p style="font-size:0.8rem; color:#666; margin:8px 0;">${p.items.map(i=>i.nombre).join(', ')}</p><strong>${totalFmt}</strong><button onclick="completar('${id}')" style="background:var(--success); color:white; border:none; width:100%; padding:10px; border-radius:6px; cursor:pointer; margin-top:10px; font-weight:bold;">MARCAR LISTO</button></div>`;
            } else if (p.estado === 'completado' && p.timestamp) {
                const f = p.timestamp.toDate();
                const fKey = `${f.getMonth() + 1}-${f.getFullYear()}`;
                
                // Mostrar en la lista de "Hoy" solo si es la fecha actual
                if(f.getDate() === ahora.getDate() && f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear()) {
                    la.innerHTML += `<div class="atendido-row"><strong>${p.cliente}</strong><span style="color:var(--success); text-align:center;">${totalFmt}</span><button onclick="borrarPedido('${id}')" style="background:none; border:none; color:red; cursor:pointer; text-align:right;">Borrar</button></div>`;
                    hoyTotal += p.total;
                }

                // Lógica de Historial Mensual
                if(!historialMeses[fKey]) historialMeses[fKey] = { total: 0, platos: {} };
                historialMeses[fKey].total += p.total;
                p.items.forEach(i => {
                    historialMeses[fKey].platos[i.nombre] = (historialMeses[fKey].platos[i.nombre] || 0) + 1;
                    if(fKey === mesActualKey) rankingActual[i.nombre] = (rankingActual[i.nombre] || 0) + 1;
                });

                if(fKey === mesActualKey) mesTotal += p.total;
            }
        });

        if(pCount > lastCount) sonar();
        lastCount = pCount;

        const cur = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });
        if(sHoy) sHoy.innerText = cur.format(hoyTotal);
        if(sMes) sMes.innerText = cur.format(mesTotal);

        // Render Historial Tabla
        if(hBody) {
            hBody.innerHTML = '';
            Object.keys(historialMeses).sort().reverse().forEach(k => {
                const data = historialMeses[k];
                const estrella = Object.keys(data.platos).reduce((a, b) => data.platos[a] > data.platos[b] ? a : b, "N/A");
                hBody.innerHTML += `<tr><td>${k}</td><td><strong>${cur.format(data.total)}</strong></td><td>${estrella}</td></tr>`;
            });
        }

        // Render Rankings
        if(t5 && b5) {
            const sort = Object.keys(rankingActual).map(n=>({n, c:rankingActual[n]})).sort((a,b)=>b.c - a.c);
            t5.innerHTML = sort.slice(0,5).map(x=>`<li>${x.n} (${x.c} uds)</li>`).join('');
            b5.innerHTML = sort.slice(-5).reverse().map(x=>`<li>${x.n} (${x.c} uds)</li>`).join('');
        }
    });
};

const escucharMenu = () => {
    onSnapshot(collection(db, "platos"), (sn) => {
        const inv = document.getElementById('inv-list');
        inv.innerHTML = '<h4>Inventario y Stock</h4>';
        sn.docs.forEach(docSnap => {
            const d = docSnap.data();
            inv.innerHTML += `<div style="display:flex; justify-content:space-between; padding:15px; border-bottom:1px solid #eee; align-items:center;">
                <span><strong>${d.nombre}</strong> (${d.categoria})</span>
                <div style="display:flex; gap:15px; align-items:center;">
                    <label class="switch"><input type="checkbox" ${d.disponible !== false ? 'checked' : ''} onchange="toggleStock('${docSnap.id}', this.checked)"><span class="slider"></span></label>
                    <button onclick="prepararEdicion('${docSnap.id}')" style="color:blue; border:none; background:none; cursor:pointer;">Editar</button>
                    <button onclick="borrarPlato('${docSnap.id}')" style="color:red; border:none; background:none; cursor:pointer;">X</button>
                </div>
            </div>`;
        });
    });
};

window.toggleStock = (id, val) => updateDoc(doc(db, "platos", id), { disponible: val });

const mForm = document.getElementById('m-form');
mForm.onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const datos = {
        nombre: document.getElementById('name').value,
        precio: Number(document.getElementById('price').value),
        categoria: document.getElementById('category').value,
        descripcion: document.getElementById('desc').value,
        ingredientes: document.getElementById('ingredients').value.split(',').map(i=>i.trim()),
        timestamp: serverTimestamp()
    };
    if(id) await updateDoc(doc(db, "platos", id), datos);
    else await addDoc(collection(db, "platos"), { ...datos, disponible: true });
    mForm.reset(); window.cancelarEdicion();
};

window.completar = (id) => updateDoc(doc(db, "pedidos", id), { estado: 'completado' });
window.borrarPedido = (id) => { if(confirm("¿Borrar registro?")) deleteDoc(doc(db, "pedidos", id)); };
window.borrarPlato = (id) => { if(confirm("¿Borrar plato permanentemente?")) deleteDoc(doc(db, "platos", id)); };

window.prepararEdicion = (id) => {
    onSnapshot(doc(db, "platos", id), (snap) => {
        const d = snap.data();
        if(!d) return;
        document.getElementById('edit-id').value = id;
        document.getElementById('name').value = d.nombre;
        document.getElementById('price').value = d.precio;
        document.getElementById('category').value = d.categoria;
        document.getElementById('desc').value = d.descripcion || '';
        document.getElementById('ingredients').value = d.ingredientes.join(',');
        document.getElementById('f-title').innerText = "Editando Plato...";
        document.getElementById('s-btn').innerText = "ACTUALIZAR CAMBIOS";
        document.getElementById('close-x').style.display = "block";
        document.querySelector('.content-area').scrollTo({top:0, behavior:'smooth'});
    }, {onlyOnce:true});
};

window.cancelarEdicion = () => {
    document.getElementById('edit-id').value = "";
    document.getElementById('f-title').innerText = "Añadir Plato";
    document.getElementById('s-btn').innerText = "GUARDAR PLATO";
    document.getElementById('close-x').style.display = "none";
    mForm.reset();
};

onAuthStateChanged(auth, (u) => {
    if(u && correos.includes(u.email)) {
        document.getElementById('admin-panel').style.display = 'flex';
        document.getElementById('login-screen').style.display = 'none';
        escucharDatos(); escucharMenu();
    }
});

document.getElementById('login-btn').onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
