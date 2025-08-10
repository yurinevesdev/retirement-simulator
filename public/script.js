// Cache de elementos DOM
const DOM = {
    form: document.getElementById('calc-form'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    modal: document.getElementById('compositionModal'),
    modalTitle: document.getElementById('modal-title'),
    compositionList: document.getElementById('composition-list'),
    closeModal: document.querySelector('.close'),
    tabs: document.querySelectorAll('.tab'),
    tabContents: document.querySelectorAll('.tab-content'),
    withdrawalTabsContainer: document.getElementById('withdrawal-tabs'),
    comparisonChart: document.getElementById('comparisonChart'),
    withdrawalChart: document.getElementById('withdrawalChart'),
    cards: document.querySelectorAll('.card'),
    currentAge: document.getElementById('currentAge'),
    desiredAge: document.getElementById('desiredAge'),
    initialAmount: document.getElementById('initialAmount'),
    monthlyContribution: document.getElementById('monthlyContribution')
};

// Estado da aplicação
const AppState = {
    chart: null,
    withdrawalChart: null,
    withdrawalData: null
};

// Constantes
const COMPOSITION_DATA = {
    conservador: [
        { category: 'Renda Fixa', percentage: 90, color: '#3498db' },
        { category: 'Renda Variável Brasil', percentage: 10, color: '#2980b9' }
    ],
    moderado: [
        { category: 'Renda Fixa', percentage: 70, color: '#f39c12' },
        { category: 'Renda Variável Brasil', percentage: 20, color: '#e67e22' },
        { category: 'Renda Variável EUA', percentage: 10, color: '#d35400' }
    ],
    agressivo: [
        { category: 'Renda Fixa', percentage: 30, color: '#e74c3c' },
        { category: 'Renda Variável Brasil', percentage: 30, color: '#c0392b' },
        { category: 'Renda Variável EUA', percentage: 20, color: '#a93226' },
        { category: 'Criptomoedas e outros', percentage: 20, color: '#922b21' }
    ]
};

const WITHDRAWAL_AMOUNTS = [2500, 5000, 7500, 10000, 12000, 15000];
const MAX_AGE = 110;
const CURRENCY_FORMAT = { style: 'currency', currency: 'BRL' };

// Utilitários
const Utils = {
    formatCurrency: (value) => value.toLocaleString('pt-BR', CURRENCY_FORMAT),

    capitalizeFirst: (str) => str.charAt(0).toUpperCase() + str.slice(1),

    validateAges: (currentAge, desiredAge) => {
        if (desiredAge <= currentAge) {
            alert('A idade desejada deve ser maior que a idade atual.');
            return false;
        }
        return true;
    },

    showLoading: (show = true) => {
        DOM.loadingOverlay.style.display = show ? 'flex' : 'none';
    },

    createCompositionItem: (item) => {
        const li = document.createElement('li');
        li.className = 'composition-item';
        li.innerHTML = `
            <div class="composition-label">
                <span class="composition-category">${item.category}</span>
                <span class="composition-percentage">${item.percentage}%</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${item.percentage}%; background-color: ${item.color};"></div>
            </div>
        `;
        return li;
    }
};

// API calls
const API = {
    calculate: async (data) => {
        const response = await fetch('/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return response.json();
    },

    getWithdrawalScenarios: async (data) => {
        const response = await fetch('/withdrawal-scenarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return response.json();
    }
};

// Gerenciadores de UI
const UIManager = {
    showModal: () => {
        DOM.modal.style.display = 'block';
    },

    hideModal: () => {
        DOM.modal.style.display = 'none';
    },

    showCompositionModal: (cardType) => {
        DOM.compositionList.innerHTML = '';
        DOM.modalTitle.textContent = `Composição: ${Utils.capitalizeFirst(cardType)}`;

        const composition = COMPOSITION_DATA[cardType];
        if (composition) {
            const fragment = document.createDocumentFragment();
            composition.forEach(item => {
                fragment.appendChild(Utils.createCompositionItem(item));
            });
            DOM.compositionList.appendChild(fragment);
        }

        UIManager.showModal();
    },

    updateCards: (scenarios, totalContributed) => {
        scenarios.forEach((scenario, index) => {
            if (index < DOM.cards.length) {
                const card = DOM.cards[index];
                const fvElement = card.querySelector('.card-value');
                const statValues = card.querySelectorAll('.stat-value');

                if (fvElement) {
                    fvElement.textContent = Utils.formatCurrency(scenario.fv);
                }

                if (statValues.length >= 2) {
                    const interestEarned = scenario.fv - totalContributed;
                    statValues[0].textContent = Utils.formatCurrency(totalContributed);
                    statValues[1].textContent = Utils.formatCurrency(interestEarned);
                }
            }
        });
    },

    createWithdrawalTab: (amount, index, isActive = false) => {
        const tab = document.createElement('div');
        tab.className = `withdrawal-tab${isActive ? ' active' : ''}`;
        tab.textContent = `R$ ${(amount / 1000).toFixed(1)}k/mês`;
        tab.dataset.index = index;

        tab.addEventListener('click', () => {
            document.querySelectorAll('.withdrawal-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            ChartManager.renderWithdrawal(index);
        });

        return tab;
    }
};

// Gerenciador de gráficos
const ChartManager = {
    destroy: (chartInstance) => {
        if (chartInstance) chartInstance.destroy();
    },

    createDatasets: (graphData, totalContributionsData) => [
        ...graphData.datasets.map(ds => ({
            label: ds.label,
            data: ds.data,
            borderColor: ds.color,
            backgroundColor: `${ds.color}20`,
            borderWidth: 3,
            pointRadius: 0,
            pointHoverRadius: 5,
            fill: false,
            tension: 0.3
        })),
        {
            label: 'Total Aportado',
            data: totalContributionsData,
            borderColor: '#7f8c8d',
            borderWidth: 3,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
        }
    ],

    getCommonChartOptions: (titleText = '') => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            ...(titleText && {
                title: {
                    display: true,
                    text: titleText,
                    font: { size: 16 }
                }
            }),
            legend: { display: !titleText },
            tooltip: {
                mode: 'index',
                intersect: false,
                callbacks: {
                    label: (context) =>
                        `${context.dataset.label}: ${Utils.formatCurrency(context.parsed.y)}`
                }
            }
        },
        scales: {
            x: {
                title: { display: true, text: titleText ? 'Idade' : 'Anos' },
                grid: { display: false }
            },
            y: {
                title: { display: true, text: titleText ? 'Valor do Patrimônio (R$)' : 'Valor Acumulado (R$)' },
                ...(titleText && { beginAtZero: true }),
                ticks: {
                    callback: (value) => 'R$ ' + value.toLocaleString('pt-BR')
                }
            }
        },
        interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
        },
        animation: {
            duration: titleText ? 1000 : 2000,
            easing: 'easeOutQuart'
        }
    }),

    renderComparison: (data) => {
        ChartManager.destroy(AppState.chart);

        const ctx = DOM.comparisonChart.getContext('2d');
        AppState.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.graphData.labels,
                datasets: ChartManager.createDatasets(data.graphData, data.totalContributionsData)
            },
            options: ChartManager.getCommonChartOptions()
        });
    },

    renderWithdrawal: (scenarioIndex) => {
        if (!AppState.withdrawalData?.scenarios[scenarioIndex]) return;

        ChartManager.destroy(AppState.withdrawalChart);

        const scenario = AppState.withdrawalData.scenarios[scenarioIndex];
        const retirementAge = AppState.withdrawalData.retirementAge;
        const years = MAX_AGE - retirementAge;
        const labels = Array.from({ length: years + 1 }, (_, i) => retirementAge + i);

        const datasets = [
            { label: 'Conservador', data: scenario.conservador, borderColor: '#3498db', backgroundColor: 'rgba(52, 152, 219, 0.1)' },
            { label: 'Moderado', data: scenario.moderado, borderColor: '#f39c12', backgroundColor: 'rgba(243, 156, 18, 0.1)' },
            { label: 'Agressivo', data: scenario.agressivo, borderColor: '#e74c3c', backgroundColor: 'rgba(231, 76, 60, 0.1)' }
        ].map(ds => ({ ...ds, borderWidth: 3, tension: 0.3, fill: true }));

        ['conservador', 'moderado', 'agressivo'].forEach(type => {
            const element = document.getElementById(`${type}-age`);
            if (element) {
                element.textContent = ChartManager.formatFinalAge(scenario[type], retirementAge);
            }
        });

        const ctx = DOM.withdrawalChart.getContext('2d');
        AppState.withdrawalChart = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets },
            options: ChartManager.getCommonChartOptions(
                `Patrimônio ao longo da aposentadoria (Saque de R$ ${scenario.withdrawal}/mês)`
            )
        });
    },

    formatFinalAge: (data, retirementAge) => {
        const lastYearWithMoney = data.findIndex(saldo => saldo <= 0);
        if (lastYearWithMoney === -1) return "110+ anos";

        const finalAge = retirementAge + lastYearWithMoney;
        return finalAge > MAX_AGE ? "110+ anos" : `${finalAge} anos`;
    }
};

