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
  let currentUserIsRegistered = false;

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
      currentUserIsRegistered = Boolean(authRes.success && authRes.user);
      if (authRes.success && authRes.user && creatorLink) {
        creatorLink.href = '/admin.html';
        creatorLink.innerHTML = `👑 Creator Studio (${Utils.escapeHTML(authRes.user.name)})`;
      }
      maybeShowSignupReminder();
    } catch (error) {
      maybeShowSignupReminder();
      serverStatus.style.backgroundColor = 'var(--color-danger-light)';
      serverStatus.style.color = 'var(--color-danger)';
      serverStatus.innerHTML = `
        <span style="display:inline-block; width:8px; height:8px; background:var(--color-danger); border-radius:50%;"></span>
        <span>Offline</span>
      `;
    }
  }


  function maybeShowSignupReminder() {
    if (currentUserIsRegistered || localStorage.getItem('braincastle_signup_never') === '1') return;
    const now = Date.now();
    const nextAt = Number(localStorage.getItem('braincastle_signup_next') || 0);
    if (now < nextAt) return;
    window.setTimeout(() => {
      if (currentUserIsRegistered || document.getElementById('signupReminderOverlay')) return;
      const overlay = document.createElement('div');
      overlay.id = 'signupReminderOverlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(15,23,42,.58);display:grid;place-items:center;padding:1rem;';
      overlay.innerHTML = `
        <section role="dialog" aria-modal="true" aria-labelledby="signupReminderTitle" style="max-width:430px;width:100%;background:var(--color-bg-surface);color:var(--color-text-main);border-radius:var(--radius-lg);padding:1.5rem;box-shadow:0 20px 60px rgba(0,0,0,.25);">
          <div style="font-size:1.8rem;margin-bottom:.5rem;">🏰</div>
          <h2 id="signupReminderTitle" style="margin:0 0 .5rem;">Enjoying BrainCastle?</h2>
          <p style="color:var(--color-text-secondary);line-height:1.6;">Create a free account to build and publish your own quiz collections, and share them with others.</p>
          <a href="/login.html" class="btn btn-primary btn-block" style="margin:.75rem 0;">Create a free account</a>
          <div style="display:flex;gap:.6rem;flex-wrap:wrap;justify-content:center;">
            <button type="button" id="signupRemindLater" class="btn btn-secondary btn-sm">Remind me later</button>
            <button type="button" id="signupRemindNever" class="btn btn-outline btn-sm">Don't remind me again</button>
          </div>
        </section>`;
      document.body.appendChild(overlay);
      document.getElementById('signupRemindLater').addEventListener('click', () => {
        localStorage.setItem('braincastle_signup_next', String(Date.now() + 3 * 24 * 60 * 60 * 1000));
        overlay.remove();
      });
      document.getElementById('signupRemindNever').addEventListener('click', () => {
        localStorage.setItem('braincastle_signup_never', '1');
        overlay.remove();
      });
    }, 12000);
  }


  function maybeShowDonationReminder() {
    if (localStorage.getItem('braincastle_donation_never') === '1') return;
    if (Date.now() < Number(localStorage.getItem('braincastle_donation_next') || 0)) return;
    setTimeout(() => {
      if (document.getElementById('donationReminderOverlay')) return;
      const overlay = document.createElement('div');
      overlay.id = 'donationReminderOverlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:3100;background:rgba(15,23,42,.58);display:grid;place-items:center;padding:1rem;';
      overlay.innerHTML = '<section role="dialog" aria-modal="true" style="max-width:420px;width:100%;background:var(--color-bg-surface);color:var(--color-text-main);border-radius:var(--radius-lg);padding:1.5rem;box-shadow:0 20px 60px rgba(0,0,0,.25);"><div style="font-size:1.8rem;">💚</div><h2 style="margin:.4rem 0;">Support free learning</h2><p style="color:var(--color-text-secondary);line-height:1.6;">If BrainCastle has helped you study, consider supporting its continued development. Every contribution is voluntary and appreciated.</p><a href="/about.html#supportTitle" class="btn btn-primary btn-block" style="margin:.8rem 0;">Show love to the creator</a><div style="display:flex;gap:.6rem;justify-content:center;flex-wrap:wrap;"><button id="donationRemindLater" class="btn btn-secondary btn-sm">Remind me later</button><button id="donationRemindNever" class="btn btn-outline btn-sm">Don\'t show again</button></div></section>';
      document.body.appendChild(overlay);
      document.getElementById('donationRemindLater').addEventListener('click', () => { localStorage.setItem('braincastle_donation_next', String(Date.now() + 7*24*60*60*1000)); overlay.remove(); });
      document.getElementById('donationRemindNever').addEventListener('click', () => { localStorage.setItem('braincastle_donation_never', '1'); overlay.remove(); });
    }, 18000);
  }

  function getVisitorKey() {
    let key = localStorage.getItem('braincastle_visitor_key');
    if (!key) {
      key = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() :
        'bc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
      localStorage.setItem('braincastle_visitor_key', key);
    }
    return key;
  }

  async function recordCollectionView(collectionId) {
    try {
      await API.post(`/api/collections/${encodeURIComponent(collectionId)}/view`, { visitorKey: getVisitorKey() });
    } catch (error) {
      console.warn('Could not record quiz collection view:', error);
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
              <span class="meta-item" title="Unique collection views">👁️ <strong>${Number(col.view_count || 0)}</strong> Views</span>
              <span class="meta-item" title="Reader comments">💬 <strong>${Number(col.comment_count || 0)}</strong> Comments</span>
              <span class="meta-item">👤 ${Utils.escapeHTML(col.creator_name || 'codeapostle1')}</span>
            </div>
            <div style="margin-top: var(--space-4);">
              <button class="btn btn-outline btn-sm btn-block" style="pointer-events: none;">View Quiz & Play &rarr;</button>
              <button class="btn btn-secondary btn-sm btn-block btn-show-comments" type="button" style="margin-top:.5rem;">💬 Read comments (${Number(col.comment_count || 0)})</button>
              <div class="collection-comments-panel" hidden style="margin-top:.65rem;padding:.75rem;border:1px solid var(--color-border);border-radius:var(--radius-md);background:var(--color-bg-muted);"></div>
            </div>
          </div>
        `;

        const commentsButton = card.querySelector('.btn-show-comments');
        const commentsPanel = card.querySelector('.collection-comments-panel');
        commentsButton.addEventListener('click', async (event) => {
          event.stopPropagation();
          commentsPanel.hidden = !commentsPanel.hidden;
          if (!commentsPanel.hidden && !commentsPanel.dataset.loaded) {
            commentsPanel.textContent = 'Loading comments...';
            try {
              const result = await API.get('/api/collections/' + col.id + '/comments');
              commentsPanel.innerHTML = result.data.length ? result.data.map(item => '<div style="padding:.5rem 0;border-bottom:1px solid var(--color-border);"><strong>' + Utils.escapeHTML(item.display_name) + '</strong><div style="white-space:pre-wrap;overflow-wrap:anywhere;">' + Utils.escapeHTML(item.comment_text) + '</div><small style="color:var(--color-text-muted);">' + Utils.escapeHTML(new Date(item.created_at).toLocaleDateString()) + '</small></div>').join('') : '<p>No comments yet. Be the first to share your experience after playing!</p>';
              commentsPanel.dataset.loaded = '1';
            } catch (error) { commentsPanel.textContent = 'Comments could not be loaded right now.'; }
          }
        });
        card.addEventListener('click', () => { recordCollectionView(col.id); openQuizModal(col); });
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
  maybeShowDonationReminder();
});
