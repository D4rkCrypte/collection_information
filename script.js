// Configuration de l'application
const CONFIG = {
    ADMIN_USERNAME: 'DANIEL',
    ADMIN_PASSWORD: '!@dk615536!@',
    STORAGE_KEY: 'cyberguard4all_data',
    AUTH_KEY: 'cyberguard4all_auth'
};

// Classe pour gérer la base de données locale
class LocalDatabase {
    constructor() {
        this.storageKey = CONFIG.STORAGE_KEY;
        this.initDatabase();
    }

    initDatabase() {
        if (!localStorage.getItem(this.storageKey)) {
            localStorage.setItem(this.storageKey, JSON.stringify({
                surveys: [],
                stats: {
                    totalResponses: 0,
                    totalCountries: 0,
                    avgAwareness: 0,
                    regions: {},
                    solutions: {},
                    organizationTypes: {},
                    incidents: [],
                    trainingNeeds: {},
                    supportNeeds: {},
                    awarenessDistribution: {},
                    recentActivity: []
                }
            }));
        }
    }

    getData() {
        return JSON.parse(localStorage.getItem(this.storageKey)) || { surveys: [], stats: {} };
    }

    saveData(data) {
        localStorage.setItem(this.storageKey, JSON.stringify(data));
    }

    addSurvey(surveyData) {
        const data = this.getData();
        const survey = {
            id: Date.now().toString(),
            ...surveyData,
            timestamp: new Date().toISOString(),
            date: new Date().toLocaleDateString('fr-FR'),
            time: new Date().toLocaleTimeString('fr-FR')
        };
        
        data.surveys.push(survey);
        this.updateStats(data);
        this.saveData(data);
        
        window.dispatchEvent(new CustomEvent('surveyAdded', { detail: survey }));
        return survey;
    }

    updateStats(data) {
        const surveys = data.surveys;
        const stats = {
            totalResponses: surveys.length,
            totalCountries: new Set(surveys.map(s => s.country)).size,
            avgAwareness: surveys.length > 0 ? 
                (surveys.reduce((sum, s) => sum + parseInt(s.cybersecurityAwareness || 0), 0) / surveys.length).toFixed(1) : 0,
            regions: {},
            solutions: {},
            organizationTypes: {},
            incidents: [],
            trainingNeeds: {},
            supportNeeds: {},
            awarenessDistribution: {},
            recentActivity: []
        };

        surveys.forEach(survey => {
            stats.regions[survey.region] = (stats.regions[survey.region] || 0) + 1;
            stats.organizationTypes[survey.organizationType] = (stats.organizationTypes[survey.organizationType] || 0) + 1;
            stats.incidents.push(parseInt(survey.incidentsLast12Months || 0));
            
            const awareness = survey.cybersecurityAwareness || '0';
            stats.awarenessDistribution[awareness] = (stats.awarenessDistribution[awareness] || 0) + 1;
            
            if (Array.isArray(survey.solutionsUsed)) {
                survey.solutionsUsed.forEach(solution => {
                    stats.solutions[solution] = (stats.solutions[solution] || 0) + 1;
                });
            }
            
            if (Array.isArray(survey.trainingNeeds)) {
                survey.trainingNeeds.forEach(need => {
                    stats.trainingNeeds[need] = (stats.trainingNeeds[need] || 0) + 1;
                });
            }
            
            if (Array.isArray(survey.supportNeeds)) {
                survey.supportNeeds.forEach(need => {
                    stats.supportNeeds[need] = (stats.supportNeeds[need] || 0) + 1;
                });
            }
        });

        stats.recentActivity = surveys.slice(-10).reverse().map(survey => ({
            id: survey.id,
            date: survey.date,
            time: survey.time,
            country: survey.country,
            region: survey.region,
            organizationType: survey.organizationType || 'N/A',
            awareness: survey.cybersecurityAwareness || '0',
            incidents: survey.incidentsLast12Months || '0',
            solutionsUsed: survey.solutionsUsed || []
        }));

        data.stats = stats;
    }

    getSurveys() {
        return this.getData().surveys;
    }

    getStats() {
        return this.getData().stats;
    }

    getSurveysByRegion(region) {
        return this.getSurveys().filter(survey => survey.region === region);
    }

    getSurveysByCountry(country) {
        return this.getSurveys().filter(survey => survey.country === country);
    }

