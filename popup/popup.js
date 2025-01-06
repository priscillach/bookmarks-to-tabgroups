document.addEventListener('DOMContentLoaded', function() {
    // 直接转换当前书签
    document.getElementById('convertButton').addEventListener('click', () => {
        chrome.tabs.create({ 
            url: chrome.runtime.getURL('bookmarks/bookmarks.html')
        });
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
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                if (!content.includes('<!DOCTYPE NETSCAPE-Bookmark-file-1>')) {
                    showError('Invalid bookmarks file format');
                    return;
                }
                
                chrome.tabs.create({ 
                    url: chrome.runtime.getURL('bookmarks/bookmarks.html') + 
                         '?source=file&content=' + encodeURIComponent(content)
                });
            };
            reader.readAsText(file);
        } catch (error) {
            showError('Error processing file: ' + error.message);
        }
    });

    function showError(message) {
        const errorElement = document.getElementById('errorMessage');
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    }
}); 