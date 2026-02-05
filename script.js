// --- FIREBASE CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyDbNRvlCOOP-JObYpLTFHzFQfld7nuEmzw",
    authDomain: "uniquehuntz-telugu-memes.firebaseapp.com",
    projectId: "uniquehuntz-telugu-memes",
    storageBucket: "uniquehuntz-telugu-memes.appspot.com",
    messagingSenderId: "353299095115",
    appId: "1:353299095115:web:b5c6e41e019237b15037ce"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();
const auth = firebase.auth(); // Added Auth Service

let isAdmin = false;

// --- GOOGLE/EMAIL AUTH LOGIC ---
// This listens for login/logout changes automatically
auth.onAuthStateChanged((user) => {
    if (user) {
        isAdmin = true;
        document.getElementById('logged-out-view').style.display = 'none';
        document.getElementById('logged-in-view').style.display = 'block';
        console.log("Logged in as:", user.email);
    } else {
        isAdmin = false;
        document.getElementById('logged-out-view').style.display = 'block';
        document.getElementById('logged-in-view').style.display = 'none';
    }
    renderMemes(); // Refresh memes to show/hide delete buttons
});

async function manualLogin() {
    const email = document.getElementById('adminUser').value; // Enter your Email
    const pass = document.getElementById('adminPass').value; // Enter your Password

    try {
        await auth.signInWithEmailAndPassword(email, pass);
        showAlert("Welcome back, Admin!");
    } catch (error) {
        showAlert("Login Failed: " + error.message);
    }
}

async function manualLogout() {
    try {
        await auth.signOut();
        showAlert("Warehouse Locked.");
    } catch (error) {
        showAlert("Logout failed.");
    }
}

// --- NAVIGATION ---
function switchPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    document.getElementById(`${pageId}-page`).style.display = 'block';
    const navId = pageId === 'feed' ? 'home' : pageId;
    document.getElementById(`nav-${navId}`).classList.add('active');
    
    if(pageId === 'feed') renderMemes();
    if(pageId === 'library') loadArtistFolders();
}

// --- CORE RENDERING ---
async function renderMemes(filter = "All", btn = null) {
    if(btn) updateChips(btn);
    const grid = (document.getElementById('library-page').style.display === 'block') 
                 ? document.getElementById('libraryResults') : document.getElementById('memeGrid');
    
    if(!grid) return;
    grid.innerHTML = "<p style='text-align:center; grid-column:1/-1;'>Hunting Templates...</p>";
    
    try {
        const snapshot = await db.collection("memes").orderBy("timestamp", "desc").get();
        grid.innerHTML = "";
        snapshot.forEach(doc => {
            const m = doc.data();
            if (filter !== "All" && m.artist !== filter) return;
            grid.innerHTML += createCard(doc.id, m);
        });
    } catch(e) { grid.innerHTML = "Error loading Warehouse."; }
}

function createCard(id, m) {
    let deleteBtn = "";
    // Only show delete button if Firebase confirms you are logged in
    if (isAdmin) {
        deleteBtn = `<button onclick="deleteMeme('${id}', '${m.storagePath}')" style="background:#ff4757; color:white; border:none; width:100%; padding:8px; margin-top:8px; border-radius:8px; font-weight:bold; cursor:pointer;">🗑️ DELETE</button>`;
    }

    return `
        <div class="meme-card" data-tags="${m.tags}">
            <div class="card-media">${m.type === 'video' ? '🎬' : m.type === 'audio' ? '🎵' : '🖼️'}</div>
            <div class="card-info">
                <h3>${m.title}</h3>
                <button class="btn-download" onclick="window.open('${m.url}')">GET</button>
                ${deleteBtn}
            </div>
            <div class="card-engagement">
                <button class="engage-btn" onclick="handleLike('${id}')">❤️ <span id="l-${id}">${m.likes || 0}</span></button>
                <button class="engage-btn" onclick="shareWA('${m.url}')">🔗 Share</button>
            </div>
        </div>`;
}

// --- UPLOAD, LIKE & DELETE ---
async function handleLike(id) {
    await db.collection("memes").doc(id).update({ 
        likes: firebase.firestore.FieldValue.increment(1) 
    });
    const l = document.getElementById(`l-${id}`);
    if(l) l.innerText = parseInt(l.innerText) + 1;
}

async function deleteMeme(id, path) {
    if(confirm("Admin: Delete this template forever?")) {
        try {
            await db.collection("memes").doc(id).delete();
            if(path) await storage.ref(path).delete();
            showAlert("Deleted!");
            renderMemes();
        } catch(e) { showAlert("Delete failed."); }
    }
}

async function processAndUpload() {
    const btn = document.getElementById('uploadBtn');
    const artist = document.getElementById('memeArtist').value || "Legend";
    const title = document.getElementById('memeTitle').value;
    const file = document.getElementById('fileInput').files[0];

    if(!title || !file) return showAlert("Missing title or file!");

    btn.disabled = true; btn.innerText = "Securing...";
    const path = `templates/${Date.now()}_${title}`;
    
    try {
        const snap = await storage.ref(path).put(file);
        const url = await snap.ref.getDownloadURL();

        await db.collection("memes").add({
            title, artist, url, storagePath: path, likes: 0,
            type: document.getElementById('memeType').value,
            tags: (title + " " + artist + " " + document.getElementById('memeTags').value).toLowerCase(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        showAlert("Added to Warehouse!");
        switchPage('feed');
    } catch(e) { showAlert("Upload Failed!"); }
    finally { btn.disabled = false; btn.innerText = "Secure to Warehouse"; }
}

// --- UTILS ---
function filterMemes() {
    let q = document.getElementById('searchInput').value.toLowerCase();
    document.querySelectorAll('.meme-card').forEach(c => {
        const tags = c.getAttribute('data-tags') || "";
        c.style.display = tags.includes(q) ? "block" : "none";
    });
}

function loadArtistFolders() {
    db.collection("memes").get().then(snap => {
        const grid = document.getElementById('artistFolderGrid');
        if(!grid) return;
        const artists = new Set();
        snap.forEach(doc => { if(doc.data().artist) artists.add(doc.data().artist); });
        grid.innerHTML = "";
        artists.forEach(a => {
            grid.innerHTML += `<div class="folder-card" onclick="renderMemes('${a}')">👤<br><span>${a}</span></div>`;
        });
    });
}

function updateChips(btn) { 
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active')); 
    btn.classList.add('active'); 
}

function showAlert(m) { 
    document.getElementById('alertMessage').innerText = m; 
    document.getElementById('customAlert').style.display = 'flex'; 
}

function closeAlert() { document.getElementById('customAlert').style.display = 'none'; }
function shareWA(url) { window.open(`https://wa.me/?text=${encodeURIComponent(url)}`); }

window.onload = () => renderMemes();
