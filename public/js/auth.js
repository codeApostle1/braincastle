/**
 * Creator Authentication Script
 * Manages tab switching, registration, login, session inspection, and redirects
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Check if user is already logged in
  try {
    const res = await API.get('/api/auth/me');
    if (res.success && res.user) {
      window.location.href = '/admin.html';
      return;
    }
  } catch (e) {
    // Not logged in, continue
  }

  // DOM Elements
  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const authAlert = document.getElementById('authAlert');

  // Eye Icon Toggle for Password Fields
  const eyeOpenSvg = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  `;

  const eyeClosedSvg = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
      <line x1="1" y1="1" x2="23" y2="23"></line>
    </svg>
  `;

  document.querySelectorAll('.toggle-password-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (!input) return;

      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.innerHTML = isPassword ? eyeClosedSvg : eyeOpenSvg;
      btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
      btn.title = isPassword ? 'Hide password' : 'Show password';
    });
  });
  tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
    hideAlert();
  });

  tabRegister.addEventListener('click', () => {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    registerForm.style.display = 'block';
    loginForm.style.display = 'none';
    hideAlert();
  });

  function showAlert(msg, isError = true) {
    authAlert.style.display = 'block';
    authAlert.style.backgroundColor = isError ? 'var(--color-danger-light)' : 'var(--color-success-light)';
    authAlert.style.color = isError ? 'var(--color-danger)' : 'var(--color-success)';
    authAlert.style.border = `1px solid ${isError ? '#fca5a5' : '#86efac'}`;
    authAlert.textContent = msg;
  }

  function hideAlert() {
    authAlert.style.display = 'none';
  }

  // Handle Login Submission
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    const submitBtn = document.getElementById('loginSubmitBtn');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

    try {
      const response = await API.post('/api/auth/login', { email, password, rememberMe });
      if (response.success) {
        Utils.showToast(`Welcome back, ${response.user.name}!`, 'success');
        setTimeout(() => {
          window.location.href = '/admin.html';
        }, 400);
      }
    } catch (error) {
      showAlert(error.message);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  });

  // Handle Register Submission
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    const submitBtn = document.getElementById('regSubmitBtn');

    if (password !== confirmPassword) {
      showAlert('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      showAlert('Password must be at least 6 characters.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating Account...';

    try {
      const response = await API.post('/api/auth/register', { name, email, password, confirmPassword });
      if (response.success) {
        Utils.showToast('Account registered successfully! Redirecting...', 'success');
        setTimeout(() => {
          window.location.href = '/admin.html';
        }, 500);
      }
    } catch (error) {
      showAlert(error.message);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Creator Account';
    }
  });
});
