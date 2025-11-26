const API_URL = 'http://localhost:5000/api';

let currentUser = null;

// Show/hide sections
function showSection(sectionName) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionName).classList.add('active');
}

// Register function
async function register(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    
    const userData = {
        fullName: formData.get('fullName') || event.target[0].value,
        email: event.target[1].value,
        password: event.target[2].value,
        category: event.target[3].value,
        adminCode: event.target[4].value
    };

    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });

        const data = await response.json();
        alert(data.message);
        if (response.ok) showSection('login');
    } catch (error) {
        alert('Registration failed');
    }
}

// Login function
async function login(event) {
    event.preventDefault();
    const email = event.target[0].value;
    const password = event.target[1].value;

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('token', data.token);
            currentUser = data.user;
            updateUI();
            showSection('dashboard');
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert('Login failed');
    }
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    currentUser = null;
    updateUI();
    showSection('home');
}

// Update UI based on auth state
function updateUI() {
    const token = localStorage.getItem('token');
    const authButtons = document.getElementById('authButtons');
    const userMenu = document.getElementById('userMenu');

    if (token && currentUser) {
        authButtons.style.display = 'none';
        userMenu.style.display = 'flex';
        document.getElementById('userName').textContent = currentUser.fullName;
    } else {
        authButtons.style.display = 'flex';
        userMenu.style.display = 'none';
    }
}

// Check auth on load
window.addEventListener('load', () => {
    const token = localStorage.getItem('token');
    if (token) {
        // Verify token and get user data
        fetch(`${API_URL}/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(response => response.json())
        .then(user => {
            currentUser = user;
            updateUI();
            showSection('dashboard');
        })
        .catch(() => {
            localStorage.removeItem('token');
            showSection('home');
        });
    } else {
        showSection('home');
    }
});
