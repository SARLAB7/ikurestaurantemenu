import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

const correos = ["cb01grupo@gmail.com", "kelly.araujotafur@gmail.com"];
let totalPendientesAnterior = 0;

const sonar = () => {
    const audio = document.getElementById('notif-sound');
    if(audio) audio.play().catch(e => console.log("Sonido bloqueado por el navegador"));
};

const escucharData = () => {
    onSnapshot(query(collection(db, "pedidos"), orderBy("timestamp", "desc")), (sn) => {
        const lp = document.getElementById('l-pendientes');
        const la = document.getElementById('l-atendidos');
        const sHoy = document.getElementById('s-hoy');
        const sMes = document.getElementById('s-mes');
        const hBody = document.getElementById('historial-body');
        const t5 = document.getElementById('top-5');
        const b5 = document.getElementById('bot-5');

        let pendCount = 0, hoy = 0, mesActualTotal = 0;
        const rankingMesActual = {};
        const historialMeses = {}; 
        
        const ahora = new Date();
        const mesActualKey = `${ahora.getMonth() + 1}-${ahora.getFullYear()}`;

        if(lp) lp.innerHTML = ''; 
        if(la) la.innerHTML = '';

        sn.docs.forEach(d => {
            const p = d.data();
            const id = d.id;
            const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(p.total);

            if(p.estado === 'pendiente') {
                pendCount++;
                const badgeClass = p.tipo === 'domicilio' ? 'background: #fef3c7; color: #d97706;' : 'background: #e0f2fe; color: #0284c7;';
                const badgeIcon = p.tipo === 'domicilio' ? '🛵 DOMICILIO' : '🍽️ MESA';
                
                if(lp) lp.innerHTML += `
                    <div class="pedido-card" style="background: white; border-radius: 10px; border: 1px solid #e2e8f0; border-left: 6px solid #ffcc00; padding: 20px; margin-bottom: 15px;">
                        <span style="font-size: 0.65rem; padding: 3px 8px; border-radius: 4px; font-weight: bold; text-transform: uppercase; margin-bottom: 10px; display: inline-block; ${badgeClass}">${badgeIcon}</span>
                        <div style="margin-bottom:10px;"><strong>👤 ${p.cliente}</strong></div>
                        <p style="font-size:0.8rem; margin:10px 0;">${p.items.map(i=>i.nombre).join(', ')}</p>
                        <strong style="color:#28a745;">${fmt}</strong>
                        <button onclick="completar('${id}')" style="background:#28a745; color:white; border:none; width:100%; padding:10px; border-radius:6px; cursor:pointer; margin-top:10px; font-weight:bold;">MARCAR LISTO</button>
                    </div>`;
            } else if (p.estado === 'completado' && p.timestamp) {
                const f = p.timestamp.toDate();
                const fKey = `${f.getMonth() + 1}-${f.getFullYear()}`;
                
                if(f.getDate() === ahora.getDate() && f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear()) {
                    if(la) la.innerHTML += `<div style="display: grid; grid-template-columns: 1fr 1fr 100px; padding: 10px 20px; background: #f9fafb; border-radius: 8px; margin-bottom: 5px; font-size: 0.85rem; border: 1px solid #edf2f7;"><strong>${p.cliente}</strong><span style="color:#28a745; text-align:center;">${fmt}</span><button onclick="borrarP('${id}')" style="background:none; border:none; color:red; cursor:pointer; text-align:right;">Borrar</button></div>`;
                    hoy += p.total;
                }

                if(!historialMeses[fKey]) historialMeses[fKey] = { total: 0, platos: {} };
                historialMeses[fKey].total += p.total;
                p.items.forEach(i => {
                    historialMeses[fKey].platos[i.nombre] = (historialMeses[fKey].platos[i.nombre] || 0) + 1;
                    if(fKey === mesActualKey) rankingMesActual[i.nombre] = (rankingMesActual[i.nombre] || 0) + 1;
                });

                if(fKey === mesActualKey) mesActualTotal += p.total;
            }
        });

        if(pendCount > totalPendientesAnterior) sonar();
        totalPendientesAnterior = pendCount;

        const cur = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });
        if(sHoy) sHoy.innerText = cur.format(hoy);
        if(sMes) sMes.innerText = cur.format(mesActualTotal);

        if(hBody) {
            hBody.innerHTML = '';
            Object.keys(historialMeses).sort().reverse().forEach(key => {
                if(key !== mesActualKey) {
                    const mesData = historialMeses[key];
                    const estrella = Object.keys(mesData.platos).reduce((a, b) => mesData.platos[a] > mesData.platos[b] ? a : b, "---");
                    hBody.innerHTML += `<tr><td style="padding: 10px; border-bottom: 1px solid #eee;">${key}</td><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${cur.format(mesData.total)}</strong></td><td style="padding: 10px; border-bottom: 1px solid #eee;">${estrella}</td></tr>`;
                }
            });
        }

        if(t5 && b5) {
            const sorted = Object.keys(rankingMesActual).map(n=>({n, c:rankingMesActual[n]})).sort((a,b)=>b.c - a.c);
            t5.innerHTML = sorted.slice(0,5).map(x=>`<li style="margin-bottom: 5px;">${x.n} (${x.c})</li>`).join('');
            b5.innerHTML = sorted.slice(-5).reverse().map(x=>`<li style="margin-bottom: 5px;">${x.n} (${x.c})</li>`).join('');
        }
    });
};

