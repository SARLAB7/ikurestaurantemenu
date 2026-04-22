import { db } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

const tabs = document.querySelectorAll('.tab-btn');
const sections = document.querySelectorAll('.menu-section');

tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
        const target = e.target.getAttribute('data-tab');
        tabs.forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        sections.forEach(sec => {
            sec.classList.remove('active');
            if (sec.id === target) sec.classList.add('active');
        });
    });
});

const renderMenu = () => {
    const q = query(collection(db, "platos"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snapshot) => {
        const categories = { diario: '', rapida: '', varios: '' };
        document.getElementById('loader').style.display = 'none';

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const formattedPrice = new Intl.NumberFormat('es-CO', {
                style: 'currency', currency: 'COP', minimumFractionDigits: 0
            }).format(data.precio);

            const dishHTML = `
                <div class="dish-item" onclick="this.classList.toggle('expanded')">
                    <div class="dish-header">
                        <h3>${data.nombre}</h3>
                        <span class="price">${formattedPrice}</span>
                    </div>
                    <p class="description">${data.descripcion || ''}</p>
                </div>
            `;
            if (categories[data.categoria] !== undefined) categories[data.categoria] += dishHTML;
        });

        Object.keys(categories).forEach(cat => {
            document.getElementById(cat).innerHTML = categories[cat] || '<p style="text-align:center; color:#999;">Próximamente...</p>';
        });
    });
};

renderMenu();
