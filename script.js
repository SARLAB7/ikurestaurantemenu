import { db } from './firebase-config.js';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

let carrito = [];

const toastDiv = document.createElement('div');
toastDiv.id = 'toast';
document.body.appendChild(toastDiv);

const mostrarNotificacion = (msj) => {
    toastDiv.innerText = msj;
    toastDiv.classList.add("show");
    setTimeout(() => toastDiv.classList.remove("show"), 3000);
};

window.toggleDish = (header) => {
    const dish = header.parentElement;
    const isOpened = dish.classList.contains('expanded');
    document.querySelectorAll('.dish-item').forEach(i => i.classList.remove('expanded'));
    if (!isOpened) dish.classList.add('expanded');
};

window.toggleCart = () => document.getElementById('cart-modal').classList.toggle('open');

window.agregarAlCarrito = (nombre, precio, id) => {
    const nota = document.getElementById(`note-${id}`)?.value || "";
    carrito.push({ nombre, precio: parseInt(precio), nota });
    if(document.getElementById(`note-${id}`)) document.getElementById(`note-${id}`).value = '';
    actualizarCarrito();
    mostrarNotificacion(`Añadido: ${nombre} 🛒`);
};

function actualizarCarrito() {
    const cont = document.getElementById('cart-items');
    const priceEl = document.getElementById('cart-total-price');
    document.getElementById('cart-count').innerText = carrito.length;
    
    if(!cont) return;
    cont.innerHTML = '';
    let total = 0;
    
    carrito.forEach((item, i) => {
        total += item.precio;
        cont.innerHTML += `
            <div style="border-bottom:1px solid #eee; padding:15px 0;">
                <div style="display:flex; justify-content:space-between;">
                    <strong>${item.nombre}</strong> 
                    <span>$${item.precio.toLocaleString()}</span>
                </div>
                ${item.nota ? `<p style="font-size:0.8rem; color:#666; font-style:italic;">Nota: ${item.nota}</p>` : ''}
                <button onclick="quitar(${i})" style="color:red; background:none; border:none; cursor:pointer; font-size:0.8rem; margin-top:5px;">Quitar</button>
            </div>`;
    });
    priceEl.innerText = `$${total.toLocaleString()}`;
}

window.quitar = (i) => { carrito.splice(i, 1); actualizarCarrito(); };

window.enviarPedido = async () => {
    const cliente = document.getElementById('nombre-cliente')?.value;
    const tipo = document.getElementById('tipo-servicio')?.value;
    if (!cliente || carrito.length === 0) return alert("Completa tus datos.");

    const total = carrito.reduce((s, x) => s + x.precio, 0);
    try {
        await addDoc(collection(db, "pedidos"), {
            cliente, tipo, items: carrito, total, estado: "pendiente", timestamp: serverTimestamp()
        });
        if (document.getElementById('check-whatsapp').checked) {
            const msjWA = `*NUEVO PEDIDO IKU*%0A*Cliente:* ${cliente}%0A*Items:*%0A${carrito.map(i => `- ${i.nombre}`).join('%0A')}%0A*Total:* $${total.toLocaleString()}`;
            window.open(`https://wa.me/573210000000?text=${msjWA}`);
        }
        mostrarNotificacion("¡Pedido enviado! 🧑‍🍳");
        carrito = []; actualizarCarrito(); window.toggleCart();
    } catch (e) { alert("Error"); }
};

onSnapshot(query(collection(db, "platos"), orderBy("timestamp", "desc")), (sn) => {
    const sections = { diario: document.getElementById('diario'), rapida: document.getElementById('rapida'), varios: document.getElementById('varios') };
    Object.values(sections).forEach(s => { if(s) s.innerHTML = ''; });
    document.getElementById('loader').style.display = 'none';

    sn.docs.forEach(docSnap => {
        const d = docSnap.data();
        if (d.disponible === false) return;

        // LOGICA DE INGREDIENTES MEJORADA
        let listaIng = Array.isArray(d.ingredientes) ? d.ingredientes : (d.ingredientes ? d.ingredientes.split(',') : []);
        let ingHTML = '';
        
        // Solo creamos el contenedor si hay ingredientes reales
        if (listaIng.length > 0 && listaIng[0].trim() !== "") {
            ingHTML = `
                <div class="ing-container">
                    ${listaIng.map(ing => ing.trim() ? `<span class="ing-pill">${ing.trim()}</span>` : '').join('')}
                </div>`;
        }

        const html = `
            <div class="dish-item">
                <div class="dish-header" onclick="toggleDish(this)">
                    <div>
                        <h3>${d.nombre}</h3>
                        <p class="dish-desc">${d.descripcion || ''}</p>
                    </div>
                    <strong class="dish-price">$${Number(d.precio).toLocaleString()}</strong>
                </div>
                <div class="expand-content">
                    ${ingHTML}
                    <input type="text" id="note-${docSnap.id}" class="note-input" placeholder="¿Nota especial? (Ej: sin cebolla)">
                    <button class="btn-add-cart" onclick="agregarAlCarrito('${d.nombre}', '${d.precio}', '${docSnap.id}')">AÑADIR AL PEDIDO</button>
                </div>
            </div>`;
        if (sections[d.categoria]) sections[d.categoria].innerHTML += html;
    });
});

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.menu-section').forEach(s => s.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    };
});
