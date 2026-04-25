import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

const correos = ["cb01grupo@gmail.com", "kelly.araujotafur@gmail.com"];
let totalPendientesAnterior = 0;

const sonar = () => document.getElementById('notif-sound').play();

const escucharPedidosYStats = () => {
    onSnapshot(query(collection(db, "pedidos"), orderBy("timestamp", "desc")), (sn) => {
        const lp = document.getElementById('l-pendientes');
        const la = document.getElementById('l-atendidos');
        const sHoy = document.getElementById('s-hoy');
        const sMes = document.getElementById('s-mes');
        const t5 = document.getElementById('top-5');
        const b5 = document.getElementById('bot-5');

        let pendCount = 0, hoy = 0, mes = 0;
        const ranking = {};
        const ahora = new Date();

        lp.innerHTML = ''; la.innerHTML = '';

        sn.docs.forEach(d => {
            const p = d.data();
            const id = d.id;
            const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(p.total);

            if(p.estado === 'pendiente') {
                pendCount++;
                const badgeClass = p.tipo === 'domicilio' ? 'badge-domi' : 'badge-mesa';
                const badgeIcon = p.tipo === 'domicilio' ? '🛵 DOMICILIO' : '🍽️ MESA';
                
                lp.innerHTML += `
                    <div class="pedido-card">
                        <span class="badge ${badgeClass}">${badgeIcon}</span>
                        <div style="margin-bottom:10px;"><strong>👤 ${p.cliente}</strong></div>
                        <p style="font-size:0.8rem; margin:10px 0;">${p.items.map(i=>i.nombre).join(', ')}</p>
                        <strong style="color:var(--success);">${fmt}</strong>
                        <button onclick="completar('${id}')" style="background:var(--success); color:white; border:none; width:100%; padding:10px; border-radius:6px; cursor:pointer; margin-top:10px; font-weight:bold;">MARCAR LISTO</button>
                    </div>`;
            } else {
                la.innerHTML += `<div class="atendido-row"><strong>${p.cliente}</strong><span style="color:var(--success);">${fmt}</span><button onclick="borrarP('${id}')" style="background:none; border:none; color:red; cursor:pointer;">Eliminar</button></div>`;
                
                if(p.timestamp) {
                    const f = p.timestamp.toDate();
                    if(f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear()){
                        mes += p.total;
                        if(f.getDate() === ahora.getDate()) hoy += p.total;
                        p.items.forEach(i => ranking[i.nombre] = (ranking[i.nombre] || 0) + 1);
                    }
                }
            }
        });

        if(pendCount > totalPendientesAnterior) sonar();
        totalPendientesAnterior = pendCount;

        const cur = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });
        if(sHoy) sHoy.innerText = cur.format(hoy);
        if(sMes) sMes.innerText = cur.format(mes);

        if(t5 && b5) {
            const sorted = Object.keys(ranking).map(n=>({n, c:ranking[n]})).sort((a,b)=>b.c - a.c);
            t5.innerHTML = sorted.slice(0,5).map(x=>`<li>${x.n} (${x.c})</li>`).join('');
            b5.innerHTML = sorted.slice(-5).reverse().map(x=>`<li>${x.n} (${x.c})</li>`).join('');
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
                <span><strong>${d.nombre}</strong></span>
                <div style="display:flex; gap:15px; align-items:center;">
                    <label class="switch"><input type="checkbox" ${d.disponible !== false ? 'checked' : ''} onchange="toggleStock('${docSnap.id}', this.checked)"><span class="slider"></span></label>
                    <button onclick="prepararEdicion('${docSnap.id}')" style="color:blue; border:none; background:none; cursor:pointer;">Editar</button>
                    <button onclick="borrarM('${docSnap.id}')" style="color:red; border:none; background:none; cursor:pointer;">X</button>
                </div>
            </div>`;
        });
    });
};

window.toggleStock = (id, val) => updateDoc(doc(db, "platos", id), { disponible: val });

const form = document.getElementById('m-form');
form.onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const datos = {
        nombre: document.getElementById('name').value,
        precio: Number(document.getElementById('price').value),
        categoria: document.getElementById('category').value,
        descripcion: document.getElementById('desc').value,
        ingredientes: document.getElementById('ingredients').value.split(','),
        timestamp: serverTimestamp()
    };
    if(id) await updateDoc(doc(db, "platos", id), datos);
    else await addDoc(collection(db, "platos"), { ...datos, disponible: true });
    form.reset(); window.cancelarEdicion();
};

window.completar = (id) => updateDoc(doc(db, "pedidos", id), { estado: 'completado' });
window.borrarP = (id) => { if(confirm("¿Borrar registro?")) deleteDoc(doc(db, "pedidos", id)); };
window.borrarM = (id) => { if(confirm("¿Borrar plato?")) deleteDoc(doc(db, "platos", id)); };

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
    document.getElementById('s-btn').innerText = "PUBLICAR";
    document.getElementById('close-x').style.display = "none";
    form.reset();
};

onAuthStateChanged(auth, (u) => {
    if(u && correos.includes(u.email)) {
        document.getElementById('admin-panel').style.display = 'flex';
        document.getElementById('login-screen').style.display = 'none';
        escucharData(); escucharMenu();
    }
});

document.getElementById('login-btn').onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
