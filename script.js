import { db } from './firebase-config.js';
import { collection, addDoc, onSnapshot, doc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

let carrito = [];
const ICON_TRASH = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

// NUEVO: Efecto de sonido suave al agregar plato
const SOUND_ADD = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-hard-pop-click-2364.mp3');

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

// NUEVO: Control para subir/bajar cantidad en el menú
window.ajustarCant = (id, delta) => {
    const el = document.getElementById(`cant-${id}`);
    if(!el) return;
    let cant = parseInt(el.innerText) + delta;
    if(cant < 1) cant = 1; // Mínimo 1 plato
    el.innerText = cant;
};

window.agregarAlCarrito = (nombre, precio, id) => {
    // Obtenemos la cantidad que eligió el cliente
    const qtySpan = document.getElementById(`cant-${id}`);
    const cantidad = qtySpan ? parseInt(qtySpan.innerText) : 1;
    
    // Verificamos si ya está en el carrito
    const existeIndex = carrito.findIndex(i => i.nombre === nombre);
    if(existeIndex !== -1) {
        carrito[existeIndex].cantidad += cantidad; // Suma si ya existe
    } else {
        carrito.push({ nombre, precio: Number(precio), cantidad: cantidad, nota: "", id });
    }
    
    // Reiniciamos el contador visual del menú
    if(qtySpan) qtySpan.innerText = "1"; 
    
    // 🔊 Reproducir sonido
    SOUND_ADD.currentTime = 0;
    SOUND_ADD.play().catch(e => console.log('Audio no soportado:', e));

    // 📳 Animar carrito flotante
    const cartFab = document.querySelector('.cart-fab');
    if (cartFab) {
        cartFab.classList.remove('cart-bounce');
        void cartFab.offsetWidth; // Truco para reiniciar la animación
        cartFab.classList.add('cart-bounce');
    }
    
    actualizarCarrito();
};

window.actualizarNota = (index, valor) => {
    carrito[index].nota = valor;
};

function actualizarCarrito() {
    const cont = document.getElementById('cart-items');
    const priceEl = document.getElementById('cart-total-price');
    const countEl = document.getElementById('cart-count');
    
    // Contamos total real (incluyendo las multiplicaciones de cantidad)
    const totalItems = carrito.reduce((acc, item) => acc + item.cantidad, 0);
    if(countEl) countEl.innerText = totalItems;
    
    if(!cont) return;
    cont.innerHTML = '';
    let total = 0;
    
    carrito.forEach((item, i) => {
        total += (item.precio * item.cantidad);
        cont.innerHTML += `
        <div class="cart-item-row" style="flex-direction:column; align-items:stretch; gap:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="font-size:1.05rem;">${item.cantidad}x ${item.nombre}</strong>
                <div style="display:flex; align-items:center; gap:12px;">
                    <span style="color:#22c55e; font-weight:700;">$${(item.precio * item.cantidad).toLocaleString()}</span>
                    <button onclick="quitar(${i})" class="btn-remove-item" title="Eliminar plato">${ICON_TRASH}</button>
                </div>
            </div>
            <textarea class="cart-note-input" placeholder="Ej: Si son varias: 1 sin queso, 2 con salsas separadas..." onchange="actualizarNota(${i}, this.value)">${item.nota}</textarea>
        </div>`;
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

    if (!cliente || carrito.length === 0) { 
        btn.innerHTML = "Faltan datos ⚠️"; 
        setTimeout(() => btn.innerHTML = textoOriginal, 2000); 
        return; 
    }

    const total = carrito.reduce((s, x) => s + (x.precio * x.cantidad), 0);
    
    // Lógica para que las estadísticas del Panel de Administrador sigan exactas
    let itemsParaEnviar = [];
    carrito.forEach(item => {
        // Desglosamos los platos múltiples en líneas independientes (Para el Administrador)
        for(let k = 0; k < item.cantidad; k++) {
            itemsParaEnviar.push({
                nombre: item.nombre,
                precio: item.precio, // Precio individual, el backend lo suma correctamente
                // Asignamos la nota de grupo solo a la primera línea para que el chef lo lea una vez
                nota: k === 0 ? item.nota : "" 
            });
        }
    });

    try {
        btn.innerHTML = "Enviando... ⏳";
        const docRef = await addDoc(collection(db, "pedidos"), { 
            cliente, 
            tipo, 
            items: itemsParaEnviar, 
            total, 
            estado: "pendiente", 
            timestamp: serverTimestamp() 
        });
        
        if (quiereWA) {
            window.open(`https://wa.me/573210000000?text=*PEDIDO IKU*%0A*Cliente:* ${cliente}%0A*Total:* $${total.toLocaleString()}`);
        }
        
        btn.innerHTML = "¡Pedido enviado! ✅";
        setTimeout(() => {
            carrito = []; 
            actualizarCarrito();
            window.toggleCart(); 
            btn.innerHTML = textoOriginal;
            iniciarTracker(docRef.id);
        }, 1500);
    } catch (e) { 
        btn.innerHTML = "Error ❌"; 
    }
};

window.iniciarTracker = (id) => {
    document.getElementById('tracker-modal').classList.add('open');
    onSnapshot(doc(db, "pedidos", id), (docSnap) => {
        if(docSnap.exists()) {
            const p = docSnap.data();
            const tit = document.getElementById('tracker-status');
            const desc = document.getElementById('tracker-desc');
            const icn = document.getElementById('tracker-icon');
            if(p.estado === 'preparando') {
                tit.innerText = "Preparando";
                desc.innerText = "¡Tu pedido ya está en la cocina y lo estamos preparando!";
                icn.innerText = "🍳";
                icn.style.animation = "shakeCart 1s infinite alternate";
            } else if (p.estado === 'listo') {
                tit.innerText = "¡Pedido Listo!";
                desc.innerText = "Tu pedido está listo para ser entregado.";
                icn.innerText = "✅";
                icn.style.animation = "none";
                setTimeout(() => window.cerrarTracker(), 5000);
            }
        }
    });
};

// --- Renderizado de Menú Frontend ---
const sDiario = document.getElementById('diario');
const sRapida = document.getElementById('rapida');
const sVarios = document.getElementById('varios');

onSnapshot(collection(db, "platos"), (snapshot) => {
    const l = document.getElementById('loader');
    if(l) l.style.display = 'none';
    sDiario.innerHTML = ''; sRapida.innerHTML = ''; sVarios.innerHTML = '';
    
    snapshot.docs.forEach(docSnap => {
        const d = docSnap.data();
        if(d.disponible === false) return;

        let ingredientesHTML = '';
        if (d.ingredientes && d.ingredientes.length > 0) {
            ingredientesHTML = `<div class="ing-container">
                ${d.ingredientes.map(i => `<span class="ing-pill">${i}</span>`).join('')}
            </div>`;
        }

        const html = `
        <div class="dish-item">
            <div class="dish-header" onclick="toggleDish(this)">
                <div>
                    <h3>${d.nombre}</h3>
                    <p>${d.descripcion || ''}</p>
                    ${ingredientesHTML}
                </div>
                <strong class="dish-price">$${Number(d.precio).toLocaleString()}</strong>
            </div>
            <div class="expand-content">
                <div class="qty-wrapper">
                    <span class="qty-label">Cantidad:</span>
                    <div class="qty-control">
                        <button onclick="ajustarCant('${docSnap.id}', -1)" class="btn-qty">-</button>
                        <span id="cant-${docSnap.id}" class="qty-num">1</span>
                        <button onclick="ajustarCant('${docSnap.id}', 1)" class="btn-qty">+</button>
                    </div>
                </div>
                <button class="btn-add-cart" onclick="agregarAlCarrito('${d.nombre}', '${d.precio}', '${docSnap.id}')">AÑADIR AL PEDIDO</button>
            </div>
        </div>`;
        
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
        const s = document.getElementById(btn.dataset.tab);
        if(s) { s.classList.add('active'); s.style.display = 'block'; }
    };
});
