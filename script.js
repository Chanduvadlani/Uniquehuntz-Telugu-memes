import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, increment, setDoc, getDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-storage.js";

// Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyDbNRvlCOOP-JObYpLTFHzFQfld7nuEmzw",
    authDomain: "uniquehuntz-telugu-memes.firebaseapp.com",
    projectId: "uniquehuntz-telugu-memes",
    storageBucket: "uniquehuntz-telugu-memes.firebasestorage.app",
    messagingSenderId: "353299095115",
    appId: "1:353299095115:web:a96fb69ac75797e15037ce"
};

// Init Services
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

let currentUser = null;

// --- AUTHENTICATION ---
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    const loView = document.getElementById('logged-out-view');
    const liView = document.getElementById('logged-in-view');
    if (user) {
        loView.style.display = 'none';
        liView.style.display = 'block';
        document.getElementById('profile-pic').src = user.photoURL;
        document.getElementById('profile-name').innerText = user.displayName;
    } else {
        loView.style.display = 'block';
        liView.style.display = 'none';
    }
});

document.getElementById('loginBtn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('logoutBtn').onclick = () => signOut(auth);

// --- NAVIGATION ---
document.querySelectorAll('.nav-item').forEach(item => {
    item.onclick = () => {
        const target = item.getAttribute('data-page');
        document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
        document.getElementById(`${target}-page`).style.display = 'block';
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        if (target === 'feed') fetchMemes();
    };
});

// --- CORE FUNCTIONS ---
async function fetchMemes() {
    const grid = document.getElementById('memeGrid');
    grid.innerHTML = "<p>Loading Warehouse...</p>";
    try {
        const q = query(collection(db, "memes"), orderBy("timestamp", "desc"));
        const snap = await getDocs(q);
        grid.innerHTML = "";
        snap.forEach(d => {
            const m = d.data();
            grid.innerHTML += `
                <div class="meme-card">
                    <div class="card-media">${m.type === 'video' ? '🎬' : '🖼️'}</div>
                    <div class="card-info">
                        <h3>${m.title}</h3>
                        <button class="btn-primary" onclick="window.open('${m.url}')">GET</button>
                    </div>
                </div>`;
        });
    } catch (e) { console.error(e); }
}

document.getElementById('uploadBtn').onclick = async () => {
    if (!currentUser) return alert("Login First!");
    const file = document.getElementById('fileInput').files[0];
    const title = document.getElementById('memeTitle').value;

    if (!file || !title) return alert("Missing details!");

    const sRef = ref(storage, `templates/${Date.now()}_${file.name}`);
    await uploadBytes(sRef, file);
    const url = await getDownloadURL(sRef);

    await addDoc(collection(db, "memes"), {
        title, url, type: document.getElementById('memeType').value,
        timestamp: serverTimestamp(),
        uploader: currentUser.uid
    });

    alert("Meme Added!");
    location.reload();
};

// Initial Load
fetchMemes();
