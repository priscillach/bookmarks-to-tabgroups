class BookmarksConverter {
  static async convertBookmarksToRules() {
    const rulesById = new Map();
    
    function extractHostname(rawURL) {
      try {
        const url = new URL(rawURL);
        let hostname = url.hostname;
        if (hostname.startsWith('www.')) {
          hostname = hostname.slice(4);
        }
        return hostname;
      } catch {
        return '';
      }
    }

    function generateRuleId() {
      return 'rule-' + Math.random().toString(36).substr(2, 8);
    }

    async function processBookmarks(bookmarks, folderName = 'Bookmarks Bar') {
      for (const bookmark of bookmarks) {
        if (bookmark.url) {
          const hostname = extractHostname(bookmark.url);
          if (hostname) {
            let rule = Array.from(rulesById.values())
              .find(r => r.groupName === folderName);
            
            if (!rule) {
              const ruleId = generateRuleId();
              rule = {
                id: ruleId,
                ruleName: folderName,
                groupName: folderName,
                urlMatches: []
              };
              rulesById.set(ruleId, rule);
            }

            if (!rule.urlMatches.some(match => match.value === hostname)) {
              rule.urlMatches.push({
                method: 'includes',
                target: 'hostname',
                value: hostname
              });
            }
          }
        }
        
        if (bookmark.children) {
          await processBookmarks(bookmark.children, bookmark.title);
        }
      }
    }

    try {
      const bookmarks = await chrome.bookmarks.getTree();
      await processBookmarks(bookmarks[0].children);

      return {
        meta: {
          name: "tab-groups-rules",
          version: 1
        },
        ...Object.fromEntries(rulesById)
      };
    } catch (error) {
      throw new Error('Failed to process Chrome bookmarks: ' + error.message);
    }
  }

  static async convertBookmarksFromHtml(bookmarksHtml) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(bookmarksHtml, 'text/html');
      const rulesById = new Map();
      const folderStack = [];

      function extractHostname(rawURL) {
        try {
          const url = new URL(rawURL);
          let hostname = url.hostname;
          if (hostname.startsWith('www.')) {
            hostname = hostname.slice(4);
          }
          return hostname;
        } catch {
          return '';
        }
      }

      function generateRuleId() {
        return 'rule-' + Math.random().toString(36).substr(2, 8);
      }

      function traverse(node) {
        if (node.tagName === 'H3') {
          folderStack.push(node.textContent);
        }

        if (node.tagName === 'A' && node.href) {
          const currentFolder = folderStack[folderStack.length - 1];
          if (currentFolder) {
            const hostname = extractHostname(node.href);
            if (hostname) {
              let rule = Array.from(rulesById.values())
                .find(r => r.groupName === currentFolder);
              
              if (!rule) {
                const ruleId = generateRuleId();
                rule = {
                  id: ruleId,
                  ruleName: currentFolder,
                  groupName: currentFolder,
                  urlMatches: []
                };
                rulesById.set(ruleId, rule);
              }

              if (!rule.urlMatches.some(match => match.value === hostname)) {
                rule.urlMatches.push({
                  method: 'includes',
                  target: 'hostname',
                  value: hostname
                });
              }
            }
          }
        }

        for (const child of node.children) {
          traverse(child);
        }

        if (node.tagName === 'DL' && folderStack.length > 0) {
          folderStack.pop();
        }
      }

      traverse(doc.body);

      return {
        meta: {
          name: "tab-groups-rules",
          version: 1
        },
        ...Object.fromEntries(rulesById)
      };
    } catch (error) {
      throw new Error('Failed to parse bookmarks HTML: ' + error.message);
    }
  }
} 