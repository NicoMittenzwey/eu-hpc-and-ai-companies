/**
 * EU HPC & AI Company Database - Script
 */

let companies = [];
let activeFilters = {
    search: '',
    countries: new Set(),
    focus: new Set(),
    techs: new Set()
};

// --- Initialization ---

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('companies.csv');
        const csvText = await response.text();
        companies = parseCSV(csvText);

        initializeFilters();
        renderCompanies();
        setupEventListeners();
    } catch (error) {
        console.error('Error loading companies:', error);
    }
});

// --- CSV Parsing ---

function parseCSV(text) {
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;

    // Split by lines but respect quotes
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"' && inQuotes && nextChar === '"') {
            // Escaped quote
            currentField += '"';
            i++;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            currentRow.push(currentField.trim());
            currentField = '';
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (currentField || currentRow.length > 0) {
                currentRow.push(currentField.trim());
                rows.push(currentRow);
            }
            currentRow = [];
            currentField = '';
            if (char === '\r' && nextChar === '\n') i++; // Skip \n after \r
        } else {
            currentField += char;
        }
    }

    // Last field/row
    if (currentField || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
    }

    const headers = rows[0];
    return rows.slice(1).map(row => {
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = row[index] || '';
        });
        return obj;
    });
}

// --- Filter & UI Logic ---

function initializeFilters() {
    const countries = [...new Set(companies.map(c => c['Country of HQ']))].sort();
    const focusAreas = [...new Set(companies.map(c => c['Primary Focus']?.split(';')[0]?.trim()))].filter(Boolean).sort();

    // Technologies are often multiple tags separated by ;
    const allTechs = new Set();
    companies.forEach(c => {
        c['Technologies']?.split(';').forEach(t => {
            if (t.trim()) allTechs.add(t.trim());
        });
    });
    const topTechs = [...allTechs].sort();

    renderFilterGroup('country-filters', countries, 'countries');
    renderFilterGroup('focus-filters', focusAreas, 'focus');
    renderFilterGroup('tech-filters', topTechs, 'techs');
}

function renderFilterGroup(containerId, items, filterKey) {
    const container = document.getElementById(containerId);
    container.innerHTML = items.map(item => `
        <label class="filter-item">
            <input type="checkbox" value="${item}" data-key="${filterKey}">
            <span>${item}</span>
        </label>
    `).join('');
}

function renderCompanies() {
    const grid = document.getElementById('company-grid');
    const filtered = companies
        .filter(company => {
            // Search filter
            const searchMatches = !activeFilters.search ||
                Object.values(company).some(val =>
                    String(val).toLowerCase().includes(activeFilters.search.toLowerCase())
                );

            // Category filters
            const countryMatches = activeFilters.countries.size === 0 ||
                activeFilters.countries.has(company['Country of HQ']);

            const focusMatches = activeFilters.focus.size === 0 ||
                [...activeFilters.focus].some(f => company['Primary Focus']?.includes(f));

            const techMatches = activeFilters.techs.size === 0 ||
                [...activeFilters.techs].every(t => company['Technologies']?.includes(t));

            return searchMatches && countryMatches && focusMatches && techMatches;
        })
        .sort((a, b) => a['Company Name'].localeCompare(b['Company Name']));

    document.getElementById('results-count').textContent = `Showing ${filtered.length} companies`;

    grid.innerHTML = filtered.map(company => `
        <div class="company-card glass">
            <div class="card-inner" onclick="showCompanyDetails('${company['Company Name']}')">
                <div class="card-header">
                    <img src="${company['Logo']}" alt="" class="company-logo" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221%22 height=%221%22%3E%3C/svg%3E'">
                    <div class="card-title">
                        <h2>${company['Company Name']}</h2>
                        <div class="company-country">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                            ${company['Country of HQ']}
                        </div>
                    </div>
                </div>
                <div class="card-description">
                    ${company['Short Description (about 500 words)']?.substring(0, 150)}...
                </div>
            </div>
            <div class="card-tags">
                ${renderTags(company)}
            </div>
        </div>
    `).join('');
}

function renderTags(company) {
    const techs = company['Technologies']?.split(';').slice(0, 3) || [];
    const focus = company['Primary Focus']?.split(';')[0];

    let html = focus ? `<span class="tag tag-focus" onclick="setQuickSearch('${focus.trim()}')">${focus}</span>` : '';
    html += techs.map(t => t.trim() ? `<span class="tag" onclick="setQuickSearch('${t.trim()}')">${t.trim()}</span>` : '').join('');
    return html;
}

