import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

// ... (Mantén tu lógica de login y gestión de platos igual) ...

function escucharPedidos() {
    const q = query(collection(db, "pedidos"), orderBy("timestamp", "desc"));
    
    onSnapshot(q, (snapshot) => {
        const contenedor = document.getElementById('lista-pedidos-realtime');
        contenedor.innerHTML = '';

        if (snapshot.empty) {
            contenedor.innerHTML = '<p style="text-align:center; color:#999;">No hay pedidos pendientes.</p>';
            return;
        }

        snapshot.docs.forEach(pedidoDoc => {
            const pedido = pedidoDoc.data();
            const id = pedidoDoc.id;
            
            // Crear la tarjeta del pedido
            const card = document.createElement('div');
            card.style = `background: #fdfdfd; border-left: 8px solid ${pedido.estado === 'pendiente' ? '#ffcc00' : '#28a745'}; padding: 15px; margin-bottom: 15px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); color: #333;`;
            
            let itemsHTML = pedido.items.map(item => `<li><strong>${item.nombre}</strong> ${item.nota ? `<br><small>📝 ${item.nota}</small>` : ''}</li>`).join('');

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <div>
                        <h4 style="margin:0; color:#1a1a1a;">👤 ${pedido.cliente}</h4>
                        <small>${pedido.timestamp?.toDate().toLocaleTimeString() || 'Recién'}</small>
                    </div>
                    <strong style="font-size:1.1rem;">$${pedido.total}</strong>
                </div>
                <ul style="margin: 10px 0; padding-left: 20px; font-size: 0.9rem;">${itemsHTML}</ul>
                <div style="display:flex; gap:10px; margin-top:10px;">
                    <button onclick="completarPedido('${id}')" style="flex:1; background:#28a745; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer;">Completado</button>
                    <button onclick="eliminarPedido('${id}')" style="background:#dc3545; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer;">Eliminar</button>
                </div>
            `;
            contenedor.appendChild(card);
        });
    });
}

// Funciones globales para botones
window.completarPedido = async (id) => {
    await updateDoc(doc(db, "pedidos", id), { estado: "completado" });
};

window.eliminarPedido = async (id) => {
    if(confirm("¿Eliminar este pedido de la lista?")) {
        await deleteDoc(doc(db, "pedidos", id));
    }
};

// Llama a escucharPedidos() dentro de tu onAuthStateChanged cuando el usuario sea válido
