// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyDbNRvlCOOP-JObYpLTFHzFQfld7nuEmzw",
    authDomain: "uniquehuntz-telugu-memes.firebaseapp.com",
    projectId: "uniquehuntz-telugu-memes",
    storageBucket: "uniquehuntz-telugu-memes.appspot.com",
    messagingSenderId: "353299095115",
    appId: "1:353299095115:web:b5c6e41e019237b15037ce"
};

// --- CLOUDINARY SETTINGS ---
const CLOUD_NAME = "dgihkijul"; 
const UPLOAD_PRESET = "uniquehuntz_preset"; 

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

let isAdmin = false;

// --- AUTH MONITOR ---
auth.onAuthStateChanged((user) => {
    const loggedOutView = document.getElementById('logged-out-view');
    const loggedInView = document.getElementById('logged-in-view');
    
    if (user) {
        isAdmin = true;
        if(loggedOutView) loggedOutView.style.display = 'none';
        if(loggedInView) loggedInView.style.display = 'block';
    } else {
        isAdmin = false;
        if(loggedOutView) loggedOutView.style.display = 'block';
        if(loggedInView) loggedInView.style.display = 'none';
    }
    renderMemes(); 
});

// --- ADMIN LOGIN/LOGOUT ---
async function manualLogin() {
    const email = document.getElementById('adminUser').value.trim();
    const pass = document.getElementById('adminPass').value.trim();
    
    if(!email || !pass) return showAlert("Enter Email & Password");

    try {
        await auth.signInWithEmailAndPassword(email, pass);
        showAlert("Admin Access Granted!");
    } catch (e) {
        showAlert("Login Failed: " + e.message);
    }
}

async function manualLogout() {
    await auth.signOut();
    showAlert("Warehouse Locked.");
}

// --- UPLOAD PROCESS ---
async function processAndUpload() {
    const btn = document.getElementById('uploadBtn');
    const fileInput = document.getElementById('fileInput');
    const title = document.getElementById('memeTitle').value.trim();
    const artist = document.getElementById('memeArtist').value || "Legend";
    const type = document.getElementById('memeType').value;

    if (!fileInput.files[0] || !title) return showAlert("Missing Title or File!");

    btn.disabled = true;
    btn.innerText = "Step 1: Uploading to Cloud...";

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);

    try {
        // We use /auto/ so Cloudinary detects if it's an image or video automatically
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();

        // If Cloudinary rejects the file
        if (!data.secure_url) {
            console.error("Cloudinary Error Log:", data);
            throw new Error(data.error ? data.error.message : "Cloudinary upload failed");
        }

        btn.innerText = "Step 2: Saving to Firebase...";

        // Save link and metadata to Firestore
        await db.collection("memes").add({
            title: title,
            artist: artist,
            url: data.secure_url,
            public_id: data.public_id,
            type: type,
            likes: 0,
            tags: (title + " " + artist).toLowerCase(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        showAlert("Meme Added Successfully!");
        switchPage('feed');
        
        // Reset inputs
        document.getElementById('memeTitle').value = "";
        fileInput.value = "";

    } catch (e) {
        console.error("Critical Error:", e);
        showAlert("Upload Error: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Secure to Warehouse";
    }
}

// --- RENDERING ---
async function renderMemes(filter = "All") {
    const grid = document.getElementById('memeGrid');
    if(!grid) return;
    grid.innerHTML = "<p style='text-align:center;'>Fetching Warehouse Data...</p>";

    try {
        const snapshot = await db.collection("memes").orderBy("timestamp", "desc").get();
        grid.innerHTML = "";
        
        if (snapshot.empty) {
            grid.innerHTML = "<p style='text-align:center; grid-column:1/-1;'>Warehouse is empty. Add some memes!</p>";
            return;
        }

        snapshot.forEach(doc => {
            const m = doc.data();
            if (filter !== "All" && m.artist !== filter) return;
            grid.innerHTML += createCard(doc.id, m);
        });
    } catch(e) {
        grid.innerHTML = "Database error. Please refresh.";
    }
}

function createCard(id, m) {
    let deleteBtn = isAdmin ? `<button onclick="deleteMeme('${id}')" style="background:#ff4757; color:white; border:none; width:100%; padding:8px; margin-top:8px; border-radius:8px; font-weight:bold; cursor:pointer;">🗑️ DELETE</button>` : "";
    
    return `
        <div class="meme-card" data-tags="${m.tags}">
            <div class="card-media">${m.type === 'video' ? '🎬' : '🖼️'}</div>
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

// --- FEATURES ---
async function deleteMeme(id) {
    if(confirm("Permanently delete this from the warehouse?")) {
        try {
            await db.collection("memes").doc(id).delete();
            renderMemes();
        } catch(e) { showAlert("Delete failed."); }
    }
}

async function handleLike(id) {
    await db.collection("memes").doc(id).update({ 
        likes: firebase.firestore.FieldValue.increment(1) 
    });
    const l = document.getElementById(`l-${id}`);
    if(l) l.innerText = parseInt(l.innerText) + 1;
}

// --- UI / NAVIGATION ---
function switchPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    const target = document.getElementById(`${pageId}-page`);
    if(target) target.style.display = 'block';
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navId = pageId === 'feed' ? 'home' : pageId;
    const activeNav = document.getElementById(`nav-${navId}`);
    if(activeNav) activeNav.classList.add('active');

    if(pageId === 'feed') renderMemes();
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

function closeAlert() { document.getElementById('customAlert').style.display = 'none'; }

function shareWA(url) { window.open(`https://wa.me/?text=Check this meme: ${encodeURIComponent(url)}`); }

// Start
window.onload = () => renderMemes();