    getTopCountries(limit = 5) {
        const surveys = this.getSurveys();
        const countryCount = {};
        surveys.forEach(survey => {
            countryCount[survey.country] = (countryCount[survey.country] || 0) + 1;
        });
        
        return Object.entries(countryCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit)
            .map(([country, count]) => ({ country, count }));
    }

    getIncidentStats() {
        const surveys = this.getSurveys();
        const incidents = surveys.map(s => parseInt(s.incidentsLast12Months || 0));
        return {
            total: incidents.reduce((sum, inc) => sum + inc, 0),
            average: incidents.length > 0 ? (incidents.reduce((sum, inc) => sum + inc, 0) / incidents.length).toFixed(1) : 0,
            max: incidents.length > 0 ? Math.max(...incidents) : 0,
            distribution: incidents.reduce((acc, inc) => {
                acc[inc] = (acc[inc] || 0) + 1;
                return acc;
            }, {})
        };
    }

    deleteSurvey(surveyId) {
        const data = this.getData();
        const surveyIndex = data.surveys.findIndex(survey => survey.id === surveyId);
        
        if (surveyIndex !== -1) {
            data.surveys.splice(surveyIndex, 1);
            this.updateStats(data);
            this.saveData(data);
            window.dispatchEvent(new CustomEvent('surveyDeleted', { detail: { surveyId } }));
            return true;
        }
        return false;
    }

    exportToCSV() {
        const surveys = this.getSurveys();
        if (surveys.length === 0) return '';

        const headers = [
            'Date', 'Heure', 'Région', 'Pays', "Type d'organisation", "Taille d'organisation",
            'Niveau de sensibilisation', 'Solutions utilisées', 'Incidents (12 mois)',
            'Besoins en formation', 'Besoins en support', 'Commentaires'
        ];

        const escapeCsvValue = (value) => {
            if (typeof value === 'string') {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        };

        const csvContent = [
            headers.join(','),
            ...surveys.map(survey => [
                survey.date,
                survey.time,
                survey.region,
                survey.country,
                survey.organizationType,
                survey.organizationSize,
                survey.cybersecurityAwareness,
                Array.isArray(survey.solutionsUsed) ? escapeCsvValue(survey.solutionsUsed.join('; ')) : escapeCsvValue(survey.solutionsUsed || ''),
                survey.incidentsLast12Months,
                Array.isArray(survey.trainingNeeds) ? escapeCsvValue(survey.trainingNeeds.join('; ')) : escapeCsvValue(survey.trainingNeeds || ''),
                Array.isArray(survey.supportNeeds) ? escapeCsvValue(survey.supportNeeds.join('; ')) : escapeCsvValue(survey.supportNeeds || ''),
                escapeCsvValue(survey.additionalComments || '')
            ].join(','))
        ].join('\n');

        return csvContent;
    }

    exportToJSON() {
        return JSON.stringify(this.getData(), null, 2);
    }
}

// Classe pour gérer l'authentification
class AuthManager {
    constructor() {
        this.isAuthenticated = false;
        this.checkAuthStatus();
    }

    checkAuthStatus() {
        const authData = localStorage.getItem(CONFIG.AUTH_KEY);
        if (authData) {
            const auth = JSON.parse(authData);
            const now = Date.now();
            if (auth.expiresAt > now) {
                this.isAuthenticated = true;
            } else {
                this.logout();
            }
        }
    }

    login(username, password) {
        if (username === CONFIG.ADMIN_USERNAME && password === CONFIG.ADMIN_PASSWORD) {
            const auth = {
                username,
                expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 heures
            };
            localStorage.setItem(CONFIG.AUTH_KEY, JSON.stringify(auth));
            this.isAuthenticated = true;
            return true;
        }
        return false;
    }

    logout() {
        localStorage.removeItem(CONFIG.AUTH_KEY);
        this.isAuthenticated = false;
    }
}

// Gestionnaire de navigation
class NavigationManager {
    constructor() {
        this.currentSection = 'home';
        this.initNavigation();
    }

