(function() {
  // Application state
  const state = {
    userRole: localStorage.getItem('userRole') || 'student',
    stocks: [],
    portfolio: {},
    transactions: [],
  };

  // DOM utility
  function $(selector) {
    return document.querySelector(selector);
  }

  // Placeholder functions
  function initApp() {
    setupFeedbackSystem();
    setUserRole(state.userRole);
    renderStockList();
    renderPortfolio();
    renderTransactionFeed();
    handleTeacherControls();
    // Temporary role switcher for testing
    addRoleSwitcher();
  }

  function renderStockList() {
    // TODO: Render stock cards
  }

  function renderPortfolio() {
    const portfolioContainer = document.getElementById('portfolio-container');
    portfolioContainer.innerHTML = '';
    if (!userManager.currentUser) {
      portfolioContainer.innerHTML = '<p>Please log in to view your portfolio</p>';
      return;
    }
    if (userManager.isTeacher) {
      // Teacher view: render all student portfolios
      const students = gameState.getAllStudents();
      students.forEach(student => {
        const card = createPortfolioCard(student);
        portfolioContainer.appendChild(card);
      });
    } else {
      // Student view: render only own portfolio
      const student = gameState.getStudent(userManager.currentUser);
      if (student) {
        const card = createPortfolioCard(student);
        portfolioContainer.appendChild(card);
      }
    }
  }

  function displayTransactionHistory(transactions) {
    if (!transactions || transactions.length === 0) return '<em>No transactions yet.</em>';
    let html = '<table style="width:100%;font-size:0.95em;"><thead><tr><th>Type</th><th>Ticker</th><th>Qty</th><th>Price</th><th>Total</th><th>Time</th></tr></thead><tbody>';
    transactions.slice().reverse().forEach(tx => {
      html += `<tr>
        <td style="color:${tx.type === 'buy' ? '#4caf50' : '#f44336'};font-weight:bold;">${tx.type.toUpperCase()}</td>
        <td>${tx.ticker}</td>
        <td>${tx.quantity}</td>
        <td>$${tx.price.toFixed(2)}</td>
        <td>$${tx.total.toFixed(2)}</td>
        <td>${new Date(tx.timestamp).toLocaleString()}</td>
      </tr>`;
    });
    html += '</tbody></table>';
    return html;
  }

  function renderTransactionFeed() {
    const feedSection = document.getElementById('transaction-feed');
    feedSection.innerHTML = '';
    if (userManager.canViewAllStudentData()) {
      // Teacher: show all transactions
      const allTransactions = gameState.getAllStudents().flatMap(s => s.transactions || []);
      feedSection.innerHTML = displayTransactionHistory(allTransactions);
    } else if (userManager.canViewOwnPortfolio()) {
      // Student: show only own transactions
      const student = gameState.getStudent(userManager.currentUser);
      const txs = (student && student.transactions) || [];
      feedSection.innerHTML = displayTransactionHistory(txs);
    } else {
      feedSection.innerHTML = '<em>Access denied.</em>';
    }
  }

  function handleTeacherControls() {
    const controls = document.querySelector('[data-role="teacher"]');
    if (state.userRole === 'teacher') {
      controls.style.display = '';
    } else {
      controls.style.display = 'none';
    }
  }

  function setUserRole(role) {
    state.userRole = role;
    localStorage.setItem('userRole', role);
    handleTeacherControls();
  }

  function addRoleSwitcher() {
    const header = $('.header');
    if (!header) return;
    let switcher = document.createElement('div');
    switcher.style.marginTop = '1rem';
    switcher.innerHTML = `
      <button id="role-student">Student</button>
      <button id="role-teacher">Teacher</button>
    `;
    header.appendChild(switcher);
    $('#role-student').onclick = () => setUserRole('student');
    $('#role-teacher').onclick = () => setUserRole('teacher');
  }

  // GameState class for managing game state and students
  class GameState {
    constructor() {
      this.students = [];
      this.stocks = [];
      this.currentDay = 0;
      this.stockHistory = {};
      this.loadState();
    }

    loadState() {
      const savedState = localStorage.getItem('stockGameState');
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        this.students = parsedState.students || [];
        this.stocks = parsedState.stocks || [];
        this.currentDay = parsedState.currentDay || 0;
        this.stockHistory = parsedState.stockHistory || {};
      }
    }

    saveState() {
      try {
        localStorage.setItem('stockGameState', JSON.stringify({
          students: this.students,
          stocks: this.stocks,
          currentDay: this.currentDay,
          stockHistory: this.stockHistory
        }));
      } catch (e) {
        console.error('Failed to save game state:', e);
      }
    }

    // Student management methods
    addStudent(name) {
      if (this.students.some(s => s.name === name)) {
        throw new Error('Student name already exists');
      }
      const id = Date.now().toString();
      const student = {
        id,
        name,
        cash: 1000,
        portfolio: [] // { ticker, shares, avgPrice }
      };
      this.students.push(student);
      this.saveState();
      return student;
    }

    getStudent(id) {
      return this.students.find(s => s.id === id);
    }

    updateStudent(id, data) {
      const student = this.getStudent(id);
      if (!student) return null;
      Object.assign(student, data);
      this.saveState();
      return student;
    }

    getAllStudents() {
      return this.students;
    }

    // Stock price management methods
    updateStockPrices() {
      this.stocks.forEach(stock => {
        // Volatility: 1-3% per day, with 10% chance of a larger move (up to 10%)
        let volatility = Math.random() * 0.02 + 0.01; // 1-3%
        let direction = Math.random() < 0.5 ? -1 : 1;
        let percentChange = direction * volatility;
        if (Math.random() < 0.1) {
          // Occasional larger move
          percentChange = direction * (Math.random() * 0.07 + 0.03); // 3-10%
        }
        let newPrice = stock.price * (1 + percentChange);
        newPrice = Math.max(1, parseFloat(newPrice.toFixed(2))); // No negative prices
        stock.price = newPrice;
        this.updateStockHistory(stock.ticker, newPrice);
      });
      this.saveState();
    }

    getStockPrice(ticker) {
      const stock = this.stocks.find(s => s.ticker === ticker);
      return stock ? stock.price : null;
    }

    getStockHistory(ticker) {
      return this.stockHistory[ticker] || [];
    }

    updateStockHistory(ticker, price) {
      if (!this.stockHistory[ticker]) {
        this.stockHistory[ticker] = [];
      }
      this.stockHistory[ticker].push(price);
      // Keep only the last 100 days
      if (this.stockHistory[ticker].length > 100) {
        this.stockHistory[ticker] = this.stockHistory[ticker].slice(-100);
      }
    }

    // Transaction processing methods
    buyStock(studentId, ticker, shares) {
      const student = this.getStudent(studentId);
      const stock = this.stocks.find(s => s.ticker === ticker);
      if (!student || !stock || shares <= 0) throw new Error('Invalid transaction');
      const totalCost = stock.price * shares;
      if (student.cash < totalCost) throw new Error('Insufficient funds');
      // Find or create holding
      let holding = student.portfolio.find(h => h.ticker === ticker);
      if (!holding) {
        holding = { ticker, shares: 0, avgPrice: 0 };
        student.portfolio.push(holding);
      }
      // Update average price
      const prevValue = holding.shares * holding.avgPrice;
      holding.shares += shares;
      holding.avgPrice = (prevValue + totalCost) / holding.shares;
      student.cash -= totalCost;
      this.saveState();
      return { ...holding };
    }

    sellStock(studentId, ticker, shares) {
      const student = this.getStudent(studentId);
      const stock = this.stocks.find(s => s.ticker === ticker);
      if (!student || !stock || shares <= 0) throw new Error('Invalid transaction');
      let holding = student.portfolio.find(h => h.ticker === ticker);
      if (!holding || holding.shares < shares) throw new Error('Not enough shares');
      const totalProceeds = stock.price * shares;
      holding.shares -= shares;
      if (holding.shares === 0) {
        // Remove holding if no shares left
        student.portfolio = student.portfolio.filter(h => h.ticker !== ticker);
      }
      student.cash += totalProceeds;
      this.saveState();
      return totalProceeds;
    }

    // Game progression methods
    advanceDay() {
      this.stocks.forEach(stock => {
        // Random fluctuation between -10% and +10%
        const fluctuationPercent = (Math.random() * 20 - 10) / 100;
        const newPrice = stock.price * (1 + fluctuationPercent);
        stock.price = parseFloat(newPrice.toFixed(2));
        // Update stock history
        if (!this.stockHistory[stock.ticker]) {
          this.stockHistory[stock.ticker] = [];
        }
        this.stockHistory[stock.ticker].push(stock.price);
        // Keep only the last 100 days
        if (this.stockHistory[stock.ticker].length > 100) {
          this.stockHistory[stock.ticker].shift();
        }
      });
      this.currentDay += 1;
      this.saveState();
      this.notifyStateChange();
    }

    notifyStateChange() {
      this._notifyStateChange();
      const event = new CustomEvent('gamestatechange');
      document.dispatchEvent(event);
    }

    getGameDay() {
      return this.currentDay;
    }

    fastForward(days) {
      for (let i = 0; i < days; i++) {
        this.advanceDay();
      }
    }

    // Game reset, persistence, and error handling
    resetGame() {
      this.students = [];
      this.currentDay = 0;
      this.stocks = [];
      this.stockHistory = {};
      this.initializeStocks();
      this.saveState();
      this._notifyStateChange();
    }

    // State change callback system
    _callbacks = [];
    onStateChange(cb) {
      this._callbacks.push(cb);
    }
    _notifyStateChange() {
      this._callbacks.forEach(cb => cb(this));
    }

    // Backup and restore
    backupState() {
      return JSON.stringify({
        students: this.students,
        stocks: this.stocks,
        currentDay: this.currentDay,
        stockHistory: this.stockHistory
      });
    }
    restoreState(backup) {
      try {
        const parsed = JSON.parse(backup);
        this.students = parsed.students || [];
        this.stocks = parsed.stocks || [];
        this.currentDay = parsed.currentDay || 0;
        this.stockHistory = parsed.stockHistory || {};
        this.saveState();
        this._notifyStateChange();
      } catch (e) {
        console.error('Failed to restore game state:', e);
      }
    }
  }

  const gameState = new GameState();

  // UserManager class for handling login and roles
  class UserManager {
    constructor(gameState) {
      this.gameState = gameState;
      this.currentUser = null;
      this.isTeacher = false;
    }

    login(username) {
      if (!username) return false;
      if (username.toLowerCase() === 'teacher') {
        this.currentUser = 'teacher';
        this.isTeacher = true;
        return true;
      }
      // Check if student name already exists
      const existingStudent = this.gameState.students.find(s => s.name.toLowerCase() === username.toLowerCase());
      if (existingStudent) {
        this.currentUser = existingStudent.id;
        this.isTeacher = false;
        return true;
      }
      // Create new student
      try {
        const student = this.gameState.addStudent(username);
        this.currentUser = student.id;
        this.isTeacher = false;
        return true;
      } catch (e) {
        return false;
      }
    }

    logout() {
      this.currentUser = null;
      this.isTeacher = false;
    }

    getCurrentUserData() {
      if (!this.currentUser) return null;
      if (this.isTeacher) return { isTeacher: true };
      return this.gameState.getStudent(this.currentUser);
    }

    canAccessTeacherControls() {
      return this.isTeacher;
    }

    // Permission methods
    canViewAllStudentData() {
      return this.isTeacher;
    }
    canModifyMarketSettings() {
      return this.isTeacher;
    }
    canResetGame() {
      return this.isTeacher;
    }
    canTradeStocks() {
      return !this.isTeacher && !!this.currentUser;
    }
    canViewOwnPortfolio() {
      return !this.isTeacher && !!this.currentUser;
    }
    getRole() {
      return this.isTeacher ? 'teacher' : 'student';
    }
  }

  const userManager = new UserManager(gameState);

  // New login interface generation
  function setupLoginInterface() {
    const loginContainer = document.getElementById('login-container');
    if (!loginContainer) return;
    loginContainer.innerHTML = `
      <div class="login-form">
        <h2>Join Stock Market Game</h2>
        <p>Students: Enter your name to join</p>
        <p>Teachers: Enter 'teacher' to access teacher controls</p>
        <div class="form-group">
          <input type="text" id="username-input" placeholder="Enter your name" />
          <button id="login-btn">Join Game</button>
        </div>
        <p id="login-error" class="error-message"></p>
      </div>
    `;
    // Add event listeners for login
    const loginBtn = document.getElementById('login-btn');
    const usernameInput = document.getElementById('username-input');
    loginBtn.onclick = handleLogin;
    usernameInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        handleLogin();
      }
    });
  }

  function updateRoleSpecificUI() {
    // Teacher controls
    const controls = document.getElementById('controls');
    if (userManager.canModifyMarketSettings()) {
      controls.style.display = '';
      controls.classList.add('role-teacher');
    } else {
      controls.style.display = 'none';
      controls.classList.remove('role-teacher');
    }
    // Student portfolio and trading (example: portfolio section)
    const portfolio = document.getElementById('portfolio');
    if (userManager.canViewOwnPortfolio()) {
      portfolio.style.display = '';
      portfolio.classList.add('role-student');
    } else {
      portfolio.style.display = 'none';
      portfolio.classList.remove('role-student');
    }
    // Add more UI updates for other sections as needed
  }

  // Update user info panel with role
  function updateUserInfoUI() {
    const userInfo = document.getElementById('user-info');
    const roleIndicator = document.getElementById('role-indicator');
    if (!userManager.currentUser) {
      userInfo.style.display = 'none';
      return;
    }
    userInfo.style.display = '';
    roleIndicator.textContent = userManager.isTeacher ? 'Role: Teacher' : 'Role: Student';
    // Visual indicator
    roleIndicator.style.fontWeight = 'bold';
    roleIndicator.style.color = userManager.isTeacher ? 'var(--accent-color)' : 'var(--text-color)';
  }

  function renderTeacherDashboard() {
    const dashboard = document.getElementById('teacher-dashboard');
    if (!userManager.canAccessTeacherControls()) {
      dashboard.style.display = 'none';
      return;
    }
    dashboard.style.display = '';
    // Students list
    const studentsDiv = document.getElementById('dashboard-students');
    const students = gameState.getAllStudents();
    studentsDiv.innerHTML = '<h3>Students</h3>' + (students.length ? students.map(student => `<div><strong>${student.name}</strong>: $${student.cash.toFixed(2)} | Portfolio: ${student.portfolio.map(h => `${h.shares}x ${h.ticker}`).join(', ') || 'None'}</div>`).join('') : '<em>No students yet.</em>');
    // Transactions
    const txDiv = document.getElementById('dashboard-transactions');
    const allTx = students.flatMap(s => s.transactions || []);
    txDiv.innerHTML = '<h3>All Transactions</h3>' + (allTx.length ? allTx.map(t => `<div>${t}</div>`).join('') : '<em>No transactions yet.</em>');
    // Controls
    const controlsDiv = document.getElementById('dashboard-controls');
    controlsDiv.innerHTML = `<button id="reset-game-btn">Reset Game</button>`;
    document.getElementById('reset-game-btn').onclick = function() {
      if (confirm('Are you sure you want to reset the game? This will clear all data.')) {
        gameState.resetGame();
        renderTeacherDashboard();
        renderPortfolio();
        renderTransactionFeed();
      }
    };
  }

  // Register renderStockCards as a state change callback
  gameState.onStateChange(renderStockCards);

  // Show feedback message
  function showFeedback(message, type = 'info') {
    const feedbackEl = document.getElementById('feedback');
    if (!feedbackEl) return;
    feedbackEl.textContent = message;
    feedbackEl.className = `feedback ${type}`;
    feedbackEl.style.display = 'block';
    feedbackEl.classList.add('feedback-show');

    // Remove any previous hide animation
    feedbackEl.classList.remove('feedback-hide');

    // Auto-hide after 3 seconds
    clearTimeout(feedbackEl._hideTimeout);
    feedbackEl._hideTimeout = setTimeout(() => {
      feedbackEl.classList.remove('feedback-show');
      feedbackEl.classList.add('feedback-hide');
      setTimeout(() => {
        feedbackEl.style.display = 'none';
        feedbackEl.classList.remove('feedback-hide');
      }, 300); // Match transition duration
    }, 3000);
  }

  // Setup teacher controls for advancing day
  function setupTeacherControls() {
    const teacherControlsContainer = document.getElementById('controls');
    if (!teacherControlsContainer) return;
    teacherControlsContainer.innerHTML = `
      <div class="teacher-controls-panel">
        <h3>Teacher Controls</h3>
        <div class="controls-buttons">
          <button id="next-day-btn" class="control-btn">Advance to Next Day</button>
          <button id="reset-game-btn" class="control-btn danger">Reset Game</button>
        </div>
        <div class="game-info">
          <p>Current Day: <span id="current-day">0</span></p>
        </div>
      </div>
    `;
    // Add event listener for advancing the day
    const nextDayBtn = document.getElementById('next-day-btn');
    if (nextDayBtn) {
      nextDayBtn.onclick = () => {
        if (userManager.canAccessTeacherControls()) {
          gameState.advanceDay();
          showFeedback('Advanced to next day', 'success');
        } else {
          showFeedback('Only teachers can advance the day', 'error');
        }
      };
    }
    // Add event listener for resetting the game
    const resetGameBtn = document.getElementById('reset-game-btn');
    if (resetGameBtn) {
      resetGameBtn.onclick = () => {
        if (userManager.canAccessTeacherControls()) {
          if (confirm('Are you sure you want to reset the game? All progress will be lost.')) {
            localStorage.removeItem('stockGameState');
            location.reload();
          }
        } else {
          showFeedback('Only teachers can reset the game', 'error');
        }
      };
    }
  }

  // Add dynamic day display and visibility updates
  const currentDayDisplay = document.getElementById('current-day');
  function updateDayDisplay() {
    if (currentDayDisplay) {
      currentDayDisplay.textContent = gameState.currentDay;
    }
  }
  updateDayDisplay();
  document.addEventListener('gamestatechange', updateDayDisplay);

  function updateControlsVisibility() {
    if (userManager.canAccessTeacherControls()) {
      teacherControlsContainer.style.display = 'block';
    } else {
      teacherControlsContainer.style.display = 'none';
    }
  }
  updateControlsVisibility();
  document.addEventListener('userchange', updateControlsVisibility);

  function setupReportButtons() {
    const studentReportBtn = document.getElementById('student-report-btn');
    const teacherReportBtn = document.getElementById('teacher-report-btn');
    if (!studentReportBtn || !teacherReportBtn) return;
    function updateReportButtonsVisibility() {
      if (!userManager.currentUser) {
        studentReportBtn.style.display = 'none';
        teacherReportBtn.style.display = 'none';
      } else if (userManager.isTeacher) {
        studentReportBtn.style.display = 'none';
        teacherReportBtn.style.display = 'inline-block';
      } else {
        studentReportBtn.style.display = 'inline-block';
        teacherReportBtn.style.display = 'none';
      }
    }
    // Initial visibility
    updateReportButtonsVisibility();
    // Listen for login/logout and role changes
    document.addEventListener('userchange', updateReportButtonsVisibility);
    // Also update after login/logout
    if (window._reportBtnVisibilityHandler) {
      document.removeEventListener('userchange', window._reportBtnVisibilityHandler);
    }
    window._reportBtnVisibilityHandler = updateReportButtonsVisibility;
    // Attach event listeners
    studentReportBtn.onclick = generateStudentReport;
    teacherReportBtn.onclick = generateTeacherReport;
  }

  function handleLogin() {
    const username = document.getElementById('username-input').value.trim();
    const errorDiv = document.getElementById('login-error');
    if (!username) {
      errorDiv.textContent = 'Please enter a name.';
      errorDiv.style.display = 'block';
      return;
    }
    const success = userManager.login(username);
    if (!success) {
      errorDiv.textContent = 'Name already exists or invalid.';
      errorDiv.style.display = 'block';
      return;
    }
    errorDiv.style.display = 'none';
    // Hide login, show game UI
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('game-container').style.display = '';
    // Update user display (if needed)
    const currentUserSpan = document.getElementById('current-user');
    if (currentUserSpan) {
      currentUserSpan.textContent = username;
    }
    updateRoleSpecificUI();
    handleTeacherControls();
    renderTeacherDashboard();
    renderStockCards();
    setupTeacherControls();
    setupReportButtons();
    // Dispatch custom event for user change
    document.dispatchEvent(new CustomEvent('userchange'));
  }

  function handleLogout() {
    userManager.logout();
    // Show login, hide game UI
    document.getElementById('login-container').style.display = '';
    document.getElementById('game-container').style.display = 'none';
    // Clear user display
    const currentUserSpan = document.getElementById('current-user');
    if (currentUserSpan) {
      currentUserSpan.textContent = '';
    }
    updateRoleSpecificUI();
    renderTeacherDashboard();
    renderStockCards();
    setupReportButtons();
    // Reset login form
    setupLoginInterface();
    // Dispatch custom event for user change
    document.dispatchEvent(new CustomEvent('userchange'));
  }

  document.addEventListener('DOMContentLoaded', function() {
    setupLoginInterface();
    document.getElementById('logout-btn').onclick = handleLogout;
    // Initially, show login and hide game UI
    document.getElementById('login-container').style.display = '';
    document.getElementById('game-container').style.display = 'none';
  });

  document.addEventListener('DOMContentLoaded', initApp);

  // Price change calculation logic for stock cards
  function getPriceChangeInfo(ticker) {
    const history = gameState.stockHistory[ticker] || [];
    const currentPrice = gameState.getStockPrice(ticker);
    const previousPrice = history.length > 1 ? history[history.length - 2] : history[0] || currentPrice;
    const priceChange = currentPrice - previousPrice;
    const percentChange = previousPrice ? ((priceChange / previousPrice) * 100).toFixed(2) : '0.00';
    const isPositive = priceChange >= 0;
    return { priceChange, percentChange, isPositive, previousPrice };
  }

  // Mini chart rendering function for stock cards
  function renderMiniChart(ticker, priceHistory) {
    const chartContainer = document.getElementById(`chart-${ticker}`);
    if (!chartContainer) return;
    chartContainer.innerHTML = '';
    // Simple canvas-based line chart
    const canvas = document.createElement('canvas');
    canvas.width = 150;
    canvas.height = 50;
    chartContainer.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    // Get the last 30 days (or all if less than 30)
    const dataPoints = priceHistory.slice(-30);
    if (dataPoints.length < 2) return;
    // Find min and max for scaling
    const min = Math.min(...dataPoints) * 0.95;
    const max = Math.max(...dataPoints) * 1.05;
    // Draw chart
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 2;
    ctx.beginPath();
    dataPoints.forEach((price, index) => {
      const x = (index / (dataPoints.length - 1)) * width;
      const y = height - ((price - min) / (max - min)) * height;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    // Add min/max labels
    ctx.fillStyle = '#aaa';
    ctx.font = '8px Arial';
    ctx.fillText(`$${max.toFixed(2)}`, 0, 10);
    ctx.fillText(`$${min.toFixed(2)}`, 0, height - 2);
  }

  // Buy/Sell button handlers
  function handleBuyStock(ticker) {
    const quantity = parseInt(prompt(`How many shares of ${ticker} do you want to buy?`));
    if (!validateBuyTransaction(ticker, quantity)) {
      return;
    }
    const stock = gameState.stocks.find(s => s.ticker === ticker);
    const student = gameState.getStudent(userManager.currentUser);
    const totalCost = stock.price * quantity;
    // Find or create holding
    let holding = student.portfolio.find(h => h.ticker === ticker);
    if (!holding) {
      holding = { ticker, shares: 0, avgPrice: 0 };
      student.portfolio.push(holding);
    }
    // Update average price
    const prevValue = holding.shares * holding.avgPrice;
    holding.shares += quantity;
    holding.avgPrice = (prevValue + totalCost) / holding.shares;
    student.cash -= totalCost;
    student.cash = parseFloat(student.cash.toFixed(2));
    // Log transaction
    if (!student.transactions) student.transactions = [];
    student.transactions.push({
      type: 'buy',
      ticker,
      quantity,
      price: stock.price,
      total: totalCost,
      timestamp: new Date().toISOString()
    });
    gameState.saveState();
    gameState.notifyStateChange();
    showFeedback(`Successfully bought ${quantity} shares of ${ticker}`, 'success');
  }
  function handleSellStock(ticker) {
    const quantity = parseInt(prompt(`How many shares of ${ticker} do you want to sell?`));
    if (!validateSellTransaction(ticker, quantity)) {
      return;
    }
    const stock = gameState.stocks.find(s => s.ticker === ticker);
    const student = gameState.getStudent(userManager.currentUser);
    let holding = student.portfolio.find(h => h.ticker === ticker);
    const totalValue = stock.price * quantity;
    holding.shares -= quantity;
    if (holding.shares === 0) {
      student.portfolio = student.portfolio.filter(h => h.ticker !== ticker);
    }
    student.cash += totalValue;
    student.cash = parseFloat(student.cash.toFixed(2));
    // Log transaction
    if (!student.transactions) student.transactions = [];
    student.transactions.push({
      type: 'sell',
      ticker,
      quantity,
      price: stock.price,
      total: totalValue,
      timestamp: new Date().toISOString()
    });
    gameState.saveState();
    gameState.notifyStateChange();
    showFeedback(`Successfully sold ${quantity} shares of ${ticker}`, 'success');
  }

  // Render stock cards with buy/sell button event listeners
  function renderStockCards() {
    const stocksContainer = document.getElementById('stocks-container');
    stocksContainer.innerHTML = '';
    gameState.stocks.forEach(stock => {
      const history = gameState.stockHistory[stock.ticker] || [];
      const { priceChange, percentChange, isPositive } = getPriceChangeInfo(stock.ticker);
      const card = document.createElement('div');
      card.className = 'stock-card';
      card.innerHTML = `
        <div class="stock-info">
          <h3>${stock.ticker}</h3>
          <p class="stock-name">${stock.name}</p>
          <p class="stock-price">$${stock.price.toFixed(2)}</p>
          <p class="price-change ${isPositive ? 'positive' : 'negative'}">
            ${isPositive ? '▲' : '▼'} ${Math.abs(percentChange)}%
          </p>
        </div>
        <div class="stock-chart" id="chart-${stock.ticker}"></div>
        <div class="stock-actions">
          <button class="buy-btn" data-ticker="${stock.ticker}">Buy</button>
          <button class="sell-btn" data-ticker="${stock.ticker}">Sell</button>
        </div>
      `;
      stocksContainer.appendChild(card);
      renderMiniChart(stock.ticker, history);
    });
    // Add event listeners for buy/sell buttons
    document.querySelectorAll('.buy-btn').forEach(btn => {
      btn.addEventListener('click', () => handleBuyStock(btn.dataset.ticker));
    });
    document.querySelectorAll('.sell-btn').forEach(btn => {
      btn.addEventListener('click', () => handleSellStock(btn.dataset.ticker));
    });
  }

  // UI update mechanism: update all components on game state change
  document.addEventListener('gamestatechange', () => {
    renderStockCards();
    renderPortfolio();
    renderTransactionFeed();
    renderTeacherDashboard();
    renderLeaderboard();
  });

  // Transaction validation logic
  function validateBuyTransaction(ticker, quantity) {
    if (!userManager.currentUser || userManager.isTeacher) {
      showFeedback('You must be logged in as a student to buy stocks', 'error');
      return false;
    }
    const stock = gameState.stocks.find(s => s.ticker === ticker);
    if (!stock) {
      showFeedback('Stock not found', 'error');
      return false;
    }
    if (isNaN(quantity) || quantity <= 0) {
      showFeedback('Please enter a valid quantity', 'error');
      return false;
    }
    const student = gameState.getStudent(userManager.currentUser);
    const totalCost = stock.price * quantity;
    if (!student || student.cash < totalCost) {
      showFeedback('Insufficient funds', 'error');
      return false;
    }
    return true;
  }

  function validateSellTransaction(ticker, quantity) {
    if (!userManager.currentUser || userManager.isTeacher) {
      showFeedback('You must be logged in as a student to sell stocks', 'error');
      return false;
    }
    const stock = gameState.stocks.find(s => s.ticker === ticker);
    if (!stock) {
      showFeedback('Stock not found', 'error');
      return false;
    }
    if (isNaN(quantity) || quantity <= 0) {
      showFeedback('Please enter a valid quantity', 'error');
      return false;
    }
    const student = gameState.getStudent(userManager.currentUser);
    const holding = student && student.portfolio.find(h => h.ticker === ticker);
    const sharesOwned = holding ? holding.shares : 0;
    if (!student || sharesOwned < quantity) {
      showFeedback(`You only have ${sharesOwned} shares to sell`, 'error');
      return false;
    }
    return true;
  }

  function calculatePortfolioValue(student) {
    let value = 0;
    if (!student || !student.portfolio) return 0;
    for (const holding of student.portfolio) {
      const stock = gameState.stocks.find(s => s.ticker === holding.ticker);
      if (stock) {
        value += stock.price * holding.shares;
      }
    }
    return parseFloat(value.toFixed(2));
  }

  function renderHoldings(student) {
    if (!student.portfolio || student.portfolio.length === 0) {
      return '<li>No stocks owned</li>';
    }
    let holdingsHTML = '';
    for (const holding of student.portfolio) {
      const stock = gameState.stocks.find(s => s.ticker === holding.ticker);
      if (stock) {
        const value = stock.price * holding.shares;
        holdingsHTML += `
          <li>
            <span class="holding-ticker">${holding.ticker}</span>
            <span class="holding-quantity">${holding.shares} shares</span>
            <span class="holding-value">$${value.toFixed(2)}</span>
          </li>
        `;
      }
    }
    return holdingsHTML;
  }

  function createPortfolioCard(student) {
    const portfolioValue = calculatePortfolioValue(student);
    const totalValue = portfolioValue + student.cash;
    const card = document.createElement('div');
    card.className = 'portfolio-card';
    card.innerHTML = `
      <h3>${student.name}'s Portfolio</h3>
      <p class="portfolio-value">Total Value: $${totalValue.toFixed(2)}</p>
      <p class="cash-balance">Cash: $${student.cash.toFixed(2)}</p>
      <p class="stock-value">Stock Value: $${portfolioValue.toFixed(2)}</p>
      <div class="holdings">
        <h4>Holdings</h4>
        <ul class="holdings-list">
          ${renderHoldings(student)}
        </ul>
      </div>
    `;
    return card;
  }

  function getVisibleTransactions() {
    let transactions = [];
    if (!userManager.currentUser) return transactions;
    if (userManager.isTeacher) {
      gameState.getAllStudents().forEach(student => {
        const studentTransactions = (student.transactions || []).map(t => ({ ...t, student: student.name }));
        transactions = transactions.concat(studentTransactions);
      });
    } else {
      const student = gameState.getStudent(userManager.currentUser);
      if (student) {
        transactions = student.transactions || [];
      }
    }
    transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return transactions;
  }

  function renderTransactions() {
    const transactionsContainer = document.getElementById('transactions-container');
    transactionsContainer.innerHTML = '';
    if (!userManager.currentUser) {
      transactionsContainer.innerHTML = '<p>Please log in to view transactions</p>';
      return;
    }
    const transactions = getVisibleTransactions();
    const transactionsList = document.createElement('div');
    transactionsList.className = 'transactions-list';
    if (transactions.length === 0) {
      transactionsList.innerHTML = '<p>No transactions yet</p>';
    } else {
      transactions.forEach(transaction => {
        const transactionItem = document.createElement('div');
        transactionItem.className = `transaction-item ${transaction.type}`;
        const date = new Date(transaction.timestamp);
        const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
        transactionItem.innerHTML = `
          <div class="transaction-header">
            <span class="transaction-type">${transaction.type.toUpperCase()}</span>
            <span class="transaction-time">${formattedDate}</span>
          </div>
          <div class="transaction-details">
            <span class="transaction-ticker">${transaction.ticker}</span>
            <span class="transaction-quantity">${transaction.quantity} shares</span>
            <span class="transaction-price">$${transaction.price.toFixed(2)}/share</span>
            <span class="transaction-total">Total: $${transaction.total.toFixed(2)}</span>
          </div>
          ${userManager.isTeacher && transaction.student ? `<div class="transaction-student">Student: ${transaction.student}</div>` : ''}
        `;
        transactionsList.appendChild(transactionItem);
      });
    }
    transactionsContainer.appendChild(transactionsList);
  }

  function renderLeaderboard() {
    const leaderboardContainer = document.getElementById('leaderboard-container');
    if (!userManager.canAccessTeacherControls()) {
      leaderboardContainer.style.display = 'none';
      return;
    }
    leaderboardContainer.style.display = 'block';
    leaderboardContainer.innerHTML = '<h2>Leaderboard</h2>';
    const studentsWithValue = gameState.getAllStudents().map(student => {
      const portfolioValue = calculatePortfolioValue(student);
      return {
        name: student.name,
        cash: student.cash,
        portfolioValue: portfolioValue,
        totalValue: portfolioValue + student.cash
      };
    });
    studentsWithValue.sort((a, b) => b.totalValue - a.totalValue);
    const leaderboardTable = document.createElement('table');
    leaderboardTable.className = 'leaderboard-table';
    leaderboardTable.innerHTML = `
      <thead>
        <tr>
          <th>Rank</th>
          <th>Student</th>
          <th>Cash</th>
          <th>Portfolio Value</th>
          <th>Total Value</th>
        </tr>
      </thead>
      <tbody>
        ${studentsWithValue.map((student, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${student.name}</td>
            <td>$${student.cash.toFixed(2)}</td>
            <td>$${student.portfolioValue.toFixed(2)}</td>
            <td>$${student.totalValue.toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    `;
    leaderboardContainer.appendChild(leaderboardTable);
  }

  // Helper functions for report generation
  function formatCurrency(value) {
    return `$${Number(value).toFixed(2)}`;
  }
  function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleString();
  }
  function escapeCsv(value) {
    if (typeof value !== 'string') value = String(value);
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
  }

  function generateStudentReport() {
    if (!userManager.currentUser || userManager.isTeacher) {
      showFeedback('You must be logged in as a student to download your report', 'error');
      return;
    }
    const student = gameState.getStudent(userManager.currentUser);
    if (!student) return;
    let csvContent = 'data:text/csv;charset=utf-8,';
    // Portfolio summary
    csvContent += 'PORTFOLIO SUMMARY\n';
    csvContent += 'Student Name,Cash Balance,Portfolio Value,Total Value\n';
    const portfolioValue = calculatePortfolioValue(student);
    const totalValue = portfolioValue + student.cash;
    csvContent += `${escapeCsv(student.name)},${formatCurrency(student.cash)},${formatCurrency(portfolioValue)},${formatCurrency(totalValue)}\n\n`;
    // Holdings
    csvContent += 'HOLDINGS\n';
    csvContent += 'Ticker,Quantity,Current Price,Total Value\n';
    for (const holding of student.portfolio || []) {
      const stock = gameState.stocks.find(s => s.ticker === holding.ticker);
      if (stock) {
        const value = stock.price * holding.shares;
        csvContent += `${escapeCsv(holding.ticker)},${holding.shares},${formatCurrency(stock.price)},${formatCurrency(value)}\n`;
      }
    }
    csvContent += '\n';
    // Transactions
    csvContent += 'TRANSACTION HISTORY\n';
    csvContent += 'Date,Type,Ticker,Quantity,Price,Total\n';
    const sortedTransactions = [...(student.transactions || [])].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    sortedTransactions.forEach(transaction => {
      const date = formatDate(transaction.timestamp);
      csvContent += `${escapeCsv(date)},${escapeCsv(transaction.type)},${escapeCsv(transaction.ticker)},${transaction.quantity},${formatCurrency(transaction.price)},${formatCurrency(transaction.total)}\n`;
    });
    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${student.name}_stock_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function generateTeacherReport() {
    if (!userManager.isTeacher) {
      showFeedback('Only teachers can download the full report', 'error');
      return;
    }
    let csvContent = 'data:text/csv;charset=utf-8,';
    // Game summary
    csvContent += 'STOCK MARKET GAME REPORT\n';
    csvContent += `Day: ${gameState.currentDay}\n\n`;
    // Leaderboard
    csvContent += 'LEADERBOARD\n';
    csvContent += 'Rank,Student Name,Cash Balance,Portfolio Value,Total Value\n';
    const studentsWithValue = gameState.getAllStudents().map(student => {
      const portfolioValue = calculatePortfolioValue(student);
      return {
        name: student.name,
        cash: student.cash,
        portfolioValue: portfolioValue,
        totalValue: portfolioValue + student.cash
      };
    });
    studentsWithValue.sort((a, b) => b.totalValue - a.totalValue);
    studentsWithValue.forEach((student, index) => {
      csvContent += `${index + 1},${escapeCsv(student.name)},${formatCurrency(student.cash)},${formatCurrency(student.portfolioValue)},${formatCurrency(student.totalValue)}\n`;
    });
    csvContent += '\n';
    // Current stock prices
    csvContent += 'CURRENT STOCK PRICES\n';
    csvContent += 'Ticker,Name,Price\n';
    gameState.stocks.forEach(stock => {
      csvContent += `${escapeCsv(stock.ticker)},${escapeCsv(stock.name)},${formatCurrency(stock.price)}\n`;
    });
    csvContent += '\n';
    // Individual student reports
    gameState.getAllStudents().forEach(student => {
      csvContent += `STUDENT: ${escapeCsv(student.name)}\n`;
      csvContent += 'Holdings:\n';
      csvContent += 'Ticker,Quantity,Current Price,Total Value\n';
      for (const holding of student.portfolio || []) {
        const stock = gameState.stocks.find(s => s.ticker === holding.ticker);
        if (stock) {
          const value = stock.price * holding.shares;
          csvContent += `${escapeCsv(holding.ticker)},${holding.shares},${formatCurrency(stock.price)},${formatCurrency(value)}\n`;
        }
      }
      csvContent += '\n';
    });
    // All transactions
    csvContent += 'ALL TRANSACTIONS\n';
    csvContent += 'Date,Student,Type,Ticker,Quantity,Price,Total\n';
    let allTransactions = [];
    gameState.getAllStudents().forEach(student => {
      const studentTransactions = (student.transactions || []).map(t => ({ ...t, student: student.name }));
      allTransactions = allTransactions.concat(studentTransactions);
    });
    allTransactions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    allTransactions.forEach(transaction => {
      const date = formatDate(transaction.timestamp);
      csvContent += `${escapeCsv(date)},${escapeCsv(transaction.student)},${escapeCsv(transaction.type)},${escapeCsv(transaction.ticker)},${transaction.quantity},${formatCurrency(transaction.price)},${formatCurrency(transaction.total)}\n`;
    });
    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `stock_game_full_report_day_${gameState.currentDay}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function setupFeedbackSystem() {
    if (!document.getElementById('feedback')) {
      const feedbackEl = document.createElement('div');
      feedbackEl.id = 'feedback';
      feedbackEl.className = 'feedback';
      document.body.appendChild(feedbackEl);
    }
  }
})(); 