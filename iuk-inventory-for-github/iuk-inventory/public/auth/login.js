const form = document.getElementById('login-form');
const errorBox = document.getElementById('error-box');
const loginBtn = document.getElementById('login-btn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorBox.classList.remove('show');
  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in...';

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (res.ok) {
      window.location.href = '/';
    } else {
      errorBox.textContent = data.error === 'invalid_credentials'
        ? 'Incorrect username or password.'
        : 'Something went wrong. Please try again.';
      errorBox.classList.add('show');
    }
  } catch (err) {
    errorBox.textContent = 'Could not reach the server. Please try again.';
    errorBox.classList.add('show');
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign In';
  }
});