    initNavigation() {
        // Navigation pour tous les liens (barre de navigation, hero, footer)
        const navLinks = document.querySelectorAll('.nav-link, .hero-actions .btn, .footer-section a');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = link.getAttribute('href')?.substring(1);
                if (target) {
                    this.navigateTo(target);
                }
            });
        });

        // Navigation mobile
        const navToggle = document.getElementById('nav-toggle');
        const navMenu = document.getElementById('nav-menu');
        
        if (navToggle && navMenu) {
            navToggle.addEventListener('click', () => {
                navMenu.classList.toggle('active');
                navToggle.classList.toggle('active');
            });

            // Fermer le menu mobile quand on clique sur un lien
            navLinks.forEach(link => {
                link.addEventListener('click', () => {
                    navMenu.classList.remove('active');
                    navToggle.classList.remove('active');
                });
            });
        }
    }

    navigateTo(sectionId) {
        const targetSection = document.getElementById(sectionId);
        if (!targetSection) {
            console.warn(`Section ${sectionId} not found`);
            return;
        }

        // Masquer toutes les sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });

        // Afficher la section cible
        targetSection.classList.add('active');
        targetSection.scrollIntoView({ behavior: 'smooth' });

        // Mettre à jour la navigation active
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            link.setAttribute('aria-current', 'false');
        });

        const activeLink = document.querySelector(`.nav-link[href="#${sectionId}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
            activeLink.setAttribute('aria-current', 'page');
        }

        this.currentSection = sectionId;

        // Actions spécifiques selon la section
        if (sectionId === 'admin') {
            this.handleAdminSection();
        }
    }

    handleAdminSection() {
        const adminLogin = document.getElementById('admin-login');
        const adminDashboard = document.getElementById('admin-dashboard');
        
        if (auth.isAuthenticated) {
            adminLogin.style.display = 'none';
            adminDashboard.style.display = 'block';
            this.loadDashboard();
        } else {
            adminLogin.style.display = 'block';
            adminDashboard.style.display = 'none';
        }
    }

    loadDashboard() {
        const stats = db.getStats();
        const incidentStats = db.getIncidentStats();
        const topCountries = db.getTopCountries();

        // Mettre à jour les statistiques
        document.getElementById('total-responses').textContent = stats.totalResponses || 0;
        document.getElementById('total-countries').textContent = stats.totalCountries || 0;
        document.getElementById('avg-awareness').textContent = stats.avgAwareness || 0;
        document.getElementById('total-incidents').textContent = incidentStats.total || 0;

        // Mettre à jour le tableau des réponses
        this.updateResponsesTable(stats.recentActivity);

        // Créer les graphiques
        this.createCharts(stats, incidentStats, topCountries);
    }

    updateResponsesTable(recentActivity) {
        const tbody = document.getElementById('responses-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';

        recentActivity.forEach((activity, index) => {
            const row = document.createElement('tr');
            row.setAttribute('data-survey-id', activity.id);
            row.innerHTML = `
                <td>${activity.date}</td>
                <td>${activity.time}</td>
                <td>${activity.country}</td>
                <td>${activity.region}</td>
                <td>${activity.organizationType}</td>
                <td>${activity.awareness}/5</td>
                <td>${activity.incidents}</td>
                <td>${this.getSolutionsSummary(activity.solutionsUsed)}</td>
                <td>
                    <button class="btn-delete" onclick="navigation.deleteActivity('${activity.id}')" title="Supprimer cette réponse">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            if (index === 0) {
                row.classList.add('new-response');
            }
            
            tbody.appendChild(row);
        });
    }

    getSolutionsSummary(solutions) {
        if (!solutions || solutions.length === 0) return 'Aucune';
        if (solutions.length <= 2) return solutions.join(', ');
        return `${solutions.slice(0, 2).join(', ')} +${solutions.length - 2}`;
    }

    deleteActivity(surveyId) {
        if (confirm('Êtes-vous sûr de vouloir supprimer cette réponse ? Cette action est irréversible.')) {
            const row = document.querySelector(`tr[data-survey-id="${surveyId}"]`);
            if (row) {
                row.classList.add('deleting');
                setTimeout(() => {
                    if (db.deleteSurvey(surveyId)) {
                        this.loadDashboard();
                        admin.showNotification('Réponse supprimée avec succès !');
                    } else {
                        alert('Erreur lors de la suppression de la réponse.');
                        row.classList.remove('deleting');
                    }
                }, 500);
            } else {
                if (db.deleteSurvey(surveyId)) {
                    this.loadDashboard();
                    admin.showNotification('Réponse supprimée avec succès !');
                } else {
                    alert('Erreur lors de la suppression de la réponse.');
                }
            }
        }
    }

    createCharts(stats, incidentStats, topCountries) {
        // Graphique des régions
        const regionCtx = document.getElementById('region-chart')?.getContext('2d');
        if (regionCtx) {
            new Chart(regionCtx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(stats.regions),
                    datasets: [{
                        data: Object.values(stats.regions),
                        backgroundColor: [
                            '#667eea', '#764ba2', '#f093fb', '#f5576c',
                            '#4facfe', '#00f2fe', '#43e97b', '#38f9d7'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { position: 'bottom' } }
                }
            });
        }

        // Graphique des solutions
        const solutionsCtx = document.getElementById('solutions-chart')?.getContext('2d');
        if (solutionsCtx) {
            new Chart(solutionsCtx, {
                type: 'bar',
                data: {
                    labels: Object.keys(stats.solutions),
                    datasets: [{
                        label: 'Utilisations',
                        data: Object.values(stats.solutions),
                        backgroundColor: '#667eea',
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true } }
                }
            });
        }

        // Graphique de la distribution du niveau de sensibilisation
        const awarenessCtx = document.getElementById('awareness-chart')?.getContext('2d');
        if (awarenessCtx) {
            new Chart(awarenessCtx, {
                type: 'bar',
                data: {
                    labels: Object.keys(stats.awarenessDistribution).map(level => `Niveau ${level}`),
                    datasets: [{
                        label: 'Nombre de réponses',
                        data: Object.values(stats.awarenessDistribution),
                        backgroundColor: '#43e97b',
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true } }
                }
            });
        }

        // Graphique des besoins en formation
        const trainingCtx = document.getElementById('training-chart')?.getContext('2d');
        if (trainingCtx) {
            new Chart(trainingCtx, {
                type: 'bar',
                data: {
                    labels: Object.keys(stats.trainingNeeds),
                    datasets: [{
                        label: 'Demandes',
                        data: Object.values(stats.trainingNeeds),
                        backgroundColor: '#f093fb',
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true } }
                }
            });
        }

        // Graphique des top pays
        const countriesCtx = document.getElementById('countries-chart')?.getContext('2d');
        if (countriesCtx) {
            new Chart(countriesCtx, {
                type: 'bar',
                data: {
                    labels: topCountries.map(item => item.country),
                    datasets: [{
                        label: 'Réponses',
                        data: topCountries.map(item => item.count),
                        backgroundColor: '#4facfe',
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true } }
                }
            });
        }

        // Graphique de la distribution des incidents
        const incidentsCtx = document.getElementById('incidents-chart')?.getContext('2d');
        if (incidentsCtx) {
            new Chart(incidentsCtx, {
                type: 'line',
                data: {
                    labels: Object.keys(incidentStats.distribution),
                    datasets: [{
                        label: "Nombre d'organisations",
                        data: Object.values(incidentStats.distribution),
                        borderColor: '#f5576c',
                        backgroundColor: 'rgba(245, 87, 108, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true } }
                }
            });
        }
    }
}

// Gestionnaire du formulaire d'enquête
class SurveyManager {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 4;
        this.initSurvey();
    }

    initSurvey() {
        const form = document.getElementById('survey-form');
        const nextBtn = document.getElementById('next-btn');
        const prevBtn = document.getElementById('prev-btn');
        const submitBtn = document.getElementById('submit-btn');

        if (form && nextBtn && prevBtn && submitBtn) {
            nextBtn.addEventListener('click', () => this.nextStep());
            prevBtn.addEventListener('click', () => this.prevStep());
            form.addEventListener('submit', (e) => this.handleSubmit(e));
            this.setupValidation();
        }
    }

    setupValidation() {
        document.querySelectorAll('input[required], select[required], textarea[required]').forEach(field => {
            field.addEventListener('blur', () => this.validateField(field));
        });

        document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => this.validateCheckboxGroup(checkbox));
        });
    }

    validateField(field) {
        const isValid = field.checkValidity();
        field.classList.toggle('error', !isValid);
        return isValid;
    }

    validateCheckboxGroup(checkbox) {
        const name = checkbox.name;
        const checkboxes = document.querySelectorAll(`input[name="${name}"]`);
        const checkedBoxes = document.querySelectorAll(`input[name="${name}"]:checked`);
        
        checkboxes.forEach(cb => cb.classList.toggle('error', checkedBoxes.length === 0));
        return checkedBoxes.length > 0;
    }

    nextStep() {
        if (this.validateCurrentStep()) {
            if (this.currentStep < this.totalSteps) {
                this.currentStep++;
                this.updateStepDisplay();
            }
        } else {
            alert('Veuillez remplir tous les champs requis avant de continuer.');
        }
    }

    prevStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.updateStepDisplay();
        }
    }

    validateCurrentStep() {
        const currentStepElement = document.querySelector(`[data-step="${this.currentStep}"]`);
        if (!currentStepElement) return false;

        const requiredFields = currentStepElement.querySelectorAll('input[required], select[required], textarea[required]');
        let isValid = true;
        requiredFields.forEach(field => {
            if (!this.validateField(field)) {
                isValid = false;
            }
        });

        const checkboxGroups = currentStepElement.querySelectorAll('input[type="checkbox"]');
        const checkboxNames = [...new Set(Array.from(checkboxGroups).map(cb => cb.name))];
        
        checkboxNames.forEach(name => {
            if (!this.validateCheckboxGroup(document.querySelector(`input[name="${name}"]`))) {
                isValid = false;
            }
        });

        return isValid;
    }

    updateStepDisplay() {
        document.querySelectorAll('.progress-step').forEach((step, index) => {
            const stepNumber = index + 1;
            step.classList.remove('active', 'completed');
            if (stepNumber === this.currentStep) {
                step.classList.add('active');
            } else if (stepNumber < this.currentStep) {
                step.classList.add('completed');
            }
        });

        document.querySelectorAll('.form-step').forEach((step, index) => {
            const stepNumber = index + 1;
            step.classList.toggle('active', stepNumber === this.currentStep);
        });

        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        const submitBtn = document.getElementById('submit-btn');

        prevBtn.style.display = this.currentStep === 1 ? 'none' : 'inline-flex';
        nextBtn.style.display = this.currentStep === this.totalSteps ? 'none' : 'inline-flex';
        submitBtn.style.display = this.currentStep === this.totalSteps ? 'inline-flex' : 'none';
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        if (!this.validateCurrentStep()) {
            alert('Veuillez corriger les erreurs avant de soumettre.');
            return;
        }

        const formData = new FormData(e.target);
        const surveyData = {};

        for (let [key, value] of formData.entries()) {
            if (surveyData[key]) {
                if (Array.isArray(surveyData[key])) {
                    surveyData[key].push(value);
                } else {
                    surveyData[key] = [surveyData[key], value];
                }
            } else {
                surveyData[key] = value;
            }
        }

        document.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
            const name = checkbox.name;
            if (!surveyData[name]) {
                surveyData[name] = [];
            }
            if (!Array.isArray(surveyData[name])) {
                surveyData[name] = [surveyData[name]];
            }
            surveyData[name].push(checkbox.value);
        });

        try {
            db.addSurvey(surveyData);
            this.showSuccessModal();
            e.target.reset();
            this.currentStep = 1;
            this.updateStepDisplay();
            navigation.navigateTo('home'); // Retour à l'accueil après soumission
        } catch (error) {
            console.error('Erreur lors de la soumission:', error);
            alert('Une erreur est survenue lors de la soumission. Veuillez réessayer.');
        }
    }

    showSuccessModal() {
        const modal = document.getElementById('success-modal');
        if (modal) {
            modal.style.display = 'block';
        }
    }
}

