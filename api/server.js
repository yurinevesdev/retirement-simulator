const express = require('express');
const bodyParser = require('body-parser');

const CONFIG = {
    PORT: process.env.PORT || 3000,
    MAX_AGE: 110,
    WITHDRAWAL_AMOUNTS: [2500, 5000, 7500, 10000, 12000, 15000],
    PORTFOLIOS: [
        { name: 'Carteira Conservadora', rate: 0.06, color: '#3498db', key: 'conservador' },
        { name: 'Carteira Moderada', rate: 0.085, color: '#f39c12', key: 'moderado' },
        { name: 'Carteira Agressiva', rate: 0.11, color: '#e74c3c', key: 'agressivo' }
    ]
};

class FinanceCalculator {
    static getMonthlyRate(annualRate) {
        return Math.pow(1 + annualRate, 1 / 12) - 1;
    }
    static roundToTwoDecimals(value) {
        return Math.round(value * 100) / 100;
    }
    static calculateFutureValueLumpSum(principal, rate, years) {
        return principal * Math.pow(1 + rate, years);
    }
    static calculateFutureValueAnnuity(monthlyPayment, monthlyRate, totalMonths) {
        if (monthlyRate === 0) return monthlyPayment * totalMonths;
        return monthlyPayment * (Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate;
    }
    static calculatePortfolioGrowth(initialAmount, monthlyContribution, annualRate, years) {
        const monthlyRate = this.getMonthlyRate(annualRate);
        const totalMonths = years * 12;
        const futureValueInitial = this.calculateFutureValueLumpSum(initialAmount, annualRate, years);
        const futureValueContributions = this.calculateFutureValueAnnuity(monthlyContribution, monthlyRate, totalMonths);
        return futureValueInitial + futureValueContributions;
    }
    static generateYearlyGrowthData(initialAmount, monthlyContribution, annualRate, years) {
        const monthlyRate = this.getMonthlyRate(annualRate);
        const data = [initialAmount];
        for (let year = 1; year <= years; year++) {
            const months = year * 12;
            const fvInitial = this.calculateFutureValueLumpSum(initialAmount, annualRate, year);
            const fvContributions = this.calculateFutureValueAnnuity(monthlyContribution, monthlyRate, months);
            data.push(this.roundToTwoDecimals(fvInitial + fvContributions));
        }
        return data;
    }
    static simulateWithdrawal(initialBalance, withdrawalAmount, annualRate, maxYears) {
        const monthlyRate = this.getMonthlyRate(annualRate);
        const balances = [initialBalance];
        let currentBalance = initialBalance;
        for (let year = 1; year <= maxYears; year++) {
            if (currentBalance <= 0) {
                balances.push(0);
                continue;
            }
            for (let month = 1; month <= 12; month++) {
                currentBalance = Math.max(0, currentBalance * (1 + monthlyRate) - withdrawalAmount);
            }
            balances.push(this.roundToTwoDecimals(currentBalance));
        }
        return balances;
    }
}

class InputValidator {
    static validateCalculateRequest(body) {
        const { currentAge, desiredAge, monthlyContribution } = body;
        const errors = [];
        if (!Number.isInteger(currentAge) || currentAge < 18 || currentAge > 80) {
            errors.push('Idade atual deve ser um número inteiro entre 18 e 80 anos');
        }
        if (!Number.isInteger(desiredAge) || desiredAge < currentAge || desiredAge > 100) {
            errors.push('Idade desejada deve ser maior que a idade atual e menor que 100 anos');
        }
        if (!Number.isFinite(monthlyContribution) || monthlyContribution < 0) {
            errors.push('Contribuição mensal deve ser um número positivo');
        }
        return { isValid: errors.length === 0, errors };
    }
    static validateWithdrawalRequest(body) {
        const { accumulatedValues, rates, retirementAge } = body;
        const errors = [];
        if (!Array.isArray(accumulatedValues) || accumulatedValues.length !== 3) {
            errors.push('AccumulatedValues deve ser um array com 3 elementos');
        }
        if (!Array.isArray(rates) || rates.length !== 3) {
            errors.push('Rates deve ser um array com 3 elementos');
        }
        if (!Number.isInteger(retirementAge) || retirementAge < 50 || retirementAge > 100) {
            errors.push('Idade de aposentadoria deve ser entre 50 e 100 anos');
        }
        return { isValid: errors.length === 0, errors };
    }
}

class CalculationService {
    static calculateInvestmentScenarios(params) {
        const { currentAge, desiredAge, initialAmount = 0, monthlyContribution } = params;
        const years = desiredAge - currentAge;
        const scenarios = CONFIG.PORTFOLIOS.map(portfolio => {
            const totalValue = FinanceCalculator.calculatePortfolioGrowth(initialAmount, monthlyContribution, portfolio.rate, years);
            return { name: portfolio.name, fv: FinanceCalculator.roundToTwoDecimals(totalValue), color: portfolio.color };
        });
        const labels = Array.from({ length: years + 1 }, (_, i) => `${currentAge + i} anos`);
        const datasets = CONFIG.PORTFOLIOS.map(portfolio => ({
            label: portfolio.name,
            data: FinanceCalculator.generateYearlyGrowthData(initialAmount, monthlyContribution, portfolio.rate, years),
            color: portfolio.color
        }));
        const totalContributionsData = Array.from({ length: years + 1 }, (_, i) => initialAmount + (monthlyContribution * i * 12));
        return { scenarios, graphData: { labels, datasets }, totalContributionsData };
    }
    static calculateWithdrawalScenarios(params) {
        const { accumulatedValues, rates, retirementAge } = params;
        const maxYears = CONFIG.MAX_AGE - retirementAge;
        const scenarios = CONFIG.WITHDRAWAL_AMOUNTS.map(withdrawal => {
            const scenario = { withdrawal };
            CONFIG.PORTFOLIOS.forEach((portfolio, index) => {
                scenario[portfolio.key] = FinanceCalculator.simulateWithdrawal(accumulatedValues[index], withdrawal, rates[index], maxYears);
            });
            return scenario;
        });
        return { scenarios, retirementAge, maxAge: CONFIG.MAX_AGE };
    }
}

const errorHandler = (err, req, res, next) => {
    console.error('Error:', err.message);
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Invalid JSON format', message: 'Please check your request body' });
    }
    res.status(500).json({ error: 'Internal server error', message: 'Something went wrong processing your request' });
};

const validateRequest = (validator) => (req, res, next) => {
    const validation = validator(req.body);
    if (!validation.isValid) {
        return res.status(400).json({ error: 'Validation failed', details: validation.errors });
    }
    next();
};

const app = express();

app.use(bodyParser.json({ limit: '1mb' }));
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

app.post('/calculate', validateRequest(InputValidator.validateCalculateRequest), (req, res) => {
    try {
        const result = CalculationService.calculateInvestmentScenarios(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Calculation failed' });
    }
});

app.post('/withdrawal-scenarios', validateRequest(InputValidator.validateWithdrawalRequest), (req, res) => {
    try {
        const result = CalculationService.calculateWithdrawalScenarios(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Withdrawal calculation failed' });
    }
});

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

app.use(errorHandler);

module.exports = app;
