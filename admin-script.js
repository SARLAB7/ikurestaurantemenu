import { db, auth } from './firebase-config.js';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { collection, addDoc, serverTimestamp, query, onSnapshot, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

const correosAutorizados = ["cb01grupo@gmail.com", "kelly.araujotafur@gmail.com"];

const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const adminPanel = document.getElementById('admin-panel');
const loginScreen = document.getElementById('login-screen');
const userTag = document.getElementById('user-tag');
const listaAdmin = document.getElementById('lista-admin');
const form = document.getElementById('menu-form');

// --- 1. LOGIN / LOGOUT ---
loginBtn.onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
logoutBtn.onclick = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
    if (user && correosAutorizados.includes(user.email)) {
        adminPanel.style.display = 'block';
        loginScreen.style.display = 'none';
        userTag.innerText = user.email;
        escucharPlatos(); // Activa la lista de borrado
    } else {
        if(user) { alert("Acceso denegado"); signOut(auth); }
        adminPanel.style.display = 'none';
        loginScreen.style.display = 'block';
    }
});

// --- 2. ESCUCHAR Y MOSTRAR PLATOS (Para eliminar) ---
function escucharPlatos() {
    const q = collection(db, "platos");
    onSnapshot(q, (snapshot) => {
        listaAdmin.innerHTML = '';
        if (snapshot.empty) {
            listaAdmin.innerHTML = '<p style="font-size:0.8rem; color:#999">No hay platos activos.</p>';
        }
        snapshot.docs.forEach(plato => {
            const data = plato.data();
            const div = document.createElement('div');
            div.className = 'plato-item';
            div.innerHTML = `
                <span>${data.nombre} ($${data.precio})</span>
                <button class="btn-delete" data-id="${plato.id}">Retirar</button>
            `;
            listaAdmin.appendChild(div);
        });

        // Asignar eventos a los botones de borrar
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.onclick = async (e) => {
                const id = e.target.getAttribute('data-id');
                if(confirm("¿Retirar este plato?")) {
                    await deleteDoc(doc(db, "platos", id));
                }
            };
        });
    });
}

// --- 3. GUARDAR NUEVO PLATO ---
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await addDoc(collection(db, "platos"), {
            nombre: document.getElementById('name').value,
            precio: document.getElementById('price').value,
            categoria: document.getElementById('category').value,
            descripcion: document.getElementById('desc').value,
            ingredientes: document.getElementById('ingredients').value.split(','),
            timestamp: serverTimestamp()
        });
        alert("¡Plato publicado!");
        form.reset();
    } catch (err) {
        alert("Error: Revisa las reglas de Firebase.");
        console.error(err);
    }
});
