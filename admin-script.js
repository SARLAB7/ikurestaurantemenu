import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, addDoc, getDoc, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

const correos = ["cb01grupo@gmail.com", "kelly.araujotafur@gmail.com"];
let totalPAnterior = 0;

const sonar = () => { const a = document.getElementById('notif-sound'); if(a) a.play().catch(e => {}); };

// PROCESAR ESTADÍSTICAS
const procesarEstadisticas = async (pedidos) => {
    const ahora = new Date();
    const mesActual = `${ahora.getMonth() + 1}-${ahora.getFullYear()}`;
    const hoyStr = ahora.toDateString();

    let ventaHoy = 0, ventaMes = 0;
    const conteoGlobal = {};
    const historialMeses = {}; 

    const platosSnap = await getDocs(collection(db, "platos"));
    const catMapa = {};
    platosSnap.forEach(d => { catMapa[d.data().nombre] = d.data().categoria; });

    pedidos.forEach(p => {
        if (p.estado !== 'completado' || !p.timestamp) return;
        const fecha = p.timestamp.toDate();
        const mesKey = `${fecha.getMonth() + 1}-${fecha.getFullYear()}`;
        if (fecha.toDateString() === hoyStr) ventaHoy += p.total;
        if (mesKey === mesActual) ventaMes += p.total;

        if (!historialMeses[mesKey]) historialMeses[mesKey] = { total: 0, platos: {} };
        historialMeses[mesKey].total += p.total;

        p.items.forEach(item => {
            historialMeses[mesKey].platos[item.nombre] = (historialMeses[mesKey].platos[item.nombre] || 0) + 1;
            if (mesKey === mesActual) {
                if (!conteoGlobal[item.nombre]) conteoGlobal[item.nombre] = { cantidad: 0, cat: catMapa[item.nombre] || 'varios' };
                conteoGlobal[item.nombre].cantidad++;
            }
        });
    });

    const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);
    if(document.getElementById('s-hoy')) document.getElementById('s-hoy').innerText = fmt(ventaHoy);
    if(document.getElementById('s-mes')) document.getElementById('s-mes').innerText = fmt(ventaMes);

    const rankingsDiv = document.getElementById('rankings-categoria');
    if(rankingsDiv) {
        const tops = { diario: { n: '---', c: 0 }, rapida: { n: '---', c: 0 }, varios: { n: '---', c: 0 } };
        Object.keys(conteoGlobal).forEach(nombre => {
            const info = conteoGlobal[nombre];
            if (info.cantidad > tops[info.cat].c) tops[info.cat] = { n: nombre, c: info.cantidad };
        });
        rankingsDiv.innerHTML = `
            <div style="padding:15px; background:#f8fafc; border-radius:12px;"><strong>📅 Menú Día</strong><br><small>${tops.diario.n} (${tops.diario.c})</small></div>
            <div style="padding:15px; background:#f8fafc; border-radius:12px;"><strong>🍔 Rápidas</strong><br><small>${tops.rapida.n} (${tops.rapida.c})</small></div>
            <div style="padding:15px; background:#f8fafc; border-radius:12px;"><strong>✨ Varios</strong><br><small>${tops.varios.n} (${tops.varios.c})</small></div>
        `;
    }

    const hBody = document.getElementById('historial-meses');
    if(hBody) {
        hBody.innerHTML = '';
        Object.keys(historialMeses).sort().reverse().forEach(mes => {
            const data = historialMeses[mes];
            const topPlato = Object.keys(data.platos).reduce((a, b) => data.platos[a] > data.platos[b] ? a : b, "---");
            hBody.innerHTML += `<tr><td style="padding:12px;">${mes}</td><td style="padding:12px;"><strong>${fmt(data.total)}</strong></td><td style="padding:12px;">${topPlato}</td></tr>`;
        });
    }
};

