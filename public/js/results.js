/**
 * BrainCastle Quiz Results Controller
 * Renders animated visual score, performance breakdown, filterable answer reviews, hamburger menu, and replay handling
 */

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const attemptId = urlParams.get('attemptId');
  const collectionId = urlParams.get('collectionId');
  const count = urlParams.get('count');
  const shuffle = urlParams.get('shuffle');
  const timer = urlParams.get('timer'); // '0' or minutes

  if (!attemptId) {
    alert('No attempt results found.');
    window.location.href = '/';
    return;
  }

  // Hamburger Drawer Elements
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const navDrawer = document.getElementById('navDrawer');
  const navDrawerOverlay = document.getElementById('navDrawerOverlay');
  const closeDrawerBtn = document.getElementById('closeDrawerBtn');

  function openDrawer() {
    navDrawer.classList.add('active');
    navDrawerOverlay.classList.add('active');
    hamburgerBtn.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    navDrawer.classList.remove('active');
    navDrawerOverlay.classList.remove('active');
    hamburgerBtn.classList.remove('active');
    document.body.style.overflow = '';
  }

  if (hamburgerBtn) hamburgerBtn.addEventListener('click', openDrawer);
  if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', closeDrawer);
  if (navDrawerOverlay) navDrawerOverlay.addEventListener('click', closeDrawer);

  // Check auth for drawer link
  try {
    const authRes = await API.get('/api/auth/me');
    const creatorLink = document.querySelector('a[href="/login.html"]');
    if (authRes.success && authRes.user && creatorLink) {
      creatorLink.href = '/admin.html';
      creatorLink.innerHTML = `👑 Creator Studio (${Utils.escapeHTML(authRes.user.name)})`;
    }
  } catch (e) {
    // Guest user
  }

  // Results DOM Elements
  const quizCollectionBadge = document.getElementById('quizCollectionBadge');
  const timedBadge = document.getElementById('timedBadge');
  const scoreCircleMeter = document.getElementById('scoreCircleMeter');
  const scorePercentDisplay = document.getElementById('scorePercentDisplay');
  const resultsFeedbackTitle = document.getElementById('resultsFeedbackTitle');
  const resultsFeedbackDesc = document.getElementById('resultsFeedbackDesc');
  const statTotal = document.getElementById('statTotal');
  const statCorrect = document.getElementById('statCorrect');
  const statIncorrect = document.getElementById('statIncorrect');
  const replayQuizBtn = document.getElementById('replayQuizBtn');
  const reviewCardsContainer = document.getElementById('reviewCardsContainer');

  const countAll = document.getElementById('countAll');
  const countIncorrect = document.getElementById('countIncorrect');
  const countCorrect = document.getElementById('countCorrect');
  const filterTabBtns = document.querySelectorAll('.review-tab-btn');

  let reviewItems = [];
  let currentFilter = 'all';

  if (timedBadge && timer && parseInt(timer, 10) > 0) {
    timedBadge.style.display = 'inline-block';
    timedBadge.textContent = `⏱ ${timer}m Timed Attempt`;
  }

  /**
   * 1. Load Attempt Results from Backend
   */
  async function loadResults() {
    try {
      const response = await API.get(`/api/quiz/attempt/${attemptId}`);
      if (!response.success || !response.results) {
        throw new Error(response.error || 'Could not load quiz attempt details.');
      }

      const res = response.results;
      reviewItems = res.review || [];

      // Update Header Badge
      quizCollectionBadge.textContent = `${res.collection.title} — Attempt #${res.attemptId}`;

      // Update Stats
      statTotal.textContent = res.totalQuestions;
      statCorrect.textContent = res.correctAnswers;
      statIncorrect.textContent = res.incorrectAnswers;

      // Update Filter Counts
      countAll.textContent = reviewItems.length;
      countCorrect.textContent = res.correctAnswers;
      countIncorrect.textContent = res.incorrectAnswers;

      // Render Score Meter with animation
      animateScore(res.scorePercentage);

      // Render Performance Feedback Message
      setFeedbackMessage(res.scorePercentage, res.correctAnswers, res.totalQuestions);

      // Render Review Cards
      renderReviewCards();

    } catch (error) {
      console.error('Error fetching results:', error);
      alert('Failed to load quiz results: ' + error.message);
      window.location.href = '/';
    }
  }

  /**
   * 2. Animate Circular Score Meter
   */
  function animateScore(percentage) {
    const circumference = 377;
    const offset = circumference - (circumference * percentage) / 100;

    if (percentage >= 80) {
      scoreCircleMeter.classList.add('excellent');
    } else if (percentage >= 50) {
      scoreCircleMeter.classList.add('warning');
    } else {
      scoreCircleMeter.classList.add('danger');
    }

    setTimeout(() => {
      scoreCircleMeter.style.strokeDashoffset = offset;
    }, 150);

    let currentVal = 0;
    const duration = 1000;
    const stepTime = 20;
    const steps = duration / stepTime;
    const increment = percentage / steps;

    if (percentage === 0) {
      scorePercentDisplay.textContent = '0%';
      return;
    }

    const timerAnim = setInterval(() => {
      currentVal += increment;
      if (currentVal >= percentage) {
        currentVal = percentage;
        clearInterval(timerAnim);
      }
      scorePercentDisplay.textContent = `${Math.round(currentVal)}%`;
    }, stepTime);
  }

  /**
   * 3. Set Performance Feedback Text
   */
  function setFeedbackMessage(percentage, correct, total) {
    if (percentage === 100) {
      resultsFeedbackTitle.textContent = '🌟 Perfect Mastery!';
      resultsFeedbackDesc.textContent = `Incredible work! You answered every question correctly (${correct}/${total}).`;
    } else if (percentage >= 80) {
      resultsFeedbackTitle.textContent = '🏆 Outstanding Performance!';
      resultsFeedbackDesc.textContent = `Great grasp of the material! You scored ${correct} out of ${total} questions.`;
    } else if (percentage >= 60) {
      resultsFeedbackTitle.textContent = '👍 Good Job — Room to Grow!';
      resultsFeedbackDesc.textContent = `Solid effort! Review the explanations below to clear up any missed concepts.`;
    } else {
      resultsFeedbackTitle.textContent = '📚 Keep Practicing!';
      resultsFeedbackDesc.textContent = `You scored ${correct} out of ${total}. Review explanations and replay to strengthen your knowledge!`;
    }
  }

  /**
   * 4. Render Answer Review Cards with Filter
   */
  function renderReviewCards() {
    reviewCardsContainer.innerHTML = '';

    const filtered = reviewItems.filter(item => {
      if (currentFilter === 'correct') return item.isCorrect;
      if (currentFilter === 'incorrect') return !item.isCorrect;
      return true;
    });

    if (filtered.length === 0) {
      reviewCardsContainer.innerHTML = `
        <div class="empty-state" style="padding: 2rem;">
          <p style="color: var(--color-text-secondary);">No questions in this filter.</p>
        </div>
      `;
      return;
    }

    filtered.forEach((item, index) => {
      const card = document.createElement('article');
      card.className = 'review-card animate-fade-in';

      const statusHtml = item.isCorrect
        ? `<span class="review-status-tag correct">✔ Correct</span>`
        : `<span class="review-status-tag incorrect">✖ Incorrect</span>`;

      let optionsHtml = '';
      item.options.forEach(opt => {
        let optClass = 'review-option';
        let badgeHtml = '';

        if (opt.isCorrect) {
          optClass += ' is-correct-target';
          badgeHtml = '<span style="font-size: 0.7rem; font-weight: 700;">✔ Correct Answer</span>';
        } else if (opt.id === item.selectedOptionId && !opt.isCorrect) {
          optClass += ' is-wrong-selection';
          badgeHtml = '<span style="font-size: 0.7rem; font-weight: 700;">✖ Your Selection</span>';
        } else if (opt.id === item.selectedOptionId && opt.isCorrect) {
          badgeHtml = '<span style="font-size: 0.7rem; font-weight: 700;">✔ Your Selection (Correct)</span>';
        }

        optionsHtml += `
          <div class="${optClass}">
            <span>${Utils.escapeHTML(opt.text)}</span>
            ${badgeHtml}
          </div>
        `;
      });

      let explanationHtml = '';
      if (item.explanation && item.explanation.trim() !== '') {
        explanationHtml = `
          <div class="review-explanation">
            <strong>💡 Explanation:</strong> ${Utils.escapeHTML(item.explanation)}
          </div>
        `;
      }

      card.innerHTML = `
        <div class="review-header">
          <h3 style="font-size: 0.9rem; font-weight: 700;">
            ${index + 1}. ${Utils.escapeHTML(item.questionText)}
          </h3>
          ${statusHtml}
        </div>
        <div class="review-options">
          ${optionsHtml}
        </div>
        ${explanationHtml}
      `;

      reviewCardsContainer.appendChild(card);
    });
  }

  /**
   * 5. Filter Tab Switching
   */
  filterTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderReviewCards();
    });
  });

  /**
   * 6. Replay Quiz Handler
   * Preserves previous user settings (collection, count, shuffle, timer)
   */
  replayQuizBtn.addEventListener('click', () => {
    const replayCollectionId = collectionId || '1';
    const replayCount = count || '5';
    const replayShuffle = shuffle || '0';
    const replayTimer = timer || '0';

    Utils.showToast('Preparing new replay session...', 'info');

    setTimeout(() => {
      window.location.href = `/quiz.html?collectionId=${replayCollectionId}&count=${replayCount}&shuffle=${replayShuffle}&timer=${replayTimer}`;
    }, 300);
  });

  // Initialize
  loadResults();
});
