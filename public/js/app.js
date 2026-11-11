/**
 * Main Frontend Application Script
 * Initializes BrainCastle homepage, hamburger navigation, category filters, live search, and quiz timer configuration
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const serverStatus = document.getElementById('serverStatus');
  const quizGrid = document.getElementById('quizGrid');
  const emptyState = document.getElementById('emptyState');
  const searchInput = document.getElementById('searchInput');

  // Hamburger Drawer Elements
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const navDrawer = document.getElementById('navDrawer');
  const navDrawerOverlay = document.getElementById('navDrawerOverlay');
  const closeDrawerBtn = document.getElementById('closeDrawerBtn');
  const drawerQuizzesLink = document.getElementById('drawerQuizzesLink');

  // Modal Elements
  const quizModal = document.getElementById('quizModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalCancelBtn = document.getElementById('modalCancelBtn');
  const modalTitle = document.getElementById('modalTitle');
  const modalDesc = document.getElementById('modalDesc');
  const questionCountRange = document.getElementById('questionCountRange');
  const questionCountDisplay = document.getElementById('questionCountDisplay');
  const shuffleCheckbox = document.getElementById('shuffleCheckbox');
  const startQuizBtn = document.getElementById('startQuizBtn');

  // Timer Configuration Elements
  const timerCheckbox = document.getElementById('timerCheckbox');
  const timerConfigSection = document.getElementById('timerConfigSection');
  const timerDisplayVal = document.getElementById('timerDisplayVal');
  const customTimerInput = document.getElementById('customTimerInput');
  const timerPresetBtns = document.querySelectorAll('.timer-preset-btn');

  // Application State
  let currentCategory = 'all';
  let searchQuery = '';
  let selectedCollection = null;
  let selectedTimerMinutes = 5;

  /**
   * 1. Hamburger Menu Toggle Logic
   */
  function openDrawer() {
    navDrawer.classList.add('active');
    navDrawerOverlay.classList.add('active');
    hamburgerBtn.classList.add('active');
    hamburgerBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    navDrawer.classList.remove('active');
    navDrawerOverlay.classList.remove('active');
    hamburgerBtn.classList.remove('active');
    hamburgerBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  if (hamburgerBtn) hamburgerBtn.addEventListener('click', openDrawer);
  if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', closeDrawer);
  if (navDrawerOverlay) navDrawerOverlay.addEventListener('click', closeDrawer);
  if (drawerQuizzesLink) {
    drawerQuizzesLink.addEventListener('click', () => {
      closeDrawer();
    });
  }

  /**
   * 2. Check Server & Database Health and Auth State
   */
  async function checkServerHealth() {
    try {
      const response = await API.get('/api/health');
      if (response.status === 'online') {
        serverStatus.innerHTML = `
          <span class="status-dot"></span>
          <span>Online &bull; Database Connected</span>
        `;
      }

      // Check user session
      const authRes = await API.get('/api/auth/me');
      const creatorLink = document.querySelector('a[href="/login.html"]');
      if (authRes.success && authRes.user && creatorLink) {
        creatorLink.href = '/admin.html';
        creatorLink.innerHTML = `👑 Creator Studio (${Utils.escapeHTML(authRes.user.name)})`;
      }
    } catch (error) {
      serverStatus.style.backgroundColor = 'var(--color-danger-light)';
      serverStatus.style.color = 'var(--color-danger)';
      serverStatus.innerHTML = `
        <span style="display:inline-block; width:8px; height:8px; background:var(--color-danger); border-radius:50%;"></span>
        <span>Offline</span>
      `;
    }
  }

  /**
   * 3. Load and Render Collections
   */
  async function loadCollections() {
    try {
      quizGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--color-text-muted);">
          Loading quizzes...
        </div>
      `;

      let url = '/api/collections';
      if (searchQuery && searchQuery.trim() !== '') {
        url += `?search=${encodeURIComponent(searchQuery.trim())}`;
      }

      const response = await API.get(url);
      const collections = response.data || [];

      if (collections.length === 0) {
        quizGrid.innerHTML = '';
        emptyState.style.display = 'block';
        return;
      }

      emptyState.style.display = 'none';
      quizGrid.innerHTML = '';

      collections.forEach(col => {
        const card = document.createElement('article');
        card.className = 'quiz-card animate-fade-in';

        const cover = col.cover_image || 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=800&q=80';
        const isRecent = col.created_at ? (Date.now() - new Date(col.created_at).getTime()) < (7 * 24 * 60 * 60 * 1000) : false;
        const newBadgeHtml = isRecent ? `<span class="badge" style="position: absolute; top: var(--space-3); right: var(--space-3); background: var(--color-success); color: #fff; font-size: var(--font-size-xs); font-weight: 700; padding: 0.25rem 0.65rem; border-radius: var(--radius-full); box-shadow: 0 2px 5px rgba(0,0,0,0.2);">✨ New</span>` : '';

        card.innerHTML = `
          <div class="quiz-cover-wrap">
            <img src="${Utils.escapeHTML(cover)}" alt="${Utils.escapeHTML(col.title)}" class="quiz-cover-img" loading="lazy" />
            ${newBadgeHtml}
          </div>
          <div class="quiz-card-body">
            <h3 class="quiz-card-title">${Utils.escapeHTML(col.title)}</h3>
            <p class="quiz-card-desc">${Utils.escapeHTML(col.description || 'No description provided.')}</p>
            <div class="quiz-card-meta">
              <span class="meta-item">📝 <strong>${col.question_count}</strong> Questions</span>
              <span class="meta-item">👤 ${Utils.escapeHTML(col.creator_name || 'codeapostle1')}</span>
            </div>
            <div style="margin-top: var(--space-4);">
              <button class="btn btn-outline btn-sm btn-block" style="pointer-events: none;">View Quiz & Play &rarr;</button>
            </div>
          </div>
        `;

        card.addEventListener('click', () => openQuizModal(col));
        quizGrid.appendChild(card);
      });
    } catch (error) {
      console.error('Error loading collections:', error);
      quizGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; color: var(--color-danger); padding: 2rem;">
          Failed to load quiz collections. Please refresh or check connection.
        </div>
      `;
    }
  }

  /**
   * 5. Open Quiz Configuration Modal
   */
  function openQuizModal(collection) {
    selectedCollection = collection;
    modalTitle.textContent = collection.title;
    modalDesc.textContent = collection.description || 'Configure your quiz session parameters below:';

    const maxQ = Math.max(1, collection.question_count || 1);
    questionCountRange.max = maxQ;
    questionCountRange.value = maxQ;
    questionCountDisplay.textContent = maxQ;

    // Reset timer checkbox
    timerCheckbox.checked = false;
    timerConfigSection.style.display = 'none';
    selectedTimerMinutes = 5;
    customTimerInput.value = 5;
    timerDisplayVal.textContent = '5 Minutes';

    quizModal.classList.add('active');
  }

  function closeQuizModal() {
    quizModal.classList.remove('active');
    selectedCollection = null;
  }

  // Question count slider listener
  if (questionCountRange) {
    questionCountRange.addEventListener('input', (e) => {
      questionCountDisplay.textContent = e.target.value;
    });
  }

  // Timer Checkbox Toggle Listener
  if (timerCheckbox) {
    timerCheckbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        timerConfigSection.style.display = 'block';
      } else {
        timerConfigSection.style.display = 'none';
      }
    });
  }

  // Timer Preset Buttons Listener
  timerPresetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      timerPresetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mins = parseInt(btn.dataset.mins, 10);
      selectedTimerMinutes = mins;
      customTimerInput.value = mins;
      timerDisplayVal.textContent = `${mins} Minute${mins > 1 ? 's' : ''}`;
    });
  });

  // Custom Timer Input Listener
  if (customTimerInput) {
    customTimerInput.addEventListener('input', (e) => {
      let mins = parseInt(e.target.value, 10);
      if (isNaN(mins) || mins < 1) mins = 1;
      if (mins > 120) mins = 120;
      selectedTimerMinutes = mins;
      timerPresetBtns.forEach(b => b.classList.toggle('active', parseInt(b.dataset.mins, 10) === mins));
      timerDisplayVal.textContent = `${mins} Minute${mins > 1 ? 's' : ''}`;
    });
  }

  // Modal Close Listeners
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeQuizModal);
  if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeQuizModal);
  if (quizModal) {
    quizModal.addEventListener('click', (e) => {
      if (e.target === quizModal) closeQuizModal();
    });
  }

  // Start Quiz Button
  if (startQuizBtn) {
    startQuizBtn.addEventListener('click', () => {
      if (!selectedCollection) return;
      const count = questionCountRange.value;
      const shuffle = shuffleCheckbox.checked ? '1' : '0';
      const timerVal = timerCheckbox.checked ? selectedTimerMinutes : '0';

      startQuizBtn.disabled = true;
      startQuizBtn.textContent = 'Loading Quiz...';

      // Redirect to quiz player with session parameters (including timer)
      window.location.href = `/quiz.html?collectionId=${selectedCollection.id}&count=${count}&shuffle=${shuffle}&timer=${timerVal}`;
    });
  }

  // Search input debounced handler
  let searchTimeout = null;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        searchQuery = e.target.value;
        loadCollections();
      }, 300);
    });
  }

  // Initialize
  checkServerHealth();
  loadCollections();
});