const EventHandlers = {
    handleFormSubmit: async (e) => {
        e.preventDefault();

        const currentAge = parseInt(DOM.currentAge.value);
        const desiredAge = parseInt(DOM.desiredAge.value);
        const initialAmount = parseFloat(DOM.initialAmount.value) || 0;
        const monthlyContribution = parseFloat(DOM.monthlyContribution.value);

        if (!Utils.validateAges(currentAge, desiredAge)) return;

        Utils.showLoading(true);

        try {
            const data = await API.calculate({
                currentAge,
                desiredAge,
                initialAmount,
                monthlyContribution
            });

            EventHandlers.renderResults(data, currentAge, desiredAge, monthlyContribution, initialAmount);

            AppState.withdrawalData = await API.getWithdrawalScenarios({
                accumulatedValues: data.scenarios.map(s => s.fv),
                rates: [0.06, 0.085, 0.11],
                retirementAge: desiredAge
            });

            EventHandlers.renderWithdrawalTabs();
            ChartManager.renderWithdrawal(0);

        } catch (error) {
            console.error('Erro:', error);
            alert('Ocorreu um erro ao calcular. Por favor, tente novamente.');
        } finally {
            Utils.showLoading(false);
        }
    },

    renderResults: (data, currentAge, desiredAge, monthlyContribution, initialAmount) => {
        const years = desiredAge - currentAge;
        const totalContributed = initialAmount + (monthlyContribution * 12 * years);

        UIManager.updateCards(data.scenarios, totalContributed);
        ChartManager.renderComparison(data);
    },

    renderWithdrawalTabs: () => {
        if (!AppState.withdrawalData) return;

        DOM.withdrawalTabsContainer.innerHTML = '';
        const fragment = document.createDocumentFragment();

        WITHDRAWAL_AMOUNTS.forEach((amount, index) => {
            fragment.appendChild(UIManager.createWithdrawalTab(amount, index, index === 0));
        });

        DOM.withdrawalTabsContainer.appendChild(fragment);
    }
};

const App = {
    init: () => {
        DOM.form.addEventListener('submit', EventHandlers.handleFormSubmit);

        DOM.closeModal.addEventListener('click', UIManager.hideModal);

        window.addEventListener('click', (event) => {
            if (event.target === DOM.modal) UIManager.hideModal();
        });

        document.querySelectorAll('.info-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                const cardType = e.currentTarget.getAttribute('data-card');
                UIManager.showCompositionModal(cardType);
            });
        });

        DOM.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                DOM.tabs.forEach(t => t.classList.remove('active'));
                DOM.tabContents.forEach(c => c.classList.remove('active'));

                tab.classList.add('active');
                document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');
            });
        });

        DOM.currentAge.value = 30;
        DOM.desiredAge.value = 60;
        DOM.initialAmount.value = 5000;
        DOM.monthlyContribution.value = 1000;
    }
};

App.init();