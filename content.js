// Mapping of emails to display names
const EMAIL_TO_NAME = {
  'alex.feng@databricks.com': 'Alex (the goat 🐐) Feng',
  'john.doe@databricks.com': 'John Doe',
  // Add more mappings as needed
};

// Function to replace email text with names
function replaceEmails() {
  // Find all elements that might contain email text
  // We use TreeWalker to find text nodes efficiently
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  const textNodes = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  // Replace emails in each text node
  textNodes.forEach(node => {
    let text = node.textContent;
    for (const [email, name] of Object.entries(EMAIL_TO_NAME)) {
      if (text.includes(email)) {
        text = text.replace(email, name);
      }
    }
    if (text !== node.textContent) {
      node.textContent = text;
    }
  });
}

// Run when page loads
replaceEmails();

// Also watch for dynamic content (Databricks uses React, so content loads async)
const observer = new MutationObserver(() => {
  replaceEmails();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

console.log('[Better DB History] Email replacement active');