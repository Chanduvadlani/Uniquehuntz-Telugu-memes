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
// Updated with your actual Cloud Name from the screenshot
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

// --- CORE FUNCTIONS ---

async function manualLogin() {
    const email = document.getElementById('adminUser').value;
    const pass = document.getElementById('adminPass').value;
    
    if(!email || !pass) return showAlert("Please enter Email & Password");

    try {
        await auth.signInWithEmailAndPassword(email, pass);
        showAlert("Access Granted, Boss!");
    } catch (error) {
        showAlert("Login Error: " + error.message);
    }
}

async function manualLogout() {
    await auth.signOut();
    showAlert("Warehouse Locked.");
}

async function processAndUpload() {
    const btn = document.getElementById('uploadBtn');
    const fileInput = document.getElementById('fileInput');
    const title = document.getElementById('memeTitle').value;
    const artist = document.getElementById('memeArtist').value || "Legend";
    const type = document.getElementById('memeType').value;
    const tagsInput = document.getElementById('memeTags').value;

    if (!fileInput.files[0] || !title) return showAlert("File and Title are required!");

    btn.disabled = true;
    btn.innerText = "Uploading to Cloud...";

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);

    try {
        // Resource type must be 'auto' to handle images and videos automatically
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (!data.secure_url) {
            console.error("Cloudinary Error:", data);
            throw new Error(data.error ? data.error.message : "Upload failed");
        }

        btn.innerText = "Saving to Database...";

        // Save to Firebase Firestore
        await db.collection("memes").add({
            title: title,
            artist: artist,
            url: data.secure_url,
            public_id: data.public_id,
            type: type,
            likes: 0,
            tags: (title + " " + artist + " " + tagsInput).toLowerCase(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        showAlert("Success! Added to Warehouse.");
        switchPage('feed');
        
        // Reset form
        document.getElementById('memeTitle').value = "";
        fileInput.value = "";
    } catch (e) {
        console.error("Full Error:", e);
        showAlert("Error: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Secure to Warehouse";
    }
}

async function renderMemes(filter = "All") {
    const grid = document.getElementById('memeGrid');
    if(!grid) return;
    grid.innerHTML = "<p style='text-align:center;'>Hunting Templates...</p>";

    try {
        const snapshot = await db.collection("memes").orderBy("timestamp", "desc").get();
        grid.innerHTML = "";
        snapshot.forEach(doc => {
            const m = doc.data();
            if (filter !== "All" && m.artist !== filter) return;
            grid.innerHTML += createCard(doc.id, m);
        });
    } catch(e) {
        grid.innerHTML = "Warehouse Busy. Try again.";
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

async function deleteMeme(id) {
    if(confirm("Admin: Remove this template forever?")) {
        try {
            await db.collection("memes").doc(id).delete();
            showAlert("Removed.");
            renderMemes();
        } catch(e) { showAlert("Error deleting."); }
    }
}

async function handleLike(id) {
    await db.collection("memes").doc(id).update({ 
        likes: firebase.firestore.FieldValue.increment(1) 
    });
    const l = document.getElementById(`l-${id}`);
    if(l) l.innerText = parseInt(l.innerText) + 1;
}

// --- NAVIGATION ---
function switchPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    const targetPage = document.getElementById(`${pageId}-page`);
    if(targetPage) targetPage.style.display = 'block';
    
    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    const navId = pageId === 'feed' ? 'home' : pageId;
    const navBtn = document.getElementById(`nav-${navId}`);
    if(navBtn) navBtn.classList.add('active');

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
    const alertBox = document.getElementById('customAlert');
    const alertMsg = document.getElementById('alertMessage');
    if(alertBox && alertMsg) {
        alertMsg.innerText = m; 
        alertBox.style.display = 'flex'; 
    }
}
function closeAlert() { document.getElementById('customAlert').style.display = 'none'; }
function shareWA(url) { window.open(`https://wa.me/?text=${encodeURIComponent(url)}`); }

window.onload = () => renderMemes();
