import { db } from './firebase-config.js';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

let carrito = [];
const ICON_TRASH = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

window.toggleDish = (header) => {
    const dish = header.parentElement;
    const isOpened = dish.classList.contains('expanded');
    document.querySelectorAll('.dish-item').forEach(i => i.classList.remove('expanded'));
    if (!isOpened) dish.classList.add('expanded');
};

window.toggleCart = () => document.getElementById('cart-modal').classList.toggle('open');

window.agregarAlCarrito = (nombre, precio, id) => {
    const notaInput = document.getElementById(`note-${id}`);
    const nota = notaInput ? notaInput.value.trim() : "";
    carrito.push({ nombre, precio: parseInt(precio), nota });
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
        cont.innerHTML += `
            <div class="cart-item-row">
                <div>
                    <strong>${item.nombre}</strong>
                    <span style="color:var(--success); font-weight:600; font-size:0.9rem; display:block;">$${item.precio.toLocaleString()}</span>
                    ${item.nota ? `<span class="cart-item-note">Nota: ${item.nota}</span>` : ''}
                </div>
                <button onclick="quitar(${i})" class="btn-remove-item">${ICON_TRASH}</button>
            </div>`;
    });
    if(priceEl) priceEl.innerText = `$${total.toLocaleString()}`;
}

window.quitar = (i) => { carrito.splice(i, 1); actualizarCarrito(); };

window.enviarPedido = async () => {
    const cliente = document.getElementById('nombre-cliente')?.value;
    const tipo = document.getElementById('tipo-servicio')?.value;
    const quiereWA = document.getElementById('check-whatsapp')?.checked;

    if (!cliente || carrito.length === 0) return alert("Por favor ingresa tu nombre y agrega productos.");

    const total = carrito.reduce((s, x) => s + x.precio, 0);
    try {
        await addDoc(collection(db, "pedidos"), {
            cliente, tipo, items: carrito, total, estado: "pendiente", timestamp: serverTimestamp()
        });
        
        if (quiereWA) {
            const msjWA = `*NUEVO PEDIDO IKU*%0A*Cliente:* ${cliente}%0A*Servicio:* ${tipo}%0A*Total:* $${total.toLocaleString()}`;
            window.open(`https://wa.me/573210000000?text=${msjWA}`);
        }
        
        alert("¡Pedido enviado!");
        carrito = []; 
        actualizarCarrito(); 
        window.toggleCart();
    } catch (e) { alert("Error: " + e.message); }
};

// Carga de platos
onSnapshot(query(collection(db, "platos"), orderBy("timestamp", "desc")), (sn) => {
    const sDiario = document.getElementById('diario');
    const sRapida = document.getElementById('rapida');
    const sVarios = document.getElementById('varios');
    
    if(sDiario) sDiario.innerHTML = '';
    if(sRapida) sRapida.innerHTML = '';
    if(sVarios) sVarios.innerHTML = '';
    
    document.getElementById('loader').style.display = 'none';

    sn.docs.forEach(docSnap => {
        const d = docSnap.data();
        if (d.disponible === false) return;

        let listaIng = Array.isArray(d.ingredientes) ? d.ingredientes : (d.ingredientes ? d.ingredientes.split(',') : []);
        let ingHTML = '';
        if (listaIng.length > 0 && listaIng[0].trim() !== "") {
            ingHTML = `<div class="ing-container">${listaIng.map(ing => `<span class="ing-pill">${ing.trim()}</span>`).join('')}</div>`;
        }

        const html = `
            <div class="dish-item">
                <div class="dish-header" onclick="toggleDish(this)">
                    <div><h3>${d.nombre}</h3><p style="font-size:0.85rem; color:gray;">${d.descripcion || ''}</p></div>
                    <strong class="dish-price">$${Number(d.precio).toLocaleString()}</strong>
                </div>
                <div class="expand-content">
                    ${ingHTML}
                    <input type="text" id="note-${docSnap.id}" class="note-input" placeholder="¿Alguna nota especial?">
                    <button class="btn-add-cart" onclick="agregarAlCarrito('${d.nombre}', '${d.precio}', '${docSnap.id}')">AÑADIR AL PEDIDO</button>
                </div>
            </div>`;
        
        if (d.categoria === 'diario' && sDiario) sDiario.innerHTML += html;
        else if (d.categoria === 'rapida' && sRapida) sRapida.innerHTML += html;
        else if (d.categoria === 'varios' && sVarios) sVarios.innerHTML += html;
    });
});

// --- SOLUCIÓN FUNCIONAL DE LAS PESTAÑAS (TABS) ---

// 1. Ocultar de entrada todo lo que no sea la pestaña activa
document.querySelectorAll('.menu-section').forEach(s => {
    s.style.display = s.classList.contains('active') ? 'block' : 'none';
});

// 2. Controlar la visibilidad al hacer clic
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
        // Quitar la clase active a todos los botones
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        
        // Ocultar todas las secciones forzando display: none
        document.querySelectorAll('.menu-section').forEach(s => {
            s.classList.remove('active');
            s.style.display = 'none';
        });
        
        // Activar el botón y MOSTRAR la sección seleccionada
        btn.classList.add('active');
        const target = document.getElementById(btn.dataset.tab);
        if(target) {
            target.classList.add('active');
            target.style.display = 'block'; // <-- ESTO EVITA QUE SE VEAN REPETIDOS
        }
    };
});