function setupEventListeners() {
    // Global Search
    const searchInput = document.getElementById('global-search');
    searchInput.addEventListener('input', (e) => {
        activeFilters.search = e.target.value;
        renderCompanies();
    });

    // Checkbox Filters
    document.querySelectorAll('.filter-options input').forEach(input => {
        input.addEventListener('change', (e) => {
            const ley = e.target.dataset.key;
            const val = e.target.value;
            if (e.target.checked) {
                activeFilters[ley].add(val);
            } else {
                activeFilters[ley].delete(val);
            }
            renderCompanies();
        });
    });

    // Modal Close
    const closeModal = () => {
        const modal = document.getElementById('company-modal');
        if (modal && modal.style.display !== 'none') {
            modal.style.display = 'none';
            // If we are in a modal state in history, go back
            if (history.state && history.state.modal) {
                history.back();
            }
        }
    };
    window.closeModal = closeModal;

    document.querySelector('.close-modal').addEventListener('click', closeModal);

    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            closeModal();
        }
    });

    // Handle Browser Back Button
    window.addEventListener('popstate', (event) => {
        const modal = document.getElementById('company-modal');
        if (modal && (!event.state || !event.state.modal)) {
            modal.style.display = 'none';
        }
    });
}

// --- Details Modal ---

function showCompanyDetails(name) {
    const company = companies.find(c => c['Company Name'] === name);
    if (!company) return;

    const modal = document.getElementById('company-modal');
    const body = document.getElementById('modal-body');

    body.innerHTML = `
        <div class="modal-header">
            <img src="${company['Logo']}" alt="" class="company-logo" style="width: 120px; height: 120px;" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221%22 height=%221%22%3E%3C/svg%3E'">
            <div style="display: flex; flex-direction: column; justify-content: center;">
                <h1 style="font-size: 2.5rem; margin-bottom: 0.5rem;">${name}</h1>
                <p style="color: var(--accent-blue); font-weight: 600;">${company['Legal Entity Name']}</p>
                <a href="${company['Website']}" target="_blank" style="color: var(--text-secondary); text-decoration: none; display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                    Visit Website
                </a>
            </div>
        </div>

        <div class="modal-info-grid">
            <div class="info-item"><label>Headquarters</label><span>${company['Country of HQ']}</span></div>
            <div class="info-item"><label>Year Founded</label><span>${company['Year Founded']}</span></div>
            <div class="info-item"><label>Company Size</label><span>${company['Company Size (# Employees)']} employees</span></div>
            <div class="info-item"><label>Primary Focus</label><span>${company['Primary Focus']}</span></div>
            <div class="info-item"><label>Contact Email</label><span>${company['Contact Email']}</span></div>
            <div class="info-item"><label>Updated</label><span>${company['Last Update of this Information']}</span></div>
        </div>

        <div class="filter-group">
            <h3>Technologies & Subdomains</h3>
            <div class="card-tags">
                ${(company['Technologies'] + ';' + company['Subdomains']).split(';').map(t => t.trim() ? `<span class="tag tag-focus" style="font-size: 0.9rem;" onclick="setQuickSearch('${t.trim()}')">${t.trim()}</span>` : '').join('')}
            </div>
        </div>

        <div style="margin-top: 2rem;">
            <h3>Description</h3>
            <div class="modal-description">${company['Short Description (about 500 words)']?.split('\n').map(p => p.trim() ? `<p style="margin-bottom: 1rem;">${p.trim()}</p>` : '').join('')}</div>
        </div>
    `;

    modal.style.display = 'flex';

    // Update Browser History
    if (!history.state || !history.state.modal) {
        history.pushState({ modal: true, company: name }, "");
    }
}

function setQuickSearch(term) {
    const searchInput = document.getElementById('global-search');
    searchInput.value = term;
    activeFilters.search = term;

    // Close modal if open
    if (window.closeModal) window.closeModal();

    // Scroll to top to see results
    window.scrollTo({ top: 0, behavior: 'smooth' });

    renderCompanies();
}

window.showCompanyDetails = showCompanyDetails;
window.setQuickSearch = setQuickSearch;

// --- Statistics Logic ---