const escucharMenu = () => {
    onSnapshot(collection(db, "platos"), (sn) => {
        const inv = document.getElementById('inv-list');
        if(!inv) return;
        inv.innerHTML = '<h4>Inventario y Stock</h4>';
        sn.docs.forEach(docSnap => {
            const d = docSnap.data();
            inv.innerHTML += `
            <div style="display:flex; justify-content:space-between; padding:15px; border-bottom:1px solid #eee; align-items:center;">
                <span><strong>${d.nombre}</strong></span>
                <div style="display:flex; gap:15px; align-items:center;">
                    <label style="position: relative; display: inline-block; width: 40px; height: 22px;">
                        <input type="checkbox" style="opacity: 0; width: 0; height: 0;" ${d.disponible !== false ? 'checked' : ''} onchange="toggleStock('${docSnap.id}', this.checked)">
                        <span style="position: absolute; cursor: pointer; inset: 0; background: ${d.disponible !== false ? '#28a745' : '#ccc'}; border-radius: 34px;">
                            <span style="position: absolute; height: 16px; width: 16px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: .4s; transform: ${d.disponible !== false ? 'translateX(18px)' : 'translateX(0)'};"></span>
                        </span>
                    </label>
                    <button onclick="prepararEdicion('${docSnap.id}')" style="color:blue; border:none; background:none; cursor:pointer; font-weight:bold;">Editar</button>
                    <button onclick="borrarM('${docSnap.id}')" style="color:red; border:none; background:none; cursor:pointer; font-weight:bold;">X</button>
                </div>
            </div>`;
        });
    });
};

window.toggleStock = (id, val) => updateDoc(doc(db, "platos", id), { disponible: val });

const mForm = document.getElementById('m-form');
if(mForm) {
    mForm.onsubmit = async (e) => {
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
        mForm.reset(); window.cancelarEdicion();
    };
}

window.completar = (id) => updateDoc(doc(db, "pedidos", id), { estado: 'completado' });
window.borrarP = (id) => { if(confirm("¿Borrar registro de hoy?")) deleteDoc(doc(db, "pedidos", id)); };
window.borrarM = (id) => { if(confirm("¿Borrar plato permanentemente?")) deleteDoc(doc(db, "platos", id)); };

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
    if(mForm) mForm.reset();
};

// --- LOGICA DE AUTENTICACION RESTAURADA ---
onAuthStateChanged(auth, (u) => {
    const panel = document.getElementById('admin-panel');
    const login = document.getElementById('login-screen');
    
    if(u && correos.includes(u.email)) {
        if(panel) panel.style.display = 'flex';
        if(login) login.style.display = 'none';
        escucharData(); escucharMenu();
    } else {
        if(u) { alert("Acceso denegado: Correo no autorizado."); signOut(auth); }
        if(panel) panel.style.display = 'none';
        if(login) login.style.display = 'flex';
    }
});

const lBtn = document.getElementById('login-btn');
if(lBtn) {
    lBtn.onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
}
window.cerrarSesion = () => signOut(auth);
