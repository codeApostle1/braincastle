/**
 * BrainCastle Admin / Creator Studio Controller
 * Full CRUD for Collections and Questions, Real-Time Publishing, and Interactive Previews
 */

document.addEventListener('DOMContentLoaded', async () => {
  let currentUser = null;
  let creatorCollections = [];
  let activeManagingCollection = null; // Currently opened collection in Question Manager
  let deleteTargetId = null;

  // DOM Elements
  const browseCoverBtn = document.getElementById('browseCoverBtn');
  const colCoverFile = document.getElementById('colCoverFile');
  const coverPreviewWrap = document.getElementById('coverPreviewWrap');
  const coverPreviewImg = document.getElementById('coverPreviewImg');
  const removeCoverBtn = document.getElementById('removeCoverBtn');
  const creatorNameText = document.getElementById('creatorNameText');
  const logoutBtn = document.getElementById('logoutBtn');
  const adminCollectionsList = document.getElementById('adminCollectionsList');
  const adminEmptyState = document.getElementById('adminEmptyState');
  const adminSearchInput = document.getElementById('adminSearchInput');
  const emptyCreateBtn = document.getElementById('emptyCreateBtn');

  // Stats Elements
  const statTotalCollections = document.getElementById('statTotalCollections');
  const statLiveQuizzes = document.getElementById('statLiveQuizzes');
  const statDraftQuizzes = document.getElementById('statDraftQuizzes');
  const statTotalQuestions = document.getElementById('statTotalQuestions');

  // Collection Modal Elements
  const openCreateCollectionBtn = document.getElementById('openCreateCollectionBtn');
  const collectionModal = document.getElementById('collectionModal');
  const closeCollectionModal = document.getElementById('closeCollectionModal');
  const cancelCollectionBtn = document.getElementById('cancelCollectionBtn');
  const collectionForm = document.getElementById('collectionForm');
  const collectionModalTitle = document.getElementById('collectionModalTitle');
  const editCollectionId = document.getElementById('editCollectionId');
  const colTitle = document.getElementById('colTitle');
  // Category dropdown removed per design change
  const colDesc = document.getElementById('colDesc');
  const colCover = document.getElementById('colCover');
  const colPublished = document.getElementById('colPublished');

  // Question Manager Modal Elements
  const questionManagerModal = document.getElementById('questionManagerModal');
  const closeQmModal = document.getElementById('closeQmModal');
  const closeQmFooterBtn = document.getElementById('closeQmFooterBtn');
  const qmModalTitle = document.getElementById('qmModalTitle');
  const qmModalSubtitle = document.getElementById('qmModalSubtitle');
  const qmQuestionCount = document.getElementById('qmQuestionCount');
  const toggleAddQuestionBtn = document.getElementById('toggleAddQuestionBtn');
  const questionFormBox = document.getElementById('questionFormBox');
  const qFormTitle = document.getElementById('qFormTitle');
  const editQuestionId = document.getElementById('editQuestionId');
  const qText = document.getElementById('qText');
  const qHint = document.getElementById('qHint');
  const qExplanation = document.getElementById('qExplanation');
  const cancelQuestionBtn = document.getElementById('cancelQuestionBtn');
  const saveQuestionBtn = document.getElementById('saveQuestionBtn');
  const qmQuestionsContainer = document.getElementById('qmQuestionsContainer');

  // Preview Modal Elements
  const previewModal = document.getElementById('previewModal');
  const closePreviewBtn = document.getElementById('closePreviewBtn');
  const closePreviewFooterBtn = document.getElementById('closePreviewFooterBtn');
  const previewTitle = document.getElementById('previewTitle');
  const previewQuestionsContainer = document.getElementById('previewQuestionsContainer');

  // Delete Modal Elements
  const deleteModal = document.getElementById('deleteModal');
  const closeDeleteModal = document.getElementById('closeDeleteModal');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  const deleteTargetTitle = document.getElementById('deleteTargetTitle');

  /**
   * 1. Authentication Check & Initialization
   */
  async function checkAuth() {
    try {
      const response = await API.get('/api/auth/me');
      if (!response.success || !response.user) {
        window.location.href = '/login.html';
        return;
      }
      currentUser = response.user;
      creatorNameText.textContent = currentUser.name || currentUser.email;

      await loadCreatorCollections();
    } catch (error) {
      console.error('Auth verification failed:', error);
      window.location.href = '/login.html';
    }
  }

  // Logout Handler
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await API.post('/api/auth/logout');
        Utils.showToast('Logged out successfully.', 'info');
        setTimeout(() => {
          window.location.href = '/login.html';
        }, 300);
      } catch (error) {
        alert('Logout failed: ' + error.message);
      }
    });
  }



  /**
   * 3. Load & Render Creator's Collections
   */
  async function loadCreatorCollections() {
    try {
      const response = await API.get('/api/collections/creator/mine');
      if (response.success) {
        creatorCollections = response.data || [];
        updateDashboardStats();
        renderCollectionsList();
      }
    } catch (error) {
      console.error('Error loading collections:', error);
      Utils.showToast('Could not load collections: ' + error.message, 'error');
    }
  }

  /**
   * 4. Update Stats Bar
   */
  function updateDashboardStats() {
    const total = creatorCollections.length;
    const live = creatorCollections.filter(c => c.is_published === 1).length;
    const drafts = total - live;
    const totalQ = creatorCollections.reduce((sum, c) => sum + (c.question_count || 0), 0);

    statTotalCollections.textContent = total;
    statLiveQuizzes.textContent = live;
    statDraftQuizzes.textContent = drafts;
    statTotalQuestions.textContent = totalQ;
  }

  /**
   * 5. Render Collections List
   */
  function renderCollectionsList() {
    const filterQuery = (adminSearchInput.value || '').trim().toLowerCase();
    const filtered = creatorCollections.filter(c => {
      if (!filterQuery) return true;
      return c.title.toLowerCase().includes(filterQuery) || (c.description || '').toLowerCase().includes(filterQuery);
    });

    if (filtered.length === 0) {
      adminCollectionsList.innerHTML = '';
      adminEmptyState.style.display = 'block';
      return;
    }

    adminEmptyState.style.display = 'none';
    adminCollectionsList.innerHTML = '';

    filtered.forEach(col => {
      const card = document.createElement('article');
      card.className = 'admin-collection-card animate-fade-in';

      const isLive = col.is_published === 1;
      const statusBadge = isLive
        ? `<span class="badge-live">● Live on Public Platform</span>`
        : `<span class="badge-draft">○ Draft (Hidden)</span>`;

      const cover = col.cover_image || 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=800&q=80';

      card.innerHTML = `
        <img src="${Utils.escapeHTML(cover)}" alt="${Utils.escapeHTML(col.title)}" class="admin-col-thumb" loading="lazy" />
        <div class="admin-col-content">
          <div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: 4px;">
            ${statusBadge}
          </div>
          <h3 class="admin-col-title">${Utils.escapeHTML(col.title)}</h3>
          <p class="admin-col-desc">${Utils.escapeHTML(col.description || 'No description provided.')}</p>
          <div class="admin-col-meta">
            <span>📝 <strong>${col.question_count}</strong> questions</span>
            <span>📅 ${Utils.formatDate(col.created_at)}</span>
          </div>
        </div>

        <div class="admin-col-actions">
          <button class="btn btn-primary btn-sm btn-manage-q" data-id="${col.id}">
            📝 Questions (${col.question_count})
          </button>
          <button class="btn btn-outline btn-sm btn-toggle-publish" data-id="${col.id}" title="${isLive ? 'Unpublish quiz' : 'Publish quiz'}">
            ${isLive ? 'Unpublish' : 'Publish'}
          </button>
          <button class="btn btn-secondary btn-sm btn-edit-col" data-id="${col.id}">
            ⚙ Edit
          </button>
          <button class="btn btn-secondary btn-sm btn-preview-col" data-id="${col.id}">
            👁 Preview
          </button>
          <button class="btn btn-outline btn-sm btn-delete-col" data-id="${col.id}" style="color: var(--color-danger); border-color: #fca5a5;">
            🗑
          </button>
        </div>
      `;

      // Event Listeners for Card Actions
      card.querySelector('.btn-manage-q').addEventListener('click', () => openQuestionManager(col.id));
      card.querySelector('.btn-toggle-publish').addEventListener('click', () => togglePublish(col.id));
      card.querySelector('.btn-edit-col').addEventListener('click', () => openEditCollectionModal(col));
      card.querySelector('.btn-preview-col').addEventListener('click', () => openPreviewModal(col.id));
      card.querySelector('.btn-delete-col').addEventListener('click', () => openDeleteModal(col));

      adminCollectionsList.appendChild(card);
    });
  }

  // Filter input debounced
  let searchTimeout = null;
  adminSearchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(renderCollectionsList, 250);
  });

  /**
   * 6. Create & Edit Collection Modal
   */
  function openCreateModal() {
    editCollectionId.value = '';
    collectionModalTitle.textContent = 'Create Quiz Collection';
    colTitle.value = '';
    colDesc.value = '';
    colCover.value = '';
    colPublished.checked = true;
    // No category dropdown; skip setting value
    collectionModal.classList.add('active');
    // Focus first input for better UX
    colTitle.focus();
  }

  function openEditCollectionModal(col) {
    editCollectionId.value = col.id;
    collectionModalTitle.textContent = 'Edit Quiz Collection';
    colTitle.value = col.title;
    colDesc.value = col.description || '';
    colCover.value = col.cover_image || '';
    // Category no longer used; ignore col.category_id
    colPublished.checked = col.is_published === 1;
    collectionModal.classList.add('active');
  }

  function closeCollectionModalFn() {
    collectionModal.classList.remove('active');
    // Reset cover image preview on close
    if (colCover) colCover.value = '';
    if (colCoverFile) colCoverFile.value = '';
    if (coverPreviewImg) coverPreviewImg.src = '';
    if (coverPreviewWrap) coverPreviewWrap.style.display = 'none';
  }

  openCreateCollectionBtn.addEventListener('click', openCreateModal);
  if (emptyCreateBtn) emptyCreateBtn.addEventListener('click', openCreateModal);
  closeCollectionModal.addEventListener('click', closeCollectionModalFn);
  cancelCollectionBtn.addEventListener('click', closeCollectionModalFn);

  // ---- Cover Image: Device File picker & preview ----
  // Click the visible "Device File" button => open the hidden file input
  if (browseCoverBtn) {
    browseCoverBtn.addEventListener('click', function() {
      colCoverFile.click();
    });
  }

  // When a file is selected, read it as a data-URL and show preview
  if (colCoverFile) {
    colCoverFile.addEventListener('change', function() {
      var file = colCoverFile.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(e) {
        // Store the data-URL so the form submit can send it
        colCover.value = e.target.result;
        coverPreviewImg.src = e.target.result;
        coverPreviewWrap.style.display = 'block';
      };
      reader.readAsDataURL(file);
    });
  }

  // Also show preview when user manually types a URL
  if (colCover) {
    colCover.addEventListener('input', function() {
      var url = colCover.value.trim();
      if (url) {
        coverPreviewImg.src = url;
        coverPreviewWrap.style.display = 'block';
      } else {
        coverPreviewWrap.style.display = 'none';
        coverPreviewImg.src = '';
      }
    });
  }

  // Remove button clears everything
  if (removeCoverBtn) {
    removeCoverBtn.addEventListener('click', function() {
      colCover.value = '';
      if (colCoverFile) colCoverFile.value = '';
      coverPreviewImg.src = '';
      coverPreviewWrap.style.display = 'none';
    });
  }
  // ---- End Cover Image Logic ----


  collectionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = editCollectionId.value;
    const payload = {
      title: colTitle.value.trim(),
      description: colDesc.value.trim(),
      coverImage: colCover.value.trim(),
      isPublished: colPublished.checked
    };

    try {
      if (id) {
        await API.put(`/api/collections/${id}`, payload);
        Utils.showToast('Collection updated successfully!', 'success');
      } else {
        await API.post('/api/collections', payload);
        Utils.showToast('New collection created!', 'success');
      }
      closeCollectionModalFn();
      await loadCreatorCollections();
    } catch (error) {
      alert('Error saving collection: ' + error.message);
    }
  });

  /**
   * 7. Toggle Publish / Unpublish Status
   */
  async function togglePublish(colId) {
    try {
      const response = await API.request(`/api/collections/${colId}/toggle-publish`, { method: 'PATCH' });
      if (response.success) {
        Utils.showToast(response.message, 'success');
        await loadCreatorCollections();
      }
    } catch (error) {
      alert('Could not update status: ' + error.message);
    }
  }

  /**
   * 8. Delete Collection
   */
  function openDeleteModal(col) {
    deleteTargetId = col.id;
    deleteTargetTitle.textContent = `"${col.title}"`;
    deleteModal.classList.add('active');
  }

  function closeDeleteModalFn() {
    deleteModal.classList.remove('active');
    deleteTargetId = null;
  }

  closeDeleteModal.addEventListener('click', closeDeleteModalFn);
  cancelDeleteBtn.addEventListener('click', closeDeleteModalFn);

  confirmDeleteBtn.addEventListener('click', async () => {
    if (!deleteTargetId) return;
    try {
      await API.delete(`/api/collections/${deleteTargetId}`);
      Utils.showToast('Collection deleted successfully.', 'info');
      closeDeleteModalFn();
      await loadCreatorCollections();
    } catch (error) {
      alert('Failed to delete: ' + error.message);
    }
  });

  /**
   * 9. Question Manager Implementation
   */
  async function openQuestionManager(collectionId) {
    try {
      const response = await API.get(`/api/collections/${collectionId}/manage`);
      if (!response.success) throw new Error(response.error);

      activeManagingCollection = response.collection;
      qmModalTitle.textContent = activeManagingCollection.title;
      qmModalSubtitle.textContent = `Category: ${activeManagingCollection.category_name} • Authoring Mode`;
      
      resetQuestionForm();
      renderQmQuestions();
      questionManagerModal.classList.add('active');

    } catch (error) {
      alert('Error loading questions: ' + error.message);
    }
  }

  function closeQmModalFn() {
    questionManagerModal.classList.remove('active');
    activeManagingCollection = null;
    loadCreatorCollections(); // Refresh question counts on dashboard
  }

  closeQmModal.addEventListener('click', closeQmModalFn);
  closeQmFooterBtn.addEventListener('click', closeQmModalFn);

  function renderQmQuestions() {
    if (!activeManagingCollection) return;
    const qs = activeManagingCollection.questions || [];
    qmQuestionCount.textContent = qs.length;

    if (qs.length === 0) {
      qmQuestionsContainer.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--color-text-secondary); background: var(--color-bg-surface); border-radius: var(--radius-md); border: 1px dashed var(--color-border);">
          No questions added yet. Click <strong>"➕ Add Question"</strong> above to create your first question!
        </div>
      `;
      return;
    }

    qmQuestionsContainer.innerHTML = '';
    qs.forEach((q, idx) => {
      const item = document.createElement('div');
      item.className = 'q-manager-item animate-fade-in';

      const correctOpt = q.options.find(o => o.isCorrect);
      const correctText = correctOpt ? correctOpt.text : 'None set';

      item.innerHTML = `
        <div class="q-manager-text">
          <div style="font-size: var(--font-size-xs); color: var(--color-primary); font-weight: 700; margin-bottom: 2px;">
            QUESTION ${idx + 1}
          </div>
          <div>${Utils.escapeHTML(q.question_text)}</div>
          <div style="font-size: 0.72rem; color: var(--color-success); font-weight: 600; margin-top: 4px;">
            ✔ Answer: ${Utils.escapeHTML(correctText)}
          </div>
        </div>
        <div style="display: flex; gap: var(--space-2); flex-shrink: 0;">
          <button class="btn btn-secondary btn-sm btn-edit-q" title="Edit Question">✏</button>
          <button class="btn btn-outline btn-sm btn-del-q" style="color: var(--color-danger); border-color: #fca5a5;" title="Delete Question">🗑</button>
        </div>
      `;

      item.querySelector('.btn-edit-q').addEventListener('click', () => startEditingQuestion(q));
      item.querySelector('.btn-del-q').addEventListener('click', () => deleteQuestion(q.id));

      qmQuestionsContainer.appendChild(item);
    });
  }

  function resetQuestionForm() {
    questionFormBox.style.display = 'none';
    editQuestionId.value = '';
    qText.value = '';
    qHint.value = '';
    qExplanation.value = '';
    document.getElementById('optText1').value = '';
    document.getElementById('optText2').value = '';
    document.getElementById('optText3').value = '';
    document.getElementById('optText4').value = '';
    document.getElementById('radioOpt1').checked = true;
  }

  toggleAddQuestionBtn.addEventListener('click', () => {
    resetQuestionForm();
    qFormTitle.textContent = 'Add New Question';
    questionFormBox.style.display = 'block';
    qText.focus();
  });

  cancelQuestionBtn.addEventListener('click', () => {
    resetQuestionForm();
  });

  function startEditingQuestion(q) {
    editQuestionId.value = q.id;
    qFormTitle.textContent = 'Edit Question';
    qText.value = q.question_text;
    qHint.value = q.hint || '';
    qExplanation.value = q.explanation || '';

    // Populate options
    const opts = q.options || [];
    for (let i = 0; i < 4; i++) {
      const opt = opts[i];
      const textInput = document.getElementById(`optText${i + 1}`);
      const radioInput = document.getElementById(`radioOpt${i + 1}`);
      if (opt) {
        textInput.value = opt.text;
        if (opt.isCorrect) radioInput.checked = true;
      } else {
        textInput.value = '';
      }
    }

    questionFormBox.style.display = 'block';
    questionFormBox.scrollIntoView({ behavior: 'smooth' });
  }

  saveQuestionBtn.addEventListener('click', async () => {
    const questionText = qText.value.trim();
    if (!questionText) {
      alert('Please enter question text.');
      return;
    }

    const options = [];
    const selectedCorrectIdx = document.querySelector('input[name="correctOption"]:checked').value;

    for (let i = 0; i < 4; i++) {
      const val = document.getElementById(`optText${i + 1}`).value.trim();
      if (!val) {
        alert(`Please fill in Option ${String.fromCharCode(65 + i)}`);
        return;
      }
      options.push({
        text: val,
        isCorrect: parseInt(selectedCorrectIdx, 10) === i
      });
    }

    const payload = {
      collectionId: activeManagingCollection.id,
      questionText,
      hint: qHint.value.trim(),
      explanation: qExplanation.value.trim(),
      options
    };

    const qId = editQuestionId.value;

    try {
      if (qId) {
        await API.put(`/api/questions/${qId}`, payload);
        Utils.showToast('Question updated!', 'success');
      } else {
        await API.post('/api/questions', payload);
        Utils.showToast('Question added!', 'success');
      }

      resetQuestionForm();
      // Reload this collection's questions
      const refreshed = await API.get(`/api/collections/${activeManagingCollection.id}/manage`);
      activeManagingCollection = refreshed.collection;
      renderQmQuestions();

    } catch (error) {
      alert('Error saving question: ' + error.message);
    }
  });

  async function deleteQuestion(questionId) {
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      await API.delete(`/api/questions/${questionId}`);
      Utils.showToast('Question deleted.', 'info');
      const refreshed = await API.get(`/api/collections/${activeManagingCollection.id}/manage`);
      activeManagingCollection = refreshed.collection;
      renderQmQuestions();
    } catch (error) {
      alert('Failed to delete question: ' + error.message);
    }
  }

  /**
   * 10. Quiz Preview Mode
   */
  async function openPreviewModal(collectionId) {
    try {
      const response = await API.get(`/api/collections/${collectionId}/manage`);
      if (!response.success) throw new Error(response.error);

      const col = response.collection;
      previewTitle.textContent = `Preview: ${col.title}`;
      const qs = col.questions || [];

      if (qs.length === 0) {
        previewQuestionsContainer.innerHTML = `
          <div style="text-align: center; padding: 2rem; color: var(--color-text-secondary);">
            This collection currently has no questions to preview.
          </div>
        `;
      } else {
        previewQuestionsContainer.innerHTML = qs.map((q, idx) => `
          <div style="background: var(--color-bg-muted); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-4); margin-bottom: var(--space-3);">
            <div style="font-size: 0.72rem; font-weight: 800; color: var(--color-primary); margin-bottom: 2px;">
              QUESTION ${idx + 1}
            </div>
            <div style="font-weight: 700; margin-bottom: var(--space-3);">${Utils.escapeHTML(q.question_text)}</div>
            <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: var(--space-2);">
              ${q.options.map(opt => `
                <div style="padding: 0.35rem 0.65rem; border-radius: var(--radius-sm); font-size: var(--font-size-xs); background: ${opt.isCorrect ? 'var(--color-success-light)' : 'var(--color-bg-surface)'}; border: 1px solid ${opt.isCorrect ? 'var(--color-success)' : 'var(--color-border)'}; font-weight: ${opt.isCorrect ? '700' : '500'}; display: flex; justify-content: space-between;">
                  <span>${Utils.escapeHTML(opt.text)}</span>
                  ${opt.isCorrect ? '<span style="color: var(--color-success);">✔ Correct</span>' : ''}
                </div>
              `).join('')}
            </div>
            ${q.hint ? `<div style="font-size: 0.72rem; color: #92400e; margin-top: 4px;">💡 <strong>Hint:</strong> ${Utils.escapeHTML(q.hint)}</div>` : ''}
            ${q.explanation ? `<div style="font-size: 0.72rem; color: var(--color-text-secondary); margin-top: 2px;">📖 <strong>Explanation:</strong> ${Utils.escapeHTML(q.explanation)}</div>` : ''}
          </div>
        `).join('');
      }

      previewModal.classList.add('active');
    } catch (error) {
      alert('Could not open preview: ' + error.message);
    }
  }

  function closePreviewModalFn() {
    previewModal.classList.remove('active');
  }

  closePreviewBtn.addEventListener('click', closePreviewModalFn);
  closePreviewFooterBtn.addEventListener('click', closePreviewModalFn);

  // Initialize
  checkAuth();
});