// Gestionnaire de l'interface admin
class AdminManager {
    constructor() {
        this.initAdmin();
    }

    initAdmin() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        const exportCsvBtn = document.getElementById('export-csv');
        const exportJsonBtn = document.getElementById('export-json');
        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', () => this.exportCSV());
        }
        if (exportJsonBtn) {
            exportJsonBtn.addEventListener('click', () => this.exportJSON());
        }

        window.addEventListener('surveyAdded', () => {
            if (auth.isAuthenticated) {
                navigation.loadDashboard();
                this.showNotification('Nouvelle réponse reçue !');
            }
        });

        window.addEventListener('surveyDeleted', () => {
            if (auth.isAuthenticated) {
                navigation.loadDashboard();
            }
        });
    }

    handleLogin(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const username = formData.get('username');
        const password = formData.get('password');

        if (auth.login(username, password)) {
            document.getElementById('admin-login').style.display = 'none';
            document.getElementById('admin-dashboard').style.display = 'block';
            navigation.loadDashboard();
            this.showNotification('Connexion réussie ! Dashboard mis à jour.');
        } else {
            alert('Identifiants incorrects. Veuillez réessayer.');
        }
    }

    handleLogout() {
        auth.logout();
        document.getElementById('admin-login').style.display = 'block';
        document.getElementById('admin-dashboard').style.display = 'none';
        document.getElementById('login-form').reset();
        navigation.navigateTo('home');
    }

    exportCSV() {
        const csvContent = db.exportToCSV();
        if (csvContent) {
            this.downloadFile(csvContent, 'cyberguard4all_surveys.csv', 'text/csv');
            this.showNotification('Données exportées en CSV avec succès !');
        } else {
            alert('Aucune donnée à exporter.');
        }
    }

    exportJSON() {
        const jsonContent = db.exportToJSON();
        this.downloadFile(jsonContent, 'cyberguard4all_surveys.json', 'application/json');
        this.showNotification('Données exportées en JSON avec succès !');
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'admin-notification';
        notification.innerHTML = `
            <i class="fas fa-bell"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 100);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
    }
}

// Fonctions utilitaires
function closeModal() {
    const modal = document.getElementById('success-modal');
    if (modal) {
        modal.style.display = 'none';
        navigation.navigateTo('home'); // Rediriger vers home après fermeture
    }
}

// Initialisation de l'application
document.addEventListener('DOMContentLoaded', () => {
    window.db = new LocalDatabase();
    window.auth = new AuthManager();
    window.navigation = new NavigationManager();
    window.survey = new SurveyManager();
    window.admin = new AdminManager();

    window.closeModal = closeModal;

    const successModal = document.getElementById('success-modal');
    if (successModal) {
        successModal.addEventListener('click', (e) => {
            if (e.target.id === 'success-modal') {
                closeModal();
            }
        });
    }

    navigation.navigateTo('home');

    // Données d'exemple pour la démonstration
    if (db.getSurveys().length === 0) {
        const sampleData = [
            {
                region: "Afrique de l'Ouest",
                country: 'Sénégal',
                organizationType: 'Entreprise',
                organizationSize: '11-50',
                cybersecurityAwareness: '3',
                solutionsUsed: ['Antivirus', 'Firewall', 'VPN'],
                incidentsLast12Months: '2',
                trainingNeeds: ['Formation de base cybersécurité', 'Gestion des mots de passe'],
                supportNeeds: ['Support technique', 'Audit de sécurité'],
                additionalComments: 'Besoins en formation pour les employés'
            },
            {
                region: 'Afrique du Nord',
                country: 'Maroc',
                organizationType: 'ONG',
                organizationSize: '1-10',
                cybersecurityAwareness: '2',
                solutionsUsed: ['Aucune'],
                incidentsLast12Months: '0',
                trainingNeeds: ['Gestion des mots de passe', 'Détection des menaces'],
                supportNeeds: ['Formation personnalisée'],
                additionalComments: 'Budget limité pour la cybersécurité'
            },
            {
                region: "Afrique de l'Est",
                country: 'Kenya',
                organizationType: 'École',
                organizationSize: '51-200',
                cybersecurityAwareness: '4',
                solutionsUsed: ['Antivirus', 'Authentification à deux facteurs', 'Sauvegarde cloud'],
                incidentsLast12Months: '1',
                trainingNeeds: ['Formation de base cybersécurité'],
                supportNeeds: ['Conseil stratégique'],
                additionalComments: 'Bon niveau de sensibilisation mais besoin de formation continue'
            },
            {
                region: 'Afrique australe',
                country: 'Afrique du Sud',
                organizationType: 'Entreprise',
                organizationSize: '201-1000',
                cybersecurityAwareness: '5',
                solutionsUsed: ['Antivirus', 'Firewall', 'VPN', 'Chiffrement', 'Audit sécurité'],
                incidentsLast12Months: '3',
                trainingNeeds: ['Réponse aux incidents', 'Conformité réglementaire'],
                supportNeeds: ['Audit de sécurité', 'Outils de sécurité'],
                additionalComments: 'Organisation mature en cybersécurité'
            },
            {
                region: 'Afrique centrale',
                country: 'Cameroun',
                organizationType: 'Particulier',
                organizationSize: '1-10',
                cybersecurityAwareness: '1',
                solutionsUsed: ['Aucune'],
                incidentsLast12Months: '5',
                trainingNeeds: ['Formation de base cybersécurité', 'Gestion des mots de passe', 'Détection des menaces'],
                supportNeeds: ['Support technique', 'Formation personnalisée'],
                additionalComments: 'Urgent besoin de formation et de protection'
            }
        ];

        sampleData.forEach(data => db.addSurvey(data));
    }
});