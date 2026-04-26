import { db } from './firebase-config.js';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

let carrito = [];
const formatPrice = (num) => Number(num).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

// Utilidad para reproducir sonidos
const playSound = (url) => {
    const audio = new Audio(url);
    audio.play().catch(() => {}); // Evita errores de políticas de autotransproducción
};

document.addEventListener("DOMContentLoaded", () => {
    // 1. Manejo de Parámetros de Mesa
    const params = new URLSearchParams(window.location.search);
    const mesa = params.get('mesa');
    if (mesa) {
        const inputNombre = document.getElementById('nombre-cliente');
        const selectTipo = document.getElementById('tipo-servicio');
        if (inputNombre && selectTipo) {
            inputNombre.value = `Mesa ${mesa}`;
            selectTipo.value = 'Local';
        }
    }

    // 2. Carga de Menú en Tiempo Real
    onSnapshot(query(collection(db, "menu"), orderBy("nombre")), (snapshot) => {
        // Limpiar contenedores
        document.querySelectorAll('.menu-section').forEach(s => s.innerHTML = '');
        
        snapshot.docs.forEach(docSnap => {
            const d = docSnap.data();
            const id = docSnap.id;
            const container = document.getElementById(d.categoria);
            if (!container) return;

            const card = document.createElement('div');
            card.className = 'menu-item';
            card.innerHTML = `
                <div class="dish-info" onclick="this.parentElement.classList.toggle('active')">
                    <div class="dish-text">
                        <h3>${d.nombre}</h3>
                        <p>${d.descripcion || ''}</p>
                    </div>
                    <strong class="dish-price">${formatPrice(d.precio)}</strong>
                </div>
                <div class="expand-content">
                    <div class="qty-wrapper">
                        <div class="qty-control">
                            <button onclick="window.ajustarCant('${id}', -1)" class="btn-qty">-</button>
                            <span id="cant-${id}" class="qty-num">1</span>
                            <button onclick="window.ajustarCant('${id}', 1)" class="btn-qty">+</button>
                        </div>
                    </div>
                    <button class="btn-add-cart" onclick="window.agregarAlCarrito('${d.nombre}', ${d.precio}, '${id}')">AÑADIR AL PEDIDO</button>
                </div>
            `;
            container.appendChild(card);
        });
    });
});

// --- FUNCIONES GLOBALES ---
window.ajustarCant = (id, delta) => {
    const el = document.getElementById(`cant-${id}`);
    let v = parseInt(el.innerText) + delta;
    if (v >= 1) el.innerText = v;
};

window.agregarAlCarrito = (nombre, precio, id) => {
    const cant = parseInt(document.getElementById(`cant-${id}`).innerText);
    carrito.push({ nombre, precio, cantidad: cant, id_prod: id });
    playSound('https://assets.mixkit.co/sfx/preview/mixkit-bubble-pop-up-alert-2358.mp3');
    actualizarCarritoUI();
};

function actualizarCarritoUI() {
    const lista = document.getElementById('cart-items-list');
    const totalEl = document.getElementById('cart-total-price');
    const badge = document.querySelector('.cart-count');
    
    lista.innerHTML = '';
    let total = 0;

    carrito.forEach((item, index) => {
        total += item.precio * item.cantidad;
        const li = document.createElement('div');
        li.className = 'cart-item';
        li.innerHTML = `
            <div>
                <strong>${item.cantidad}x ${item.nombre}</strong>
                <p>${formatPrice(item.precio * item.cantidad)}</p>
            </div>
            <button class="btn-remove-item" onclick="window.quitarDelCarrito(${index})">Eliminar</button>
        `;
        lista.appendChild(li);
    });

    totalEl.innerText = formatPrice(total);
    badge.innerText = carrito.length;
}

window.quitarDelCarrito = (index) => {
    carrito.splice(index, 1);
    actualizarCarritoUI();
};

window.enviarPedido = async () => {
    if (carrito.length === 0) return alert("El carrito está vacío");
    
    const pedido = {
        cliente: document.getElementById('nombre-cliente').value || "Cliente",
        tipo: document.getElementById('tipo-servicio').value,
        items: carrito,
        total: carrito.reduce((sum, i) => sum + (i.precio * i.cantidad), 0),
        estado: 'recibido',
        fecha: serverTimestamp()
    };

    try {
        await addDoc(collection(db, "pedidos"), pedido);
        alert("¡Pedido enviado con éxito!");
        carrito = [];
        actualizarCarritoUI();
        window.cerrarCarrito();
    } catch (e) {
        console.error(e);
    }
};

// --- NAVEGACIÓN ---
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.tab-btn, .menu-section').forEach(el => el.classList.remove('active'));
        btn.classList.add('active');
        const section = document.getElementById(btn.dataset.tab);
        if (section) section.classList.add('active');
    };
});
