import { db } from './firebase-config.js';
import { collection, addDoc, onSnapshot, doc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

let carrito = [];
const ICON_TRASH = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const mesaParam = params.get('mesa');
    if (mesaParam) {
        const inputNombre = document.getElementById('nombre-cliente');
        const selectTipo = document.getElementById('tipo-servicio');
        if (inputNombre && selectTipo) {
            selectTipo.value = 'mesa';
            inputNombre.value = "Mesa " + mesaParam;
            inputNombre.readOnly = true;
            inputNombre.style.backgroundColor = "#f1f5f9";
        }
    }
});

window.toggleDish = (header) => {
    const dish = header.parentElement;
    const isOpened = dish.classList.contains('expanded');
    document.querySelectorAll('.dish-item').forEach(i => i.classList.remove('expanded'));
    if (!isOpened) dish.classList.add('expanded');
};

window.toggleCart = () => document.getElementById('cart-modal').classList.toggle('open');
window.cerrarTracker = () => document.getElementById('tracker-modal').classList.remove('open');

window.agregarAlCarrito = (nombre, precio, id) => {
    const notaInput = document.getElementById(`note-${id}`);
    const nota = notaInput ? notaInput.value.trim() : "";
    carrito.push({ nombre, precio: parseInt(precio), nota, id });
    if(notaInput) notaInput.value = '';
    actualizarCarrito();
};

function actualizarCarrito() {
    const cont = document.getElementById('cart-items');
    const priceEl = document.getElementById('cart-total-price');
    const countEl = document.getElementById('cart-count');
    if(countEl) countEl.innerText = carrito.length;
    if(!cont) return;
    cont.innerHTML = '';
    let total = 0;
    carrito.forEach((item, i) => {
        total += item.precio;
        cont.innerHTML += `<div class="cart-item-row"><div><strong>${item.nombre}</strong><span style="color:#22c55e; display:block;">$${item.precio.toLocaleString()}</span>${item.nota ? `<span class="cart-item-note">Nota: ${item.nota}</span>` : ''}</div><button onclick="quitar(${i})" class="btn-remove-item">${ICON_TRASH}</button></div>`;
    });
    if(priceEl) priceEl.innerText = `$${total.toLocaleString()}`;
}

window.quitar = (i) => { carrito.splice(i, 1); actualizarCarrito(); };

window.enviarPedido = async () => {
    const cliente = document.getElementById('nombre-cliente')?.value;
    const tipo = document.getElementById('tipo-servicio')?.value;
    const quiereWA = document.getElementById('check-whatsapp')?.checked;
    const btn = document.querySelector('.btn-send-order');
    const textoOriginal = btn.innerHTML;

    if (!cliente || carrito.length === 0) { btn.innerHTML = "Faltan datos ⚠️"; setTimeout(() => btn.innerHTML = textoOriginal, 2000); return; }

    const total = carrito.reduce((s, x) => s + x.precio, 0);
    try {
        btn.innerHTML = "Enviando... ⏳";
        const docRef = await addDoc(collection(db, "pedidos"), { cliente, tipo, items: carrito, total, estado: "pendiente", timestamp: serverTimestamp() });
        if (quiereWA) window.open(`https://wa.me/573210000000?text=*PEDIDO IKU*%0A*Cliente:* ${cliente}%0A*Total:* $${total.toLocaleString()}`);
        btn.innerHTML = "¡Pedido enviado! ✅";
        setTimeout(() => {
            carrito = []; actualizarCarrito();
            window.toggleCart(); btn.innerHTML = textoOriginal;
            iniciarTracker(docRef.id);
        }, 1500);
    } catch (e) { btn.innerHTML = "Error ❌"; }
};

window.iniciarTracker = (id) => {
    document.getElementById('tracker-modal').classList.add('open');
    onSnapshot(doc(db, "pedidos", id), (docSnap) => {
        if(docSnap.exists()) {
            const est = docSnap.data().estado;
            const icon = document.getElementById('tracker-icon');
            const stEl = document.getElementById('tracker-status');
            const descEl = document.getElementById('tracker-desc');
            if(est === 'pendiente') { icon.innerText = '📥'; stEl.innerText = 'Recibido'; descEl.innerText = 'Esperando cocina...'; }
            if(est === 'preparando') { icon.innerText = '🍳'; stEl.innerText = 'En el sartén'; descEl.innerText = 'El chef está preparando tu orden.'; }
            if(est === 'completado') { icon.innerText = '🏃‍♂️'; stEl.innerText = '¡Listo!'; descEl.innerText = 'Tu pedido está listo.'; }
        }
    });
};

onSnapshot(query(collection(db, "platos"), orderBy("timestamp", "desc")), (sn) => {
    const sDiario = document.getElementById('diario');
    const sRapida = document.getElementById('rapida');
    const sVarios = document.getElementById('varios');
    if(sDiario) sDiario.innerHTML = ''; if(sRapida) sRapida.innerHTML = ''; if(sVarios) sVarios.innerHTML = '';
    document.getElementById('loader').style.display = 'none';
    sn.docs.forEach(docSnap => {
        const d = docSnap.data();
        if (d.disponible === false) return;
        const html = `<div class="dish-item"><div class="dish-header" onclick="toggleDish(this)"><div><h3>${d.nombre}</h3><p>${d.descripcion || ''}</p></div><strong class="dish-price">$${Number(d.precio).toLocaleString()}</strong></div><div class="expand-content"><input type="text" id="note-${docSnap.id}" class="note-input" placeholder="¿Nota especial?"><button class="btn-add-cart" onclick="agregarAlCarrito('${d.nombre}', '${d.precio}', '${docSnap.id}')">AÑADIR AL PEDIDO</button></div></div>`;
        if (d.categoria === 'diario') sDiario.innerHTML += html;
        else if (d.categoria === 'rapida') sRapida.innerHTML += html;
        else if (d.categoria === 'varios') sVarios.innerHTML += html;
    });
});

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.menu-section').forEach(s => { s.classList.remove('active'); s.style.display = 'none'; });
        btn.classList.add('active');
        const target = document.getElementById(btn.dataset.tab);
        if(target) { target.classList.add('active'); target.style.display = 'block'; }
    };
});
