function showError(message) {
  const errorElement = document.getElementById('errorMessage');
  errorElement.textContent = message;
  errorElement.style.display = 'block';
  setTimeout(() => {
    errorElement.style.display = 'none';
  }, 5000); // 5秒后自动隐藏错误信息
}

function downloadRules(rules) {
  try {
    const blob = new Blob([JSON.stringify(rules, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const randomDigits = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    
    chrome.downloads.download({
      url: url,
      filename: `tabgroups_rules_${timestamp}_${randomDigits}.json`,
      saveAs: true
    }, () => {
      URL.revokeObjectURL(url);
    });
  } catch (error) {
    showError('Failed to download file: ' + error.message);
  }
}

// 直接转换当前书签
document.getElementById('convertButton').addEventListener('click', async () => {
  try {
    const rules = await BookmarksConverter.convertBookmarksToRules();
    if (Object.keys(rules).filter(key => key !== 'meta').length === 0) {
      throw new Error('No valid bookmarks found to convert');
    }
    downloadRules(rules);
  } catch (error) {
    showError('Error converting bookmarks: ' + error.message);
  }
});

// 从文件转换
document.getElementById('convertFileButton').addEventListener('click', async () => {
  const fileInput = document.getElementById('bookmarksFile');
  const file = fileInput.files[0];
  
  if (!file) {
    showError('Please select a bookmarks HTML file first');
    return;
  }

  try {
    const bookmarksHtml = await file.text();
    if (!bookmarksHtml.includes('<!DOCTYPE NETSCAPE-Bookmark-file-1>')) {
      throw new Error('Invalid bookmarks file format');
    }

    const rules = await BookmarksConverter.convertBookmarksFromHtml(bookmarksHtml);
    if (Object.keys(rules).filter(key => key !== 'meta').length === 0) {
      throw new Error('No valid bookmarks found in the file');
    }
    downloadRules(rules);
  } catch (error) {
    showError('Error processing file: ' + error.message);
  }
}); 