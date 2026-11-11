/**
 * Patch script for admin.js:
 * 1. Remove broken colCategory.value reference from submit payload
 * 2. Add device-file cover image handlers (browse, preview, remove)
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public/js/admin.js');
let code = fs.readFileSync(filePath, 'utf8');

// --- Fix 1: Remove categoryId: colCategory.value from payload ---
// Replace the bad line with nothing (category removed)
code = code.replace(
  "categoryId: colCategory.value,\n      coverImage",
  "coverImage"
);
console.log('Fix 1 applied: removed categoryId from payload');

// --- Fix 2: Add cover image handlers if not already added ---
const markerText = '// ---- Cover Image: Device File picker & preview ----';
if (!code.includes(markerText)) {
  const insertAfter = "cancelCollectionBtn.addEventListener('click', closeCollectionModalFn);";

  const coverLogic = `

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
`;

  if (code.includes(insertAfter)) {
    code = code.replace(insertAfter, insertAfter + coverLogic);
    console.log('Fix 2 applied: cover image handlers added');
  } else {
    console.error('ERROR: Could not find insert point for cover image handlers!');
    process.exit(1);
  }
} else {
  console.log('Fix 2 skipped: cover image handlers already present');
}

// --- Fix 3: Also clear preview when modal is closed/reset ---
// Find the closeCollectionModalFn and add preview reset inside it
const closeFnTarget = "  function closeCollectionModalFn() {\n    collectionModal.classList.remove('active');\n  }";
const closeFnReplacement = `  function closeCollectionModalFn() {
    collectionModal.classList.remove('active');
    // Reset cover image preview on close
    if (colCover) colCover.value = '';
    if (colCoverFile) colCoverFile.value = '';
    if (coverPreviewImg) coverPreviewImg.src = '';
    if (coverPreviewWrap) coverPreviewWrap.style.display = 'none';
  }`;

if (code.includes(closeFnTarget)) {
  code = code.replace(closeFnTarget, closeFnReplacement);
  console.log('Fix 3 applied: preview reset on modal close');
} else {
  console.log('Fix 3 skipped: close function already updated or not found');
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('\nAll patches applied. File saved.');