const escucharData = () => {
    onSnapshot(query(collection(db, "pedidos"), orderBy("timestamp", "desc")), (sn) => {
        const lp = document.getElementById('l-pendientes');
        const pedidos = [];
        let pCount = 0;
        lp.innerHTML = ''; 
        sn.docs.forEach(docSnap => {
            const p = docSnap.data();
            pedidos.push(p);
            if (p.estado === 'pendiente') {
                pCount++;
                lp.innerHTML += `
                <div style="background:white; padding:20px; border-radius:16px; border-left:6px solid var(--accent); margin-bottom:15px; box-shadow:0 4px 10px rgba(0,0,0,0.03);">
                    <div style="display:flex; justify-content:space-between;"><strong>👤 ${p.cliente}</strong><span style="font-size:0.7rem; color:#94a3b8;">${p.tipo.toUpperCase()}</span></div>
                    <p style="margin:10px 0; font-size:0.9rem;">${p.items.map(i=>i.nombre).join(', ')}</p>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-weight:bold; color:var(--success);">$${p.total.toLocaleString()}</span>
                        <button style="background:var(--success); color:white; border:none; padding:8px 16px; border-radius:8px; cursor:pointer; font-weight:bold;" onclick="completar('${docSnap.id}')">LISTO</button>
                    </div>
                </div>`;
            }
        });
        if(pCount > totalPAnterior) sonar();
        totalPAnterior = pCount;
        procesarEstadisticas(pedidos);
    });
};

const escucharMenu = () => {
    onSnapshot(collection(db, "platos"), (sn) => {
        const inv = document.getElementById('inv-list');
        inv.innerHTML = `
            <div class="admin-group" id="g-diario"><div class="admin-group-header" onclick="toggleSeccion(this)"><h4>📅 Menú del Día</h4><span class="chevron">▼</span></div><div class="admin-group-content" id="adm-diario"></div></div>
            <div class="admin-group" id="g-rapida"><div class="admin-group-header" onclick="toggleSeccion(this)"><h4>🍔 Comidas Rápidas</h4><span class="chevron">▼</span></div><div class="admin-group-content" id="adm-rapida"></div></div>
            <div class="admin-group" id="g-varios"><div class="admin-group-header" onclick="toggleSeccion(this)"><h4>✨ Varios</h4><span class="chevron">▼</span></div><div class="admin-group-content" id="adm-varios"></div></div>
        `;

        sn.docs.forEach(docSnap => {
            const d = docSnap.data();
            const html = `
            <div class="admin-row">
                <div class="dish-info"><strong>${d.nombre}</strong><span>$${Number(d.precio).toLocaleString()}</span></div>
                <div class="actions">
                    <label class="switch"><input type="checkbox" ${d.disponible !== false ? 'checked' : ''} onchange="toggleStock('${docSnap.id}', this.checked)"><span class="slider"></span></label>
                    <button class="btn-action btn-edit" onclick="prepararEdicion('${docSnap.id}')">✏️</button>
                    <button class="btn-action btn-delete" onclick="borrarM('${docSnap.id}')">🗑️</button>
                </div>
            </div>`;
            const target = document.getElementById(`adm-${d.categoria}`);
            if(target) target.innerHTML += html;
        });
    });
};

window.completar = (id) => updateDoc(doc(db, "pedidos", id), { estado: 'completado' });
window.toggleStock = (id, val) => updateDoc(doc(db, "platos", id), { disponible: val });
window.borrarM = (id) => confirm("¿Eliminar este plato de la carta?") && deleteDoc(doc(db, "platos", id));

window.prepararEdicion = async (id) => {
    const snap = await getDoc(doc(db, "platos", id));
    const d = snap.data();
    document.getElementById('edit-id').value = id;
    document.getElementById('name').value = d.nombre;
    document.getElementById('price').value = d.precio;
    document.getElementById('category').value = d.categoria;
    document.getElementById('desc').value = d.descripcion || '';
    document.getElementById('ingredients').value = d.ingredientes?.join(',') || '';
    document.getElementById('f-title').innerText = "✏️ Editando: " + d.nombre;
    document.getElementById('close-x').style.display = "block";
    document.querySelector('.main-content').scrollTo({top: 0, behavior: 'smooth'});
};

window.cancelarEdicion = () => {
    document.getElementById('edit-id').value = "";
    document.getElementById('f-title').innerText = "➕ Gestionar Carta";
    document.getElementById('close-x').style.display = "none";
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
        ingredientes: document.getElementById('ingredients').value.split(','),
        timestamp: serverTimestamp()
    };
    id ? await updateDoc(doc(db, "platos", id), datos) : await addDoc(collection(db, "platos"), { ...datos, disponible: true });
    cancelarEdicion();
};

onAuthStateChanged(auth, (u) => {
    if(u && correos.includes(u.email)) {
        document.getElementById('admin-panel').style.display = 'flex';
        document.getElementById('login-screen').style.display = 'none';
        escucharData(); escucharMenu();
    } else {
        if(u) signOut(auth);
        document.getElementById('admin-panel').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
    }
});

document.getElementById('login-btn').onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
