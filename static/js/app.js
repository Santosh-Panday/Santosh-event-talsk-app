document.addEventListener('DOMContentLoaded', () => {
  // ==========================================================================
  // State Variables
  // ==========================================================================
  let allUpdates = [];
  let activeFilter = 'all';
  let searchQuery = '';
  let selectedId = null;

  // ==========================================================================
  // DOM Elements
  // ==========================================================================
  const refreshBtn = document.getElementById('refresh-btn');
  const refreshSpinner = document.getElementById('refresh-spinner');
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  const filterChips = document.getElementById('filter-chips');
  const releasesContainer = document.getElementById('releases-container');
  const statusBar = document.getElementById('status-bar');
  const resultsCount = document.getElementById('results-count');
  const lastUpdatedTime = document.getElementById('last-updated-time');
  
  // Selection Bar Elements
  const selectionBar = document.getElementById('selection-bar');
  const selectionCount = document.getElementById('selection-count');
  const tweetSelectionBtn = document.getElementById('tweet-selection-btn');
  const clearSelectionBtn = document.getElementById('clear-selection-btn');
  
  // Modal Elements
  const modal = document.getElementById('tweet-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const tweetTextarea = document.getElementById('tweet-textarea');
  const charCount = document.getElementById('char-count');
  const charProgressBar = document.getElementById('char-progress-bar');
  const tweetPreviewText = document.getElementById('tweet-preview-text');
  const tweetCancelBtn = document.getElementById('tweet-cancel-btn');
  const tweetSubmitBtn = document.getElementById('tweet-submit-btn');

  // ==========================================================================
  // Data Loading & API Integration
  // ==========================================================================
  async function loadData(forceRefresh = false) {
    // 1. Show loading state
    refreshBtn.disabled = true;
    refreshSpinner.classList.add('spinning');
    
    releasesContainer.innerHTML = `
      <div class="skeleton-container">
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
      </div>
    `;
    
    // Clear selection state
    clearSelection();
    
    try {
      const url = forceRefresh ? '/api/releases?refresh=true' : '/api/releases';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.status === 'success' || result.status === 'warning') {
        allUpdates = result.data;
        
        // Show status warnings if any (e.g. cache fallback warning)
        if (result.status === 'warning') {
          console.warn(result.message);
        }
        
        // Update Timestamp
        lastUpdatedTime.textContent = `Last updated: ${result.updated_at}`;
        statusBar.removeAttribute('hidden');
        
        // Render
        renderUpdates();
      } else {
        throw new Error(result.message || 'Unknown API error');
      }
      
    } catch (error) {
      console.error('Error loading BigQuery releases:', error);
      renderErrorState(error.message);
    } finally {
      // 2. Hide loading state
      refreshBtn.disabled = false;
      refreshSpinner.classList.remove('spinning');
    }
  }

  // ==========================================================================
  // Render Functions
  // ==========================================================================
  function renderUpdates() {
    // 1. Filter updates based on search and active category
    const filtered = allUpdates.filter(item => {
      const matchesSearch = item.text.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            item.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            item.date.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFilter = activeFilter === 'all' || item.type === activeFilter;
      
      return matchesSearch && matchesFilter;
    });
    
    // Update Results count
    resultsCount.textContent = `Showing ${filtered.length} update${filtered.length === 1 ? '' : 's'}`;
    
    // If no results
    if (filtered.length === 0) {
      renderEmptyState();
      return;
    }
    
    // Group updates by date
    const groupedByDate = {};
    filtered.forEach(item => {
      if (!groupedByDate[item.date]) {
        groupedByDate[item.date] = [];
      }
      groupedByDate[item.date].push(item);
    });
    
    // Render grouped date sections
    releasesContainer.innerHTML = '';
    
    // Note: The feed parses in order, so keys represent sorted dates (newest first)
    for (const date in groupedByDate) {
      const dateSection = document.createElement('div');
      dateSection.className = 'date-section';
      
      // Header for date
      const dateHeader = document.createElement('div');
      dateHeader.className = 'date-header';
      dateHeader.innerHTML = `
        <div class="date-dot" aria-hidden="true"></div>
        <h2>${date}</h2>
      `;
      dateSection.appendChild(dateHeader);
      
      // Cards container
      const cardsList = document.createElement('div');
      cardsList.className = 'cards-list';
      cardsList.style.display = 'flex';
      cardsList.style.flexDirection = 'column';
      cardsList.style.gap = '1.25rem';
      
      groupedByDate[date].forEach(item => {
        const card = document.createElement('article');
        card.className = `update-card ${selectedId === item.id ? 'selected' : ''}`;
        card.setAttribute('data-id', item.id);
        card.setAttribute('data-type', item.type);
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', `BigQuery Update: ${item.type} on ${item.date}`);
        
        // Card HTML
        card.innerHTML = `
          <div class="card-select-indicator">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          
          <div class="card-header">
            <span class="type-badge badge-${item.type.toLowerCase()}">${item.type}</span>
          </div>
          
          <div class="card-body">
            ${item.html}
          </div>
          
          <div class="card-footer">
            <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="reference-link" onclick="event.stopPropagation()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
              </svg>
              <span>docs.cloud.google.com</span>
            </a>
            <button class="card-tweet-btn" aria-label="Tweet about this specific update" onclick="event.stopPropagation()">
              <!-- Twitter Icon -->
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </button>
          </div>
        `;
        
        // Card interactions
        card.addEventListener('click', () => toggleCardSelection(item.id));
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleCardSelection(item.id);
          }
        });
        
        // Direct Card Tweet Button Interaction
        const tweetBtn = card.querySelector('.card-tweet-btn');
        tweetBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          selectCardDirectly(item.id);
          openTweetCompose();
        });
        
        cardsList.appendChild(card);
      });
      
      dateSection.appendChild(cardsList);
      releasesContainer.appendChild(dateSection);
    }
  }

  function renderEmptyState() {
    releasesContainer.innerHTML = `
      <div class="empty-state">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <h3>No matching updates found</h3>
        <p>Try refining your search terms or choosing a different filter category.</p>
        <button id="reset-filters-btn" class="btn btn-secondary">Reset Search & Filters</button>
      </div>
    `;
    
    document.getElementById('reset-filters-btn').addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      clearSearchBtn.setAttribute('hidden', '');
      
      // Reset filter chips
      document.querySelectorAll('.filter-chips .chip').forEach(c => c.classList.remove('active'));
      document.querySelector('.filter-chips .chip[data-filter="all"]').classList.add('active');
      activeFilter = 'all';
      
      renderUpdates();
    });
  }

  function renderErrorState(message) {
    releasesContainer.innerHTML = `
      <div class="empty-state" style="border-color: var(--color-issue);">
        <svg class="empty-icon" style="color: var(--color-issue);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h3>Failed to fetch releases</h3>
        <p>${message || 'Please check your connection and try again.'}</p>
        <button id="error-retry-btn" class="btn btn-primary">Try Again</button>
      </div>
    `;
    
    document.getElementById('error-retry-btn').addEventListener('click', () => {
      loadData(true);
    });
  }

  // ==========================================================================
  // Card Selection Mechanics
  // ==========================================================================
  function toggleCardSelection(id) {
    const prevSelected = selectedId;
    
    if (selectedId === id) {
      // Unselect
      selectedId = null;
    } else {
      // Select new, unselect previous
      selectedId = id;
    }
    
    // Update DOM classes
    document.querySelectorAll('.update-card').forEach(card => {
      const cardId = card.getAttribute('data-id');
      if (cardId === selectedId) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
    
    updateSelectionBar();
  }

  function selectCardDirectly(id) {
    selectedId = id;
    document.querySelectorAll('.update-card').forEach(card => {
      const cardId = card.getAttribute('data-id');
      if (cardId === selectedId) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
    updateSelectionBar();
  }

  function clearSelection() {
    selectedId = null;
    document.querySelectorAll('.update-card').forEach(card => {
      card.classList.remove('selected');
    });
    updateSelectionBar();
  }

  function updateSelectionBar() {
    if (selectedId) {
      selectionCount.textContent = '1 update selected';
      selectionBar.classList.add('active');
      selectionBar.removeAttribute('hidden');
      selectionBar.setAttribute('aria-hidden', 'false');
    } else {
      selectionBar.classList.remove('active');
      selectionBar.setAttribute('hidden', '');
      selectionBar.setAttribute('aria-hidden', 'true');
    }
  }

  // ==========================================================================
  // Tweet composer dialog
  // ==========================================================================
  function openTweetCompose() {
    if (!selectedId) return;
    
    const selectedItem = allUpdates.find(item => item.id === selectedId);
    if (!selectedItem) return;
    
    // Formulate a beautiful default tweet text
    // A tweet is max 280 chars. We need to leave space for tags and link.
    // Standard template: "📢 BigQuery [Type] ([Date]): [TextSnippet] [Link]"
    // Text snippet will be truncated dynamically to fit budget
    const prefix = `📢 BigQuery ${selectedItem.type} (${selectedItem.date}):\n"`;
    const suffix = `"\n\n${selectedItem.link}`;
    
    // Standard Twitter link is counted as 23 characters
    const linkBudget = 23;
    const metaLength = prefix.length + 3 + linkBudget; // 3 extra for quotes and newlines
    let maxSnippetLength = 280 - metaLength;
    
    if (maxSnippetLength < 40) maxSnippetLength = 40; // absolute minimum safeguard
    
    let textSnippet = selectedItem.text;
    if (textSnippet.length > maxSnippetLength) {
      textSnippet = textSnippet.substring(0, maxSnippetLength - 3) + '...';
    }
    
    const defaultTweetText = `${prefix}${textSnippet}${suffix}`;
    
    tweetTextarea.value = defaultTweetText;
    updateCharCount();
    
    // Open Dialog Modal
    modal.showModal();
  }

  function updateCharCount() {
    const text = tweetTextarea.value;
    const length = text.length;
    
    // Update text labels
    charCount.textContent = length;
    tweetPreviewText.textContent = text || "Compose your tweet...";
    
    // Update progress bar width and colors
    const percent = Math.min((length / 280) * 100, 100);
    charProgressBar.style.width = `${percent}%`;
    
    if (length > 280) {
      charProgressBar.className = 'char-progress-bar danger';
      charCount.style.color = 'var(--color-issue)';
      tweetSubmitBtn.disabled = true;
    } else if (length > 250) {
      charProgressBar.className = 'char-progress-bar warning';
      charCount.style.color = 'var(--color-deprecated)';
      tweetSubmitBtn.disabled = false;
    } else {
      charProgressBar.className = 'char-progress-bar';
      charCount.style.color = 'var(--text-muted)';
      tweetSubmitBtn.disabled = length === 0;
    }
  }

  // Handle outside click to close dialog (Light Dismiss Fallback)
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    modal.addEventListener('click', (event) => {
      if (event.target !== modal) return;
      
      const rect = modal.getBoundingClientRect();
      const isDialogContent = (
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      );
      
      if (isDialogContent) return;
      modal.close();
    });
  }

  // ==========================================================================
  // Event Listeners
  // ==========================================================================
  
  // Refresh click
  refreshBtn.addEventListener('click', () => loadData(true));
  
  // Search input change
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    if (searchQuery) {
      clearSearchBtn.removeAttribute('hidden');
    } else {
      clearSearchBtn.setAttribute('hidden', '');
    }
    renderUpdates();
  });
  
  // Clear search query button
  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.setAttribute('hidden', '');
    renderUpdates();
  });
  
  // Filter chips selection
  filterChips.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    
    // Toggle active state
    document.querySelectorAll('.filter-chips .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    
    activeFilter = chip.getAttribute('data-filter');
    renderUpdates();
  });
  
  // Selection floating bar actions
  tweetSelectionBtn.addEventListener('click', openTweetCompose);
  clearSelectionBtn.addEventListener('click', clearSelection);
  
  // Modal Actions
  closeModalBtn.addEventListener('click', () => modal.close());
  tweetCancelBtn.addEventListener('click', () => modal.close());
  
  tweetTextarea.addEventListener('input', updateCharCount);
  
  tweetSubmitBtn.addEventListener('click', () => {
    const tweetText = tweetTextarea.value;
    if (!tweetText || tweetText.length > 280) return;
    
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
    
    modal.close();
    clearSelection();
  });

  // ==========================================================================
  // Initial Run
  // ==========================================================================
  loadData();
});
