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

// Función para abrir/cerrar platos usando las clases de tu CSS
window.toggleDish = (header) => {
    const item = header.parentElement;
    const isActive = item.classList.contains('active');
    
    // Cerramos cualquier otro plato abierto
    document.querySelectorAll('.dish-item').forEach(i => i.classList.remove('active'));

    // Si no estaba activo, lo activamos
    if (!isActive) {
        item.classList.add('active');
    }
};

// --- ESCUCHA DEL MENÚ (FIRESTORE) ---
const sDiario = document.getElementById('diario');
const sRapida = document.getElementById('rapida');
const sVarios = document.getElementById('varios');

onSnapshot(query(collection(db, "platos"), orderBy("timestamp", "desc")), (sn) => {
    if(sDiario) sDiario.innerHTML = ''; 
    if(sRapida) sRapida.innerHTML = ''; 
    if(sVarios) sVarios.innerHTML = '';
    
    if(document.getElementById('loader')) {
        document.getElementById('loader').style.display = 'none';
    }

    sn.docs.forEach(docSnap => {
        const d = docSnap.data();
        if (d.disponible === false) return;

        // Formatear ingredientes como etiquetas
        let ingredientesHTML = '';
        if (d.ingredientes && Array.isArray(d.ingredientes) && d.ingredientes.length > 0) {
            ingredientesHTML = `<div class="ing-container" style="display:flex; flex-wrap:wrap; gap:5px; margin-top:10px;">
                ${d.ingredientes.map(ing => ing ? `<span class="ing-pill" style="background:#e2e8f0; padding:2px 8px; border-radius:12px; font-size:0.7rem; color:#475569; border:1px solid #cbd5e1;">${ing}</span>` : '').join('')}
            </div>`;
        }

        const html = `
            <div class="dish-item">
                <div class="dish-header" onclick="toggleDish(this)">
                    <div style="flex:1;">
                        <h3 style="margin:0;">${d.nombre}</h3>
                        <p style="margin:5px 0; font-size:0.9rem; color:var(--text-muted);">${d.descripcion || ''}</p>
                        ${ingredientesHTML}
                    </div>
                    <strong class="dish-price">$${Number(d.precio).toLocaleString()}</strong>
                </div>
                <div class="expand-content">
                    <div class="note-container" style="margin-bottom:15px;">
                        <label style="font-size:0.8rem; font-weight:600; display:block; margin-bottom:5px;">¿Alguna nota especial?</label>
                        <input type="text" id="note-${docSnap.id}" class="note-input" placeholder="Ej: Sin cebolla, término medio..." style="width:100%;">
                    </div>
                    <button class="btn-add-cart" onclick="agregarAlCarrito('${d.nombre}', '${d.precio}', '${docSnap.id}')">
                        AÑADIR AL PEDIDO
                    </button>
                </div>
            </div>`;

        if (d.categoria === 'diario') sDiario.innerHTML += html;
        else if (d.categoria === 'rapida') sRapida.innerHTML += html;
        else if (d.categoria === 'varios') sVarios.innerHTML += html;
    });
});

// --- LÓGICA DEL CARRITO ---
window.agregarAlCarrito = (nombre, precio, id) => {
    const notaInput = document.getElementById(`note-${id}`);
    const nota = notaInput ? notaInput.value : '';
    
    carrito.push({ 
        nombre, 
        precio: Number(precio), 
        nota, 
        id 
    });
    
    actualizarInterfazCarrito();
    if(notaInput) notaInput.value = '';
    
    // Feedback visual y cerrar el plato
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = "✓ AGREGADO";
    btn.style.background = "var(--success)";
    
    setTimeout(() => {
        btn.innerText = originalText;
        btn.style.background = ""; // Vuelve al color del CSS
        document.querySelectorAll('.dish-item').forEach(i => i.classList.remove('active'));
    }, 800);
};

function actualizarInterfazCarrito() {
    const count = document.getElementById('cart-count');
    const totalElement = document.getElementById('cart-total-btn');
    if(count) count.innerText = carrito.length;
    
    const total = carrito.reduce((sum, item) => sum + item.precio, 0);
    if(totalElement) totalElement.innerText = `$${total.toLocaleString()}`;
    
    renderizarListaCarrito();
}

function renderizarListaCarrito() {
    const lista = document.getElementById('cart-items-list');
    if(!lista) return;
    lista.innerHTML = '';

    carrito.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <div style="flex:1">
                <strong>${item.nombre}</strong>
                <p style="font-size:0.8rem; color:var(--text-muted); margin:0;">${item.nota ? '📝 ' + item.nota : 'Sin notas'}</p>
            </div>
            <div style="text-align:right">
                <span style="display:block; font-weight:bold;">$${item.precio.toLocaleString()}</span>
                <button onclick="eliminarDelCarrito(${index})" style="background:none; border:none; color:var(--danger); cursor:pointer; padding:5px;">${ICON_TRASH}</button>
            </div>
        `;
        lista.appendChild(div);
    });
}

window.eliminarDelCarrito = (index) => {
    carrito.splice(index, 1);
    actualizarInterfazCarrito();
};

window.abrirCarrito = () => {
    document.getElementById('cart-modal').classList.add('active');
};

window.cerrarCarrito = () => {
    document.getElementById('cart-modal').classList.remove('active');
};

window.enviarPedido = async () => {
    if (carrito.length === 0) return alert("Tu carrito está vacío");

    const nombreCliente = document.getElementById('nombre-cliente').value;
    const tipoServicio = document.getElementById('tipo-servicio').value;

    if (!nombreCliente) return alert("Por favor ingresa tu nombre o número de mesa");

    const pedido = {
        cliente: nombreCliente,
        tipo: tipoServicio,
        items: carrito,
        total: carrito.reduce((sum, i) => sum + i.precio, 0),
        estado: 'pendiente',
        timestamp: serverTimestamp()
    };

    try {
        await addDoc(collection(db, "pedidos"), pedido);
        
        if(document.getElementById('check-whatsapp')?.checked) {
            enviarWhatsApp(pedido);
        }

        carrito = [];
        actualizarInterfazCarrito();
        cerrarCarrito();
        abrirTracker();
    } catch (e) {
        console.error("Error al enviar pedido: ", e);
        alert("Hubo un error al procesar tu pedido. Intenta de nuevo.");
    }
};

function enviarWhatsApp(p) {
    let msg = `*NUEVO PEDIDO - IKU*%0A---%0A*Cliente:* ${p.cliente}%0A*Tipo:* ${p.tipo}%0A---%0A`;
    p.items.forEach(i => {
        msg += `• ${i.nombre} ($${i.precio.toLocaleString()})${i.nota ? ' _Nota: ' + i.nota + '_' : ''}%0A`;
    });
    msg += `---%0A*TOTAL: $${p.total.toLocaleString()}*`;
    // Aquí puedes poner el número de WhatsApp de IKU
    window.open(`https://wa.me/573000000000?text=${msg}`, '_blank');
}

window.abrirTracker = () => {
    document.getElementById('tracker-modal').classList.add('active');
};

window.cerrarTracker = () => {
    document.getElementById('tracker-modal').classList.remove('active');
};

// Control de pestañas (Menú del día, Comidas rápidas, etc)
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.menu-section').forEach(s => { 
            s.classList.remove('active'); 
            s.style.display = 'none'; 
        });
        
        btn.classList.add('active');
        const target = document.getElementById(btn.dataset.tab);
        if(target) {
            target.classList.add('active');
            target.style.display = 'block';
        }
    };
});
