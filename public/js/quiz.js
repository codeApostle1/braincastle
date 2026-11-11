/**
 * Quiz Player Controller
 * Manages question flow, answer selection, keyboard shortcuts, progress, custom countdown timer, and secure submission
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Parse URL Parameters
  const urlParams = new URLSearchParams(window.location.search);
  const collectionId = urlParams.get('collectionId');
  const countParam = urlParams.get('count');
  const shuffleParam = urlParams.get('shuffle');
  const timerParam = urlParams.get('timer'); // 0 or minutes

  if (!collectionId) {
    alert('No quiz collection specified.');
    window.location.href = '/';
    return;
  }

  // 2. DOM Elements
  const quizTitle = document.getElementById('quizTitle');
  const quizProgressBar = document.getElementById('quizProgressBar');
  const questionProgressText = document.getElementById('questionProgressText');
  const answeredCounter = document.getElementById('answeredCounter');
  const questionDots = document.getElementById('questionDots');
  const questionBadge = document.getElementById('questionBadge');
  const questionText = document.getElementById('questionText');
  const optionsList = document.getElementById('optionsList');
  const hintSection = document.getElementById('hintSection');
  const toggleHintBtn = document.getElementById('toggleHintBtn');
  const hintBox = document.getElementById('hintBox');
  const hintContent = document.getElementById('hintContent');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const submitBtn = document.getElementById('submitBtn');

  // Timer Widget Elements
  const timerWidget = document.getElementById('timerWidget');
  const timerCountdown = document.getElementById('timerCountdown');

  // Modals
  const submitModal = document.getElementById('submitModal');
  const submitModalClose = document.getElementById('submitModalClose');
  const submitModalCancel = document.getElementById('submitModalCancel');
  const confirmSubmitBtn = document.getElementById('confirmSubmitBtn');
  const submitModalSummary = document.getElementById('submitModalSummary');
  const unansweredWarning = document.getElementById('unansweredWarning');

  const exitQuizBtn = document.getElementById('exitQuizBtn');
  const exitModal = document.getElementById('exitModal');
  const exitModalClose = document.getElementById('exitModalClose');
  const cancelExitBtn = document.getElementById('cancelExitBtn');

  // 3. Quiz State
  let session = null;
  let questions = [];
  let currentIndex = 0;
  const userAnswers = {}; // { [questionId]: selectedOptionId }
  let isSubmitting = false;
  let timerInterval = null;

  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

  /**
   * 4. Fetch Quiz Session Data
   */
  async function initQuizSession() {
    try {
      const payload = {
        collectionId: parseInt(collectionId, 10),
        questionCount: countParam ? parseInt(countParam, 10) : undefined,
        shuffle: shuffleParam === '1' || shuffleParam === 'true'
      };

      const response = await API.post('/api/quiz/start', payload);

      if (!response.success || !response.session) {
        throw new Error(response.error || 'Failed to initialize session');
      }

      session = response.session;
      questions = session.questions;

      quizTitle.textContent = session.collection.title;
      renderDotsNavigator();
      renderCurrentQuestion();

      // Initialize Timer if enabled
      initTimer();

    } catch (error) {
      console.error('Quiz initialization error:', error);
      alert('Unable to load quiz: ' + error.message);
      window.location.href = '/';
    }
  }

  /**
   * 5. Countdown Timer Management
   */
  function initTimer() {
    const timerMins = parseInt(timerParam, 10);
    if (!timerMins || timerMins <= 0) {
      if (timerWidget) timerWidget.style.display = 'none';
      return;
    }

    let remainingSeconds = timerMins * 60;
    timerWidget.style.display = 'inline-flex';

    function updateTimerDisplay() {
      const mins = Math.floor(remainingSeconds / 60);
      const secs = remainingSeconds % 60;
      const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      timerCountdown.textContent = formatted;

      if (remainingSeconds <= 20) {
        timerWidget.className = 'timer-badge danger';
      } else if (remainingSeconds <= 60) {
        timerWidget.className = 'timer-badge warning';
      } else {
        timerWidget.className = 'timer-badge';
      }
    }

    updateTimerDisplay();

    timerInterval = setInterval(() => {
      remainingSeconds--;
      updateTimerDisplay();

      if (remainingSeconds <= 0) {
        clearInterval(timerInterval);
        Utils.showToast('⏱ Time is up! Submitting your quiz automatically...', 'error');
        autoSubmitOnTimeUp();
      }
    }, 1000);
  }

  /**
   * Automatic Submission when Timer Expires
   */
  function autoSubmitOnTimeUp() {
    if (isSubmitting) return;
    executeSubmission();
  }

  /**
   * 6. Render Question Navigator Dots (Compact)
   */
  function renderDotsNavigator() {
    questionDots.innerHTML = '';
    questions.forEach((q, idx) => {
      const dot = document.createElement('button');
      dot.className = 'q-dot';
      dot.type = 'button';
      dot.textContent = idx + 1;
      dot.title = `Jump to Question ${idx + 1}`;
      dot.setAttribute('aria-label', `Question ${idx + 1}`);

      dot.addEventListener('click', () => {
        currentIndex = idx;
        renderCurrentQuestion();
      });

      questionDots.appendChild(dot);
    });
  }

  /**
   * 7. Render Active Question & Options (Zero-scroll design)
   */
  function renderCurrentQuestion() {
    if (questions.length === 0) return;

    const q = questions[currentIndex];
    const total = questions.length;

    // Progress updates
    const currentNum = currentIndex + 1;
    questionProgressText.textContent = `Q ${currentNum} of ${total}`;
    questionBadge.textContent = `QUESTION ${currentNum}`;
    quizProgressBar.style.width = `${(currentNum / total) * 100}%`;

    // Answered counter
    const answeredCount = Object.keys(userAnswers).length;
    answeredCounter.textContent = `${answeredCount}/${total} Answered`;

    // Update Dots
    const dots = questionDots.querySelectorAll('.q-dot');
    dots.forEach((dot, idx) => {
      const qId = questions[idx].id;
      dot.classList.toggle('active', idx === currentIndex);
      dot.classList.toggle('answered', Boolean(userAnswers[qId]));
    });

    if (dots[currentIndex]) {
      dots[currentIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    // Question Text
    questionText.textContent = q.questionText;

    // Render Options
    optionsList.innerHTML = '';
    const selectedOptId = userAnswers[q.id];

    q.options.forEach((opt, optIndex) => {
      const item = document.createElement('div');
      item.className = 'option-item';
      item.role = 'radio';
      item.setAttribute('aria-checked', selectedOptId === opt.id ? 'true' : 'false');
      item.tabIndex = 0;

      if (selectedOptId === opt.id) {
        item.classList.add('selected');
      }

      item.innerHTML = `
        <div class="option-indicator">${optionLetters[optIndex] || (optIndex + 1)}</div>
        <div class="option-text">${Utils.escapeHTML(opt.text)}</div>
      `;

      item.addEventListener('click', () => selectOption(q.id, opt.id));
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectOption(q.id, opt.id);
        }
      });

      optionsList.appendChild(item);
    });

    // Hint Handling
    if (q.hint && q.hint.trim() !== '') {
      hintSection.style.display = 'block';
      hintContent.textContent = q.hint;
      hintBox.style.display = 'none';
      toggleHintBtn.textContent = '💡 View Hint';
    } else {
      hintSection.style.display = 'none';
    }

    // Navigation buttons state
    prevBtn.disabled = currentIndex === 0;

    if (currentIndex === total - 1) {
      nextBtn.style.display = 'none';
      submitBtn.style.display = 'inline-flex';
    } else {
      nextBtn.style.display = 'inline-flex';
      submitBtn.style.display = 'none';
    }
  }

  /**
   * 8. Select an Option
   */
  function selectOption(questionId, optionId) {
    userAnswers[questionId] = optionId;
    renderCurrentQuestion();
  }

  /**
   * 9. Navigation Event Listeners
   */
  prevBtn.addEventListener('click', () => {
    if (currentIndex > 0) {
      currentIndex--;
      renderCurrentQuestion();
    }
  });

  nextBtn.addEventListener('click', () => {
    if (currentIndex < questions.length - 1) {
      currentIndex++;
      renderCurrentQuestion();
    }
  });

  // Toggle Hint
  toggleHintBtn.addEventListener('click', () => {
    if (hintBox.style.display === 'none') {
      hintBox.style.display = 'flex';
      toggleHintBtn.textContent = 'Hide Hint';
    } else {
      hintBox.style.display = 'none';
      toggleHintBtn.textContent = '💡 View Hint';
    }
  });

  /**
   * 10. Submit Confirmation & Handler
   */
  function openSubmitModal() {
    const total = questions.length;
    const answered = Object.keys(userAnswers).length;
    const unanswered = total - answered;

    submitModalSummary.textContent = `You have answered ${answered} of ${total} questions.`;

    if (unanswered > 0) {
      unansweredWarning.style.display = 'block';
      unansweredWarning.innerHTML = `⚠ <strong>Notice:</strong> You have <strong>${unanswered}</strong> unanswered question${unanswered > 1 ? 's' : ''}!`;
    } else {
      unansweredWarning.style.display = 'none';
    }

    submitModal.classList.add('active');
  }

  function closeSubmitModal() {
    submitModal.classList.remove('active');
  }

  submitBtn.addEventListener('click', openSubmitModal);
  submitModalClose.addEventListener('click', closeSubmitModal);
  submitModalCancel.addEventListener('click', closeSubmitModal);

  confirmSubmitBtn.addEventListener('click', () => {
    executeSubmission();
  });

  async function executeSubmission() {
    if (isSubmitting) return;
    isSubmitting = true;

    if (timerInterval) clearInterval(timerInterval);

    confirmSubmitBtn.disabled = true;
    confirmSubmitBtn.textContent = 'Submitting & Evaluating...';

    try {
      const answersPayload = questions.map(q => ({
        questionId: q.id,
        selectedOptionId: userAnswers[q.id] || null
      }));

      const submitData = {
        collectionId: session.collection.id,
        totalQuestions: questions.length,
        isShuffled: session.isShuffled,
        answers: answersPayload
      };

      const result = await API.post('/api/quiz/submit', submitData);

      if (!result.success) {
        throw new Error(result.error || 'Submission failed');
      }

      Utils.showToast('Quiz evaluated successfully! Loading results...', 'success');

      // Preserve query params including timer for replay
      const replayParams = new URLSearchParams({
        attemptId: result.attemptId,
        collectionId: session.collection.id,
        count: countParam || questions.length,
        shuffle: shuffleParam || '0',
        timer: timerParam || '0'
      });

      setTimeout(() => {
        window.location.href = `/results.html?${replayParams.toString()}`;
      }, 400);

    } catch (error) {
      console.error('Submission error:', error);
      alert('Error submitting quiz: ' + error.message);
      confirmSubmitBtn.disabled = false;
      confirmSubmitBtn.textContent = 'Yes, Submit Now';
      isSubmitting = false;
    }
  }

  /**
   * 11. Exit Modal Handlers
   */
  exitQuizBtn.addEventListener('click', (e) => {
    e.preventDefault();
    exitModal.classList.add('active');
  });

  exitModalClose.addEventListener('click', () => exitModal.classList.remove('active'));
  cancelExitBtn.addEventListener('click', () => exitModal.classList.remove('active'));

  /**
   * 12. Keyboard Shortcuts (1-4 for options, arrows for navigation)
   */
  document.addEventListener('keydown', (e) => {
    if (submitModal.classList.contains('active') || exitModal.classList.contains('active')) {
      if (e.key === 'Escape') {
        closeSubmitModal();
        exitModal.classList.remove('active');
      }
      return;
    }

    if (e.key === 'ArrowRight' && currentIndex < questions.length - 1) {
      currentIndex++;
      renderCurrentQuestion();
    } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
      currentIndex--;
      renderCurrentQuestion();
    } else if (['1', '2', '3', '4', 'a', 'b', 'c', 'd'].includes(e.key.toLowerCase())) {
      const q = questions[currentIndex];
      let optIdx = -1;
      if (['1', '2', '3', '4'].includes(e.key)) {
        optIdx = parseInt(e.key, 10) - 1;
      } else {
        optIdx = ['a', 'b', 'c', 'd'].indexOf(e.key.toLowerCase());
      }
      if (q && q.options[optIdx]) {
        selectOption(q.id, q.options[optIdx].id);
      }
    }
  });

  // Start initialization
  initQuizSession();
});
