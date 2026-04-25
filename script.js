/* =========================================
   LÓGICA DEL MENÚ CLIENTE - IKU PUEBLO BELLO
   ========================================= */
import { db } from './firebase-config.js';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

let carrito = [];

// --- 1. NOTIFICACIÓN FLOTANTE (TOAST) ---
const toastDiv = document.createElement('div');
toastDiv.id = 'toast';
document.body.appendChild(toastDiv);

const mostrarNotificacion = (mensaje) => {
    toastDiv.innerText = mensaje;
    toastDiv.classList.add("show");
    setTimeout(() => { toastDiv.classList.remove("show"); }, 3000);
};

// --- 2. CARRITO Y PEDIDOS ---
window.toggleCart = () => document.getElementById('cart-modal').classList.toggle('open');

window.agregarAlCarrito = (nombre, precio, id) => {
    const nota = document.getElementById(`note-${id}`).value;
    carrito.push({ nombre, precio: parseInt(precio), nota });
    document.getElementById(`note-${id}`).value = '';
    actualizarCarrito();
    
    // Notificación sutil
    mostrarNotificacion(`Añadido: ${nombre} 🛒`); 
};

function actualizarCarrito() {
    const cont = document.getElementById('cart-items');
    document.getElementById('cart-count').innerText = carrito.length;
    cont.innerHTML = '';
    let total = 0;
    
    carrito.forEach((item, i) => {
        total += item.precio;
        cont.innerHTML += `
            <div style="border-bottom:1px solid #eee; padding:15px 0;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong>${item.nombre}</strong> 
                    <span>$${item.precio}</span>
                </div>
                ${item.nota ? `<p style="font-size:0.8rem; color:#666; margin-top:5px; font-style:italic;">Nota: ${item.nota}</p>` : ''}
                <button onclick="quitar(${i})" style="color:#dc3545; background:none; border:none; cursor:pointer; font-size:0.8rem; margin-top:8px; font-weight:bold;">Quitar del carrito</button>
            </div>`;
    });
    
    document.getElementById('cart-total-price').innerText = new Intl.NumberFormat('es-CO', {
        style: 'currency', currency: 'COP', minimumFractionDigits: 0
    }).format(total);
}

window.quitar = (i) => { carrito.splice(i, 1); actualizarCarrito(); };

window.enviarPedido = async () => {
    const mesa = prompt("Ingresa tu Nombre o Número de Mesa para enviar el pedido:");
    if (!mesa || carrito.length === 0) return;
    
    try {
        await addDoc(collection(db, "pedidos"), {
            cliente: mesa,
            items: carrito,
            total: carrito.reduce((s, x) => s + x.precio, 0),
            estado: "pendiente",
            timestamp: serverTimestamp()
        });
        
        mostrarNotificacion("¡Tu pedido estará listo muy pronto! 🧑‍🍳"); 
        
        carrito = [];
        actualizarCarrito();
        toggleCart();
    } catch (e) { 
        mostrarNotificacion("Error al enviar. Intenta de nuevo."); 
    }
};

// --- 3. RENDERIZADO DEL MENÚ DESDE FIREBASE ---
const renderMenu = () => {
    const q = query(collection(db, "platos"), orderBy("timestamp", "desc"));
    
    onSnapshot(q, (sn) => {
        const cats = { diario: '', rapida: '', varios: '' };
        document.getElementById('loader').style.display = 'none';
        
        sn.docs.forEach(doc => {
            const d = doc.data();
            const precioFormateado = new Intl.NumberFormat('es-CO', {
                style: 'currency', currency: 'COP', minimumFractionDigits: 0
            }).format(d.precio);

            const html = `
                <div class="dish-item">
                    <div class="dish-header" onclick="this.parentElement.classList.toggle('expanded')">
                        <h3>${d.nombre}</h3> 
                        <strong class="price">${precioFormateado}</strong>
                    </div>
                    <div class="expand-content">
                        <p class="description">${d.descripcion || ''}</p>
                        
                        <div class="ingredients-box">
                            <span class="ing-label">INGREDIENTES:</span>
                            <p class="ing-list">${d.ingredientes ? d.ingredientes.join(' • ') : 'Consultar con el personal'}</p>
                        </div>

                        <div class="order-controls">
                            <input type="text" id="note-${doc.id}" class="note-input" placeholder="Personaliza tu plato (ej: sin salsas)">
                            <button class="btn-add-cart" onclick="agregarAlCarrito('${d.nombre}', '${d.precio}', '${doc.id}')">PEDIR ESTE PLATO</button>
                        </div>
                    </div>
                </div>`;
            
            if (cats[d.categoria] !== undefined) {
                cats[d.categoria] += html;
            }
        });
        
        ['diario','rapida','varios'].forEach(c => document.getElementById(c).innerHTML = cats[c] || '<p style="text-align:center; color:#999; padding:20px;">Próximamente más delicias...</p>');
    });
};

renderMenu();

// --- 4. LÓGICA DE PESTAÑAS (TABS) ---
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.menu-section').forEach(s => s.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    };
});
