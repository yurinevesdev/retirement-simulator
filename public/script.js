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

const AppState = {
    chart: null,
    withdrawalChart: null,
    withdrawalData: null
};

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

// Validadores para os dados do formulário
const Validators = {
    validateCalculateRequest: (body) => {
        const { currentAge, desiredAge, monthlyContribution, initialAmount } = body;
        const errors = [];

        // Validação da idade atual
        if (!Number.isInteger(currentAge) || currentAge < 18 || currentAge > 80) {
            errors.push('Idade atual deve ser um número inteiro entre 18 e 80 anos');
        }

        // Validação da idade desejada
        if (!Number.isInteger(desiredAge) || desiredAge <= currentAge || desiredAge > 100 || desiredAge < 50) {
            errors.push('Idade de aposentadoria deve ser maior que a idade atual, no mínimo 50 anos e menor que 100 anos');
        }

        // Validação da contribuição mensal
        if (!Number.isFinite(monthlyContribution) || monthlyContribution < 0) {
            errors.push('Contribuição mensal deve ser um número positivo');
        }

        // Validação do valor inicial (opcional)
        if (initialAmount !== undefined && (!Number.isFinite(initialAmount) || initialAmount < 0)) {
            errors.push('Valor inicial deve ser um número positivo');
        }

        return { isValid: errors.length === 0, errors };
    },

    validateWithdrawalRequest: (body) => {
        const { accumulatedValues, rates, retirementAge } = body;
        const errors = [];

        // Validação dos valores acumulados
        if (!Array.isArray(accumulatedValues) || accumulatedValues.length !== 3) {
            errors.push('AccumulatedValues deve ser um array com 3 elementos');
        } else {
            // Verifica se todos os valores são números positivos
            accumulatedValues.forEach((value, index) => {
                if (!Number.isFinite(value) || value < 0) {
                    errors.push(`Valor acumulado ${index + 1} deve ser um número positivo`);
                }
            });
        }

        // Validação das taxas de retorno
        if (!Array.isArray(rates) || rates.length !== 3) {
            errors.push('Rates deve ser um array com 3 elementos');
        } else {
            // Verifica se todas as taxas são números válidos
            rates.forEach((rate, index) => {
                if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
                    errors.push(`Taxa ${index + 1} deve ser um número entre 0 e 1`);
                }
            });
        }

        // Validação da idade de aposentadoria
        if (!Number.isInteger(retirementAge) || retirementAge < 50 || retirementAge > 100) {
            errors.push('Idade de aposentadoria deve ser entre 50 e 100 anos');
        }

        return { isValid: errors.length === 0, errors };
    },

    // Validação em tempo real dos campos do formulário
    validateFormFields: () => {
        const currentAge = parseInt(DOM.currentAge.value);
        const desiredAge = parseInt(DOM.desiredAge.value);
        const monthlyContribution = parseFloat(DOM.monthlyContribution.value);
        const initialAmount = parseFloat(DOM.initialAmount.value) || 0;

        // Remove mensagens de erro anteriores
        Validators.clearValidationErrors();

        let isValid = true;

        // Validação idade atual
        if (isNaN(currentAge) || currentAge < 18 || currentAge > 80) {
            Validators.showFieldError(DOM.currentAge, 'Idade deve estar entre 18 e 80 anos');
            isValid = false;
        }

        // Validação idade desejada
        if (isNaN(desiredAge) || desiredAge <= currentAge || desiredAge > 100) {
            Validators.showFieldError(DOM.desiredAge, 'Idade deve ser maior que a atual e menor que 100');
            isValid = false;
        }

        // Validação contribuição mensal
        if (isNaN(monthlyContribution) || monthlyContribution < 0) {
            Validators.showFieldError(DOM.monthlyContribution, 'Contribuição deve ser um número positivo');
            isValid = false;
        }

        // Validação valor inicial
        if (initialAmount < 0) {
            Validators.showFieldError(DOM.initialAmount, 'Valor inicial deve ser positivo');
            isValid = false;
        }

        return isValid;
    },

    showFieldError: (field, message) => {
        field.classList.add('error');

        // Remove erro anterior se existir
        const existingError = field.parentNode.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }

        // Adiciona nova mensagem de erro
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        field.parentNode.appendChild(errorDiv);
    },

    clearValidationErrors: () => {
        // Remove classes de erro dos campos
        document.querySelectorAll('.error').forEach(field => {
            field.classList.remove('error');
        });

        // Remove mensagens de erro
        document.querySelectorAll('.error-message').forEach(msg => {
            msg.remove();
        });
    },

    showValidationAlert: (errors) => {
        const errorMessage = errors.join('\n');
        alert(`Erro de validação:\n\n${errorMessage}`);
    }
};

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

const API = {
    calculate: async (data) => {
        // Validação antes do envio
        const validation = Validators.validateCalculateRequest(data);
        if (!validation.isValid) {
            Validators.showValidationAlert(validation.errors);
            throw new Error('Dados inválidos');
        }

        const response = await fetch('/api/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            console.log(response)
            const errorData = await response.json();
            throw new Error(errorData.details ? errorData.details.join(', ') : errorData.error || 'Erro desconhecido');
        }

        return response.json();
    },

    getWithdrawalScenarios: async (data) => {
        // Validação antes do envio
        const validation = Validators.validateWithdrawalRequest(data);
        if (!validation.isValid) {
            Validators.showValidationAlert(validation.errors);
            throw new Error('Dados inválidos para cenários de saque');
        }

        const response = await fetch('/api/withdrawal-scenarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            console.log(response)
            const errorData = await response.json();
            throw new Error(errorData.details ? errorData.details.join(', ') : errorData.error || 'Erro desconhecido');
        }

        return response.json();
    }
};

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

        // Limpa validações anteriores
        Validators.clearValidationErrors();

        const currentAge = parseInt(DOM.currentAge.value);
        const desiredAge = parseInt(DOM.desiredAge.value);
        const initialAmount = parseFloat(DOM.initialAmount.value) || 0;
        const monthlyContribution = parseFloat(DOM.monthlyContribution.value);

        // Validação frontend
        if (!Validators.validateFormFields()) {
            return;
        }

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
            if (error.message !== 'Dados inválidos' && error.message !== 'Dados inválidos para cenários de saque') {
                alert('Ocorreu um erro ao calcular. Por favor, tente novamente.');
            }
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

        // Validação em tempo real nos campos
        [DOM.currentAge, DOM.desiredAge, DOM.monthlyContribution, DOM.initialAmount].forEach(field => {
            field.addEventListener('blur', () => {
                // Remove erro do campo atual se estiver válido
                const currentErrors = field.parentNode.querySelector('.error-message');
                if (currentErrors) {
                    Validators.validateFormFields();
                }
            });

            field.addEventListener('input', () => {
                // Remove classe de erro enquanto o usuário digita
                if (field.classList.contains('error')) {
                    field.classList.remove('error');
                }
            });
        });

        // Valores padrão
        DOM.currentAge.value = 30;
        // Atualizar os atributos min do HTML para aposentadoria
        DOM.desiredAge.setAttribute('min', '50');
        DOM.desiredAge.value = 60;
        DOM.initialAmount.value = 5000;
        DOM.monthlyContribution.value = 1000;
    }
};

App.init();