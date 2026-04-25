import { db } from './firebase-config.js';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

let carrito = [];

// Notificaciones Toast
const toastDiv = document.createElement('div');
toastDiv.id = 'toast';
document.body.appendChild(toastDiv);

const mostrarNotificacion = (mensaje) => {
    toastDiv.innerText = mensaje;
    toastDiv.classList.add("show");
    setTimeout(() => { toastDiv.classList.remove("show"); }, 3000);
};

// Acordeón de platos
window.toggleDish = (header) => {
    const dish = header.parentElement;
    const isOpened = dish.classList.contains('expanded');
    document.querySelectorAll('.dish-item').forEach(i => i.classList.remove('expanded'));
    if (!isOpened) dish.classList.add('expanded');
};

// Carrito
window.toggleCart = () => {
    const modal = document.getElementById('cart-modal');
    if(modal) modal.classList.toggle('open');
};

window.agregarAlCarrito = (nombre, precio, id) => {
    const notaEl = document.getElementById(`note-${id}`);
    const nota = notaEl ? notaEl.value : "";
    carrito.push({ nombre, precio: parseInt(precio), nota });
    if(notaEl) notaEl.value = '';
    actualizarCarrito();
    mostrarNotificacion(`Añadido: ${nombre} 🛒`); 
};

function actualizarCarrito() {
    const cont = document.getElementById('cart-items');
    const countEl = document.getElementById('cart-count');
    const priceEl = document.getElementById('cart-total-price');
    
    if(countEl) countEl.innerText = carrito.length;
    if(!cont) return;
    
    cont.innerHTML = '';
    let total = 0;
    
    carrito.forEach((item, i) => {
        total += item.precio;
        cont.innerHTML += `
            <div class="cart-item-row">
                <div style="display:flex; justify-content:space-between;">
                    <strong>${item.nombre}</strong> 
                    <span>$${item.precio.toLocaleString()}</span>
                </div>
                ${item.nota ? `<p class="cart-item-note">Nota: ${item.nota}</p>` : ''}
                <button onclick="quitar(${i})" class="btn-remove">Quitar</button>
            </div>`;
    });
    
    if(priceEl) priceEl.innerText = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(total);
}

window.quitar = (i) => { carrito.splice(i, 1); actualizarCarrito(); };

window.enviarPedido = async () => {
    const mesaDireccion = document.getElementById('nombre-cliente')?.value;
    const tipoServicio = document.getElementById('tipo-servicio')?.value;
    const quiereWhatsApp = document.getElementById('check-whatsapp')?.checked;

    if (!mesaDireccion || carrito.length === 0) { 
        alert("Ingresa tu nombre/mesa y añade productos."); 
        return; 
    }

    const total = carrito.reduce((s, x) => s + x.precio, 0);
    
    try {
        await addDoc(collection(db, "pedidos"), {
            cliente: mesaDireccion,
            tipo: tipoServicio,
            items: carrito,
            total: total,
            estado: "pendiente",
            timestamp: serverTimestamp()
        });

        if (quiereWhatsApp) {
            const textoWA = `*IKU - NUEVO PEDIDO*%0A*Cliente:* ${mesaDireccion}%0A*Items:*%0A${carrito.map(i => `- ${i.nombre}`).join('%0A')}%0A*Total:* $${total.toLocaleString()}`;
            window.open(`https://wa.me/573210000000?text=${textoWA}`);
        }

        mostrarNotificacion("¡Pedido enviado! 🧑‍🍳"); 
        carrito = []; 
        actualizarCarrito(); 
        window.toggleCart();
    } catch (e) { 
        mostrarNotificacion("Error de conexión."); 
    }
};

// ESCUCHA DE PLATOS POR CATEGORÍA
onSnapshot(query(collection(db, "platos"), orderBy("timestamp", "desc")), (sn) => {
    const loader = document.getElementById('loader');
    if(loader) loader.style.display = 'none';

    // Limpiamos los contenedores antes de renderizar
    const divs = {
        diario: document.getElementById('diario'),
        rapida: document.getElementById('rapida'),
        varios: document.getElementById('varios')
    };

    Object.values(divs).forEach(d => { if(d) d.innerHTML = ''; });

    sn.docs.forEach(docSnap => {
        const d = docSnap.data();
        if (d.disponible === false) return; 

        const html = `
            <div class="dish-item">
                <div class="dish-header" onclick="toggleDish(this)">
                    <div>
                        <h3>${d.nombre}</h3>
                        <p class="dish-desc-short">${d.descripcion || ''}</p>
                    </div>
                    <strong class="dish-price">$${Number(d.precio).toLocaleString()}</strong>
                </div>
                <div class="expand-content">
                    <input type="text" id="note-${docSnap.id}" class="note-input" placeholder="¿Nota especial?">
                    <button class="btn-add-cart" onclick="agregarAlCarrito('${d.nombre}', '${d.precio}', '${docSnap.id}')">AÑADIR AL PEDIDO</button>
                </div>
            </div>`;
        
        if (divs[d.categoria]) {
            divs[d.categoria].innerHTML += html;
        }
    });

    // Mensaje si una categoría está vacía
    Object.keys(divs).forEach(key => {
        if (divs[key] && divs[key].innerHTML === '') {
            divs[key].innerHTML = '<p class="empty-msg">No hay platos disponibles en esta sección.</p>';
        }
    });
});

// LOGICA DE PESTAÑAS
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
        // Quitar active de todos los botones
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        // Quitar active de todas las secciones
        document.querySelectorAll('.menu-section').forEach(s => s.classList.remove('active'));
        
        // Agregar active al actual
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-tab');
        const targetSection = document.getElementById(targetId);
        if(targetSection) targetSection.classList.add('active');
    };
});
