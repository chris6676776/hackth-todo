import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    signOut,
    setPersistence,
    browserLocalPersistence,
    signInAnonymously
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {
    getFirestore, collection, addDoc, onSnapshot, query, orderBy,
    serverTimestamp, updateDoc, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyA9dqJEwnveezYsuQproNG7Fu6hkxPUeu0",
    authDomain: "ignup2-5313f.firebaseapp.com",
    projectId: "ignup2-5313f",
    storageBucket: "ignup2-5313f.firebasestorage.app",
    messagingSenderId: "36231750728",
    appId: "1:36231750728:web:ce0a880428712760dba47d"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Make login persistent
setPersistence(auth, browserLocalPersistence);

const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");

loginBtn.addEventListener("click", () => location.href = "login.html");
logoutBtn.addEventListener("click", () => signOut(auth));

const $ = (sel) => document.querySelector(sel);
const els = {
    sync: $('#sync'),
    title: $('#title'),
    due: $('#due'),
    add: $('#add'),
    list: $('#list'),
    empty: $('#empty'),
    count: $('#count'),
    search: $('#search'),
    filters: $('#filters'),
    clear: $('#clear-completed')
};

// Add new task
els.add.addEventListener("click", async () => {
    if (!auth.currentUser) {
        alert("Please sign in to add tasks.");
        return;
    }
    state.uid = auth.currentUser.uid; // ensure uid is set

    const title = els.title.value.trim();
    if (!title) return;
    const due = els.due.value ? new Date(els.due.value) : null;

    await addDoc(path(), {
        title,
        completed: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        dueAt: due || null
    });

    els.title.value = "";
    els.due.value = "";
});


// also allow Enter to add
els.title.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        els.add.click();
    }
});

els.title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); els.add.click(); } });

// Filters + Search
els.filters.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip'); if (!btn) return;
    [...els.filters.querySelectorAll('.chip')].forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    state.filter = btn.dataset.filter;
    render();
});
els.search.addEventListener('input', (e) => { state.search = e.target.value; render(); });

els.clear.addEventListener('click', async () => {
    const toDelete = state.items.filter(i => i.completed);
    await Promise.all(toDelete.map(i => deleteDoc(docRef(i.id))));
});

const state = { uid: null, items: [], filter: 'all', search: '' };

function setSync(text, ok = false) {
    els.sync.innerHTML = `<span style="margin-right:6px">${ok ? "✅" : "🔄"}</span><span>${text}</span>`;
}

function fmtDate(ts) {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}


function escapeHtml(str) {
    return str.replace(/[&<>"']/g, s =>
    ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    }[s])
    );
}


function render() {
    const q = state.search.trim().toLowerCase();
    let list = state.items.filter(it => it.title.toLowerCase().includes(q));
    if (state.filter === 'active') list = list.filter(i => !i.completed);
    if (state.filter === 'completed') list = list.filter(i => i.completed);


    els.list.innerHTML = '';
    list.forEach(it => {
        const row = document.createElement('div');
        row.className = 'todo';
        row.dataset.id = it.id;
        row.dataset.completed = it.completed ? 'true' : 'false';
        row.innerHTML = `
<div class="todo-left">
<input type="checkbox" class="checkbox" ${it.completed ? 'checked' : ''} />
</div>
<div>
<div class="title" contenteditable="true" spellcheck="false">${escapeHtml(it.title)}</div>
<div class="meta">${it.dueAt ? 'Due • ' + fmtDate(it.dueAt) : 'Added • ' + fmtDate(it.createdAt)}</div>
</div>
<div class="actions">
<button class="icon-btn" data-action="save">Save</button>
<button class="icon-btn danger" data-action="delete">Delete</button>
</div>`;


        // Events
        row.querySelector('.checkbox').addEventListener('change', async (e) => {
            await updateDoc(docRef(it.id), { completed: e.target.checked, updatedAt: serverTimestamp() });
        });
        row.querySelector('[data-action="delete"]').addEventListener('click', async () => {
            await deleteDoc(docRef(it.id));
        });
        row.querySelector('[data-action="save"]').addEventListener('click', async () => {
            const newTitle = row.querySelector('.title').innerText.trim();
            if (!newTitle) { row.querySelector('.title').innerText = it.title; return; }
            await updateDoc(docRef(it.id), { title: newTitle, updatedAt: serverTimestamp() });
        });


        els.list.appendChild(row);
    })


    els.empty.style.display = list.length ? 'none' : 'block';
    els.count.textContent = `${list.length} item${list.length !== 1 ? 's' : ''}`;
}

function path() { return collection(db, 'users', state.uid, 'todos'); }
function docRef(id) { return doc(db, 'users', state.uid, 'todos', id); }

// handle auth state
onAuthStateChanged(auth, async (user) => {
    if (user) {
        state.uid = user.uid;
        setSync('Online · Synced', true);

        if (user.isAnonymous) {
            // Treat anonymous as "logged out"
            loginBtn.style.display = "inline-block";
            logoutBtn.style.display = "none";
        } else {
            // Logged in with email/Google
            loginBtn.style.display = "none";
            logoutBtn.style.display = "inline-block";
        }

        const qRef = query(path(), orderBy('createdAt', 'desc'));
        onSnapshot(qRef, (snap) => {
            state.items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            render();
        });
    } else {
        // no user → sign in anonymously
        loginBtn.style.display = "inline-block";
        logoutBtn.style.display = "none";
        state.uid = null;
        state.items = [];
        render();

        await signInAnonymously(auth);
    }
});