function switchView(view) {
    const searchView = document.getElementById('search-view');
    const statsView = document.getElementById('stats-view');
    const filters = document.querySelector('.filters');
    const btns = document.querySelectorAll('.nav-btn');
    const searchContainer = document.querySelector('.search-container');

    btns.forEach(btn => {
        btn.classList.toggle('active', btn.innerText.toLowerCase() === view);
    });

    if (view === 'stats') {
        searchView.style.display = 'none';
        statsView.style.display = 'block';
        filters.style.visibility = 'hidden';
        searchContainer.style.opacity = '0';
        searchContainer.style.pointerEvents = 'none';
        renderStats();
    } else {
        searchView.style.display = 'block';
        statsView.style.display = 'none';
        filters.style.visibility = 'visible';
        searchContainer.style.opacity = '1';
        searchContainer.style.pointerEvents = 'auto';
    }
}

function renderStats() {
    const grid = document.getElementById('stats-grid');
    
    // 1. Country Distribution
    const countries = {};
    companies.forEach(c => {
        const hq = c['Country of HQ'];
        countries[hq] = (countries[hq] || 0) + 1;
    });
    const sortedCountries = Object.entries(countries).sort((a, b) => b[1] - a[1]).slice(0, 8);

    // 2. Primary Focus Distribution
    const focus = {};
    companies.forEach(c => {
        const pf = c['Primary Focus'];
        focus[pf] = (focus[pf] || 0) + 1;
    });
    const sortedFocus = Object.entries(focus).sort((a, b) => b[1] - a[1]).slice(0, 8);

    // 3. Year Founded distribution
    const decades = {};
    companies.forEach(c => {
        const year = parseInt(c['Year Founded']);
        if (year) {
            const decade = Math.floor(year / 10) * 10 + 's';
            decades[decade] = (decades[decade] || 0) + 1;
        }
    });

    grid.innerHTML = `
        <div class="stats-card glass">
            <h3>Top Countries <small>By Company HQ</small></h3>
            <div class="chart-container">
                ${sortedCountries.map(([name, count]) => `
                    <div class="chart-row">
                        <span class="chart-label">${name}</span>
                        <div class="chart-bar-bg">
                            <div class="chart-bar-fill" style="width: ${(count / sortedCountries[0][1]) * 100}%"></div>
                        </div>
                        <span class="chart-value">${count}</span>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="stats-card glass">
            <h3>Primary Focus <small>Market Specialization</small></h3>
            <div class="chart-container">
                ${sortedFocus.map(([name, count]) => `
                    <div class="chart-row">
                        <span class="chart-label">${name}</span>
                        <div class="chart-bar-bg">
                            <div class="chart-bar-fill" style="width: ${(count / sortedFocus[0][1]) * 100}%"></div>
                        </div>
                        <span class="chart-value">${count}</span>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="stats-card glass" style="grid-column: span 1;">
            <h3>Key Metrics <small>Ecosystem Vitality</small></h3>
            <div class="metric-grid">
                <div class="metric-item">
                    <span class="metric-value">${companies.length}</span>
                    <span class="metric-label">Total Companies</span>
                </div>
                <div class="metric-item">
                    <span class="metric-value">${Object.keys(countries).length}</span>
                    <span class="metric-label">Countries Represented</span>
                </div>
                <div class="metric-item">
                    <span class="metric-value">${Math.round(companies.reduce((a, b) => a + (parseInt(b['Company Size (# Employees)']) || 0), 0) / companies.length)}</span>
                    <span class="metric-label">Avg. Team Size</span>
                </div>
                <div class="metric-item">
                    <span class="metric-value">${Object.keys(decades).length}</span>
                    <span class="metric-label">Decades of Innovation</span>
                </div>
            </div>
        </div>

        <div class="stats-card glass">
            <h3>Founding History <small>Growth Over Time</small></h3>
            <div class="chart-container">
                ${Object.entries(decades).sort((a, b) => a[0].localeCompare(b[0])).map(([name, count]) => `
                    <div class="chart-row">
                        <span class="chart-label">${name}</span>
                        <div class="chart-bar-bg">
                            <div class="chart-bar-fill" style="color: white; width: ${(count / Math.max(...Object.values(decades))) * 100}%"></div>
                        </div>
                        <span class="chart-value">${count}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

window.switchView = switchView;
