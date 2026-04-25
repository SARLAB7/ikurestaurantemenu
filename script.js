import { db } from './firebase-config.js';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

let carrito = [];
const toastDiv = document.createElement('div'); toastDiv.id = 'toast'; document.body.appendChild(toastDiv);

const mostrarNotificacion = (m) => { 
    toastDiv.innerText = m; 
    toastDiv.classList.add("show"); 
    setTimeout(() => { toastDiv.classList.remove("show"); }, 3000); 
};

window.toggleDish = (header) => {
    const dish = header.parentElement;
    const isOpened = dish.classList.contains('expanded');
    document.querySelectorAll('.dish-item').forEach(i => i.classList.remove('expanded'));
    if (!isOpened) dish.classList.add('expanded');
};

window.toggleCart = () => document.getElementById('cart-modal').classList.toggle('open');

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
    document.getElementById('cart-count').innerText = carrito.length;
    if(!cont) return;
    cont.innerHTML = '';
    let total = 0;
    carrito.forEach((item, i) => {
        total += item.precio;
        cont.innerHTML += `<div style="border-bottom:1px solid #eee; padding:15px 0;"><div style="display:flex; justify-content:space-between;"><strong>${item.nombre}</strong> <span>$${item.precio}</span></div>${item.nota ? `<p style="font-size:0.8rem; color:#666;">Nota: ${item.nota}</p>` : ''}<button onclick="quitar(${i})" style="color:red; background:none; border:none; cursor:pointer; font-size:0.8rem;">Quitar</button></div>`;
    });
    document.getElementById('cart-total-price').innerText = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(total);
}

window.quitar = (i) => { carrito.splice(i, 1); actualizarCarrito(); };

window.enviarPedido = async () => {
    const mesaDireccion = document.getElementById('nombre-cliente').value;
    const tipoServicio = document.getElementById('tipo-servicio').value;
    const quiereWhatsApp = document.getElementById('check-whatsapp').checked;
    if (!mesaDireccion || carrito.length === 0) { alert("Completa tus datos"); return; }
    const total = carrito.reduce((s, x) => s + x.precio, 0);
    try {
        await addDoc(collection(db, "pedidos"), { cliente: mesaDireccion, tipo: tipoServicio, items: carrito, total: total, estado: "pendiente", timestamp: serverTimestamp() });
        if (quiereWhatsApp) {
            const textoWA = `*IKU*%0A*Ubicación:* ${mesaDireccion}%0A*Items:*%0A${carrito.map(i => `- ${i.nombre}`).join('%0A')}%0A*Total:* $${total}`;
            window.open(`https://wa.me/573210000000?text=${textoWA}`); // Reemplaza con tu número
        }
        mostrarNotificacion("¡Pedido enviado! 🧑‍🍳"); 
        carrito = []; actualizarCarrito(); window.toggleCart();
    } catch (e) { mostrarNotificacion("Error al enviar."); }
};

// --- RENDERIZADO CORREGIDO ---
onSnapshot(query(collection(db, "platos"), orderBy("timestamp", "desc")), (sn) => {
    // Reiniciamos los contenedores de texto
    const cats = { diario: '', rapida: '', varios: '' };
    const loader = document.getElementById('loader');
    if(loader) loader.style.display = 'none';

    sn.docs.forEach(doc => {
        const d = doc.data();
        if (d.disponible === false) return;

        const html = `
            <div class="dish-item">
                <div class="dish-header" onclick="toggleDish(this)">
                    <h3>${d.nombre}</h3> <strong>$${d.precio}</strong>
                </div>
                <div class="expand-content">
                    <p style="font-size:0.9rem; color:#555; margin-bottom:10px;">${d.descripcion || ''}</p>
                    <input type="text" id="note-${doc.id}" class="note-input" placeholder="¿Alguna nota?">
                    <button class="btn-add-cart" onclick="agregarAlCarrito('${d.nombre}', '${d.precio}', '${doc.id}')">AÑADIR</button>
                </div>
            </div>`;
        
        // Asignación estricta a la categoría
        if (d.categoria === 'diario') cats.diario += html;
        else if (d.categoria === 'rapida') cats.rapida += html;
        else if (d.categoria === 'varios') cats.varios += html;
    });

    // Inyectamos en el DOM
    document.getElementById('diario').innerHTML = cats.diario || '<p style="text-align:center; padding:20px; color:#999;">No hay platos hoy.</p>';
    document.getElementById('rapida').innerHTML = cats.rapida || '<p style="text-align:center; padding:20px; color:#999;">No hay platos disponibles.</p>';
    document.getElementById('varios').innerHTML = cats.varios || '<p style="text-align:center; padding:20px; color:#999;">Próximamente...</p>';
});

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.menu-section').forEach(s => s.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    };
});
