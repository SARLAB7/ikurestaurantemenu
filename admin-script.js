import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, addDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

const correos = ["cb01grupo@gmail.com", "kelly.araujotafur@gmail.com"];

const escucharMenu = () => {
    onSnapshot(collection(db, "platos"), (sn) => {
        const inv = document.getElementById('inv-list');
        if(!inv) return;
        
        // Creamos estructura de grupos
        inv.innerHTML = `
            <div id="group-diario" class="admin-group"><h3>Menú del Día</h3><div class="list"></div></div>
            <div id="group-rapida" class="admin-group"><h3>Comidas Rápidas</h3><div class="list"></div></div>
            <div id="group-varios" class="admin-group"><h3>Varios</h3><div class="list"></div></div>
        `;

        sn.docs.forEach(docSnap => {
            const d = docSnap.data();
            const targetList = inv.querySelector(`#group-${d.categoria} .list`);
            
            if(targetList) {
                targetList.innerHTML += `
                <div class="admin-dish-row">
                    <span><strong>${d.nombre}</strong> ($${Number(d.precio).toLocaleString()})</span>
                    <div style="display:flex; gap:10px; align-items:center;">
                        <label class="switch">
                            <input type="checkbox" ${d.disponible !== false ? 'checked' : ''} onchange="toggleStock('${docSnap.id}', this.checked)">
                            <span class="slider"></span>
                        </label>
                        <button onclick="prepararEdicion('${docSnap.id}')" class="btn-edit">Editar</button>
                        <button onclick="borrarM('${docSnap.id}')" class="btn-delete">×</button>
                    </div>
                </div>`;
            }
        });
    });
};

// ... Resto de funciones (completar, borrarP, etc.) se mantienen igual ...

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

window.prepararEdicion = async (id) => {
    const snap = await getDoc(doc(db, "platos", id));
    if(!snap.exists()) return;
    const d = snap.data();
    document.getElementById('edit-id').value = id;
    document.getElementById('name').value = d.nombre;
    document.getElementById('price').value = d.precio;
    document.getElementById('category').value = d.categoria;
    document.getElementById('desc').value = d.descripcion || '';
    document.getElementById('ingredients').value = d.ingredientes ? d.ingredientes.join(',') : '';
    document.getElementById('f-title').innerText = "Editando Plato...";
    document.querySelector('.content-area').scrollTo({top:0, behavior:'smooth'});
};

window.cancelarEdicion = () => {
    document.getElementById('edit-id').value = "";
    document.getElementById('f-title').innerText = "Añadir Plato";
    if(mForm) mForm.reset();
};

window.borrarM = (id) => { if(confirm("¿Eliminar plato?")) deleteDoc(doc(db, "platos", id)); };

onAuthStateChanged(auth, (u) => {
    if(u && correos.includes(u.email)) {
        document.getElementById('admin-panel').style.display = 'flex';
        document.getElementById('login-screen').style.display = 'none';
        escucharMenu();
    }
});
