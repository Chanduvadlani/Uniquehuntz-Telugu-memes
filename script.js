const firebaseConfig = {
  apiKey: "AIzaSyDbNRvlCOOP-JObYpLTFHzFQ...", 
  authDomain: "uniquehuntz-telugu-memes.firebaseapp.com",
  projectId: "uniquehuntz-telugu-memes",
  storageBucket: "uniquehuntz-telugu-memes.appspot.com",
  messagingSenderId: "353299095115",
  appId: "1:353299095115:web:b5c6e41e019237b15037ce"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

let currentUser = null;

// Auth Observer - Handles UI switching inside the Profile Tab
auth.onAuthStateChanged(user => {
    const loView = document.getElementById('logged-out-view');
    const liView = document.getElementById('logged-in-view');

    if (user) {
        currentUser = user;
        // Update Profile Tab UI
        if(loView) loView.style.display = 'none';
        if(liView) {
            liView.style.display = 'block';
            document.getElementById('profile-pic').src = user.photoURL;
            document.getElementById('profile-name').innerText = user.displayName;
            document.getElementById('profile-email').innerText = user.email;
        }
        fetchUserStats();
    } else {
        currentUser = null;
        // Reset Profile Tab UI
        if(loView) loView.style.display = 'block';
        if(liView) liView.style.display = 'none';
    }
});

async function login() { 
    await auth.signInWithPopup(provider)
        .then(() => showAlert("Welcome to the Warehouse!"))
        .catch(e => showAlert("Login Failed")); 
}

async function logout() { 
    if(confirm("Logout from UniqueHuntz?")) auth.signOut(); 
}

// Navigation Logic
function switchPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    const targetPage = document.getElementById(`${pageId}-page`);
    if(targetPage) targetPage.style.display = 'block';
    
    const targetNav = document.getElementById(`nav-${pageId === 'feed' ? 'home' : pageId}`);
    if(targetNav) targetNav.classList.add('active');
    
    if(pageId === 'feed') renderMemes();
    if(pageId === 'library') loadArtistFolders();
}

// Render Logic
async function renderMemes(filter = "All", btn = null) {
    if(btn) updateChips(btn);
    const grid = (document.getElementById('library-page').style.display === 'block') 
                 ? document.getElementById('libraryResults') : document.getElementById('memeGrid');
    
    if(!grid) return;
    grid.innerHTML = "<p style='text-align:center; grid-column:1/-1;'>Hunting...</p>";
    
    try {
        const snapshot = await db.collection("memes").orderBy("timestamp", "desc").get();
        grid.innerHTML = "";
        snapshot.forEach(doc => {
            const m = doc.data();
            if (filter !== "All" && m.artist !== filter) return;
            grid.innerHTML += createCard(doc.id, m);
        });
    } catch(e) { grid.innerHTML = "Error loading memes."; }
}

async function renderPopular(btn) {
    updateChips(btn);
    const grid = document.getElementById('memeGrid');
    grid.innerHTML = "Loading Trends...";
    const snapshot = await db.collection("memes").orderBy("likes", "desc").limit(10).get();
    grid.innerHTML = "";
    snapshot.forEach(doc => grid.innerHTML += createCard(doc.id, doc.data()));
}

function createCard(id, m) {
    return `
        <div class="meme-card" data-tags="${m.tags}">
            <div class="card-media">${m.type === 'video' ? '🎬' : m.type === 'audio' ? '🎵' : '🖼️'}</div>
            <div class="card-info">
                <h3>${m.title}</h3>
                <button class="btn-download" onclick="window.open('${m.url}')">GET</button>
            </div>
            <div class="card-engagement">
                <button class="engage-btn" onclick="handleLike('${id}')">❤️ <span id="l-${id}">${m.likes || 0}</span></button>
                <button class="engage-btn" onclick="shareWA('${m.url}')">🔗 Share</button>
            </div>
        </div>`;
}

// Social & Upload Features
async function handleLike(id) {
    if(!currentUser) return showAlert("Go to Profile to Login!");
    
    const likeRef = db.collection("memes").doc(id).collection("userLikes").doc(currentUser.uid);
    const doc = await likeRef.get();
    
    if(doc.exists) return showAlert("Already Liked!");

    await db.collection("memes").doc(id).update({ 
        likes: firebase.firestore.FieldValue.increment(1) 
    });
    await likeRef.set({ uid: currentUser.uid });
    
    const likeCountSpan = document.getElementById(`l-${id}`);
    if(likeCountSpan) likeCountSpan.innerText = parseInt(likeCountSpan.innerText) + 1;
}

function shareWA(url) { window.open(`https://wa.me/?text=${encodeURIComponent("Check this template: " + url)}`); }

async function processAndUpload() {
    if(!currentUser) return showAlert("Go to Profile to Login!");
    
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
            uploaderId: currentUser.uid,
            type: document.getElementById('memeType').value,
            tags: (title + " " + artist + " " + document.getElementById('memeTags').value).toLowerCase(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        showAlert("Added to Warehouse!");
        switchPage('feed');
    } catch(e) { showAlert("Upload Failed!"); }
    finally { btn.disabled = false; btn.innerText = "Secure to Warehouse"; }
}

// Profile Stats
async function fetchUserStats() {
    if(!currentUser) return;
    try {
        const uploads = await db.collection("memes").where("uploaderId", "==", currentUser.uid).get();
        const countEl = document.getElementById('user-uploads-count');
        if(countEl) countEl.innerText = uploads.size;
    } catch(e) { console.error("Stats error", e); }
}

// Library & Search
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

function filterMemes() {
    let q = document.getElementById('searchInput').value.toLowerCase();
    document.querySelectorAll('.meme-card').forEach(c => {
        const tags = c.getAttribute('data-tags') || "";
        c.style.display = tags.includes(q) ? "block" : "none";
    });
}

function showAlert(m) { 
    document.getElementById('alertMessage').innerText = m; 
    document.getElementById('customAlert').style.display = 'flex'; 
}

function closeAlert() { 
    document.getElementById('customAlert').style.display = 'none'; 
}

window.onload = () => renderMemes();
