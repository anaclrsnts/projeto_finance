const state = {
    transactions: [],
    categories: [],
    monthlyChart: null,
    categoryChart: null,
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
});

const elements = {
    balance: document.querySelector("#balance-value"),
    income: document.querySelector("#income-value"),
    expenses: document.querySelector("#expenses-value"),
    tableBody: document.querySelector("#transactions-body"),
    emptyState: document.querySelector("#empty-state"),
    newButton: document.querySelector("#new-transaction-button"),
    demoButton: document.querySelector("#demo-button"),
    modalBackdrop: document.querySelector("#modal-backdrop"),
    modalTitle: document.querySelector("#modal-title"),
    closeModalButton: document.querySelector("#close-modal-button"),
    cancelButton: document.querySelector("#cancel-button"),
    form: document.querySelector("#transaction-form"),
    formError: document.querySelector("#form-error"),
    id: document.querySelector("#transaction-id"),
    description: document.querySelector("#description"),
    amount: document.querySelector("#amount"),
    type: document.querySelector("#type"),
    category: document.querySelector("#category"),
    date: document.querySelector("#transaction-date"),
    notes: document.querySelector("#notes"),
    categoryOptions: document.querySelector("#category-options"),
    filterMonth: document.querySelector("#filter-month"),
    filterType: document.querySelector("#filter-type"),
    filterCategory: document.querySelector("#filter-category"),
    filterSearch: document.querySelector("#filter-search"),
    clearFilters: document.querySelector("#clear-filters"),
    toast: document.querySelector("#toast"),
};

function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.hidden = false;

    window.clearTimeout(showToast.timeoutId);
    showToast.timeoutId = window.setTimeout(() => {
        elements.toast.hidden = true;
    }, 3000);
}

function showFormError(message) {
    elements.formError.textContent = message;
    elements.formError.hidden = false;
}

function clearFormError() {
    elements.formError.textContent = "";
    elements.formError.hidden = true;
}

function openModal(transaction = null) {
    clearFormError();
    elements.form.reset();
    elements.id.value = "";

    if (transaction) {
        elements.modalTitle.textContent = "Editar lançamento";
        elements.id.value = transaction.id;
        elements.description.value = transaction.description;
        elements.amount.value = transaction.amount;
        elements.type.value = transaction.type;
        elements.category.value = transaction.category;
        elements.date.value = transaction.transaction_date;
        elements.notes.value = transaction.notes;
    } else {
        elements.modalTitle.textContent = "Novo lançamento";
        elements.type.value = "despesa";
        elements.date.value = new Date().toISOString().slice(0, 10);
    }

    elements.modalBackdrop.classList.add("open");
    document.body.style.overflow = "hidden";
    window.setTimeout(() => elements.description.focus(), 0);
}

function closeModal() {
    elements.modalBackdrop.classList.remove("open");
    document.body.style.overflow = "";
}

function getFilterParams() {
    const params = new URLSearchParams();

    if (elements.filterMonth.value) {
        params.set("month", elements.filterMonth.value);
    }

    if (elements.filterType.value) {
        params.set("type", elements.filterType.value);
    }

    if (elements.filterCategory.value) {
        params.set("category", elements.filterCategory.value);
    }

    if (elements.filterSearch.value.trim()) {
        params.set("search", elements.filterSearch.value.trim());
    }

    return params;
}

async function apiRequest(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || data.message || "Não foi possível concluir a operação.");
    }

    return data;
}

async function loadCategories() {
    state.categories = await apiRequest("/api/categories");

    elements.categoryOptions.innerHTML = state.categories
        .map((category) => `<option value="${escapeHtml(category)}"></option>`)
        .join("");

    const selectedFilter = elements.filterCategory.value;
    elements.filterCategory.innerHTML = `
        <option value="">Todas</option>
        ${state.categories
            .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
            .join("")}
    `;
    elements.filterCategory.value = selectedFilter;
}

async function loadTransactions() {
    const params = getFilterParams();
    state.transactions = await apiRequest(`/api/transactions?${params.toString()}`);
    renderTransactions();
}

async function loadSummary() {
    const params = new URLSearchParams();

    if (elements.filterMonth.value) {
        params.set("month", elements.filterMonth.value);
    }

    const summary = await apiRequest(`/api/summary?${params.toString()}`);

    elements.balance.textContent = currencyFormatter.format(summary.balance);
    elements.income.textContent = currencyFormatter.format(summary.income);
    elements.expenses.textContent = currencyFormatter.format(summary.expenses);

    renderCharts(summary);
}

async function refreshDashboard() {
    await Promise.all([loadTransactions(), loadSummary(), loadCategories()]);
}

function renderTransactions() {
    elements.tableBody.innerHTML = "";

    if (state.transactions.length === 0) {
        elements.emptyState.hidden = false;
        return;
    }

    elements.emptyState.hidden = true;

    for (const transaction of state.transactions) {
        const row = document.createElement("tr");
        const isIncome = transaction.type === "receita";

        row.innerHTML = `
            <td>${dateFormatter.format(new Date(`${transaction.transaction_date}T00:00:00Z`))}</td>
            <td>
                <strong>${escapeHtml(transaction.description)}</strong>
                ${transaction.notes ? `<div class="table-note">${escapeHtml(transaction.notes)}</div>` : ""}
            </td>
            <td>${escapeHtml(transaction.category)}</td>
            <td>
                <span class="badge ${isIncome ? "income" : "expense"}">
                    ${isIncome ? "Receita" : "Despesa"}
                </span>
            </td>
            <td class="${isIncome ? "amount-income" : "amount-expense"}">
                ${isIncome ? "+" : "-"} ${currencyFormatter.format(transaction.amount)}
            </td>
            <td>
                <div class="row-actions">
                    <button
                        class="icon-button"
                        type="button"
                        data-action="edit"
                        data-id="${transaction.id}"
                    >
                        Editar
                    </button>
                    <button
                        class="icon-button danger"
                        type="button"
                        data-action="delete"
                        data-id="${transaction.id}"
                    >
                        Excluir
                    </button>
                </div>
            </td>
        `;

        elements.tableBody.appendChild(row);
    }
}

function renderCharts(summary) {
    const monthlyLabels = summary.monthly.map((item) => formatMonth(item.month));
    const monthlyIncome = summary.monthly.map((item) => item.income);
    const monthlyExpenses = summary.monthly.map((item) => item.expenses);

    if (state.monthlyChart) {
        state.monthlyChart.destroy();
    }

    state.monthlyChart = new Chart(document.querySelector("#monthly-chart"), {
        type: "bar",
        data: {
            labels: monthlyLabels,
            datasets: [
                {
                    label: "Receitas",
                    data: monthlyIncome,
                    borderWidth: 0,
                },
                {
                    label: "Despesas",
                    data: monthlyExpenses,
                    borderWidth: 0,
                },
            ],
        },
        options: {
            maintainAspectRatio: false,
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => currencyFormatter.format(value),
                    },
                },
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (context) =>
                            `${context.dataset.label}: ${currencyFormatter.format(context.raw)}`,
                    },
                },
            },
        },
    });

    if (state.categoryChart) {
        state.categoryChart.destroy();
    }

    const categoryLabels = summary.expenses_by_category.map((item) => item.category);
    const categoryValues = summary.expenses_by_category.map((item) => item.total);

    state.categoryChart = new Chart(document.querySelector("#category-chart"), {
        type: "doughnut",
        data: {
            labels: categoryLabels.length ? categoryLabels : ["Sem despesas"],
            datasets: [
                {
                    data: categoryValues.length ? categoryValues : [1],
                    borderWidth: 0,
                },
            ],
        },
        options: {
            maintainAspectRatio: false,
            responsive: true,
            plugins: {
                legend: {
                    position: "bottom",
                },
                tooltip: {
                    callbacks: {
                        label: (context) =>
                            categoryValues.length
                                ? `${context.label}: ${currencyFormatter.format(context.raw)}`
                                : "Nenhuma despesa encontrada",
                    },
                },
            },
        },
    });
}

function formatMonth(value) {
    const [year, month] = value.split("-");
    return new Intl.DateTimeFormat("pt-BR", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
    }).format(new Date(`${year}-${month}-01T00:00:00Z`));
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

elements.newButton.addEventListener("click", () => openModal());
elements.closeModalButton.addEventListener("click", closeModal);
elements.cancelButton.addEventListener("click", closeModal);

elements.modalBackdrop.addEventListener("click", (event) => {
    if (event.target === elements.modalBackdrop) {
        closeModal();
    }
});

document.addEventListener("keydown", (event) => {
    if (
        event.key === "Escape" &&
        elements.modalBackdrop.classList.contains("open")
    ) {
        closeModal();
    }
});

elements.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearFormError();

    const payload = {
        description: elements.description.value.trim(),
        amount: Number(elements.amount.value),
        type: elements.type.value,
        category: elements.category.value.trim(),
        transaction_date: elements.date.value,
        notes: elements.notes.value.trim(),
    };

    const transactionId = elements.id.value;
    const url = transactionId
        ? `/api/transactions/${transactionId}`
        : "/api/transactions";
    const method = transactionId ? "PUT" : "POST";

    try {
        await apiRequest(url, {
            method,
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        closeModal();
        await refreshDashboard();
        showToast(transactionId ? "Lançamento atualizado." : "Lançamento adicionado.");
    } catch (error) {
        showFormError(error.message);
    }
});

elements.tableBody.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");

    if (!button) {
        return;
    }

    const id = Number(button.dataset.id);
    const transaction = state.transactions.find((item) => item.id === id);

    if (button.dataset.action === "edit" && transaction) {
        openModal(transaction);
        return;
    }

    if (button.dataset.action === "delete") {
        const confirmed = window.confirm("Deseja realmente excluir este lançamento?");

        if (!confirmed) {
            return;
        }

        try {
            await apiRequest(`/api/transactions/${id}`, {
                method: "DELETE",
            });
            await refreshDashboard();
            showToast("Lançamento excluído.");
        } catch (error) {
            showToast(error.message);
        }
    }
});

document.querySelector("#filters-form").addEventListener("input", () => {
    window.clearTimeout(refreshDashboard.timeoutId);
    refreshDashboard.timeoutId = window.setTimeout(refreshDashboard, 250);
});

elements.clearFilters.addEventListener("click", () => {
    elements.filterMonth.value = "";
    elements.filterType.value = "";
    elements.filterCategory.value = "";
    elements.filterSearch.value = "";
    refreshDashboard();
});

elements.demoButton.addEventListener("click", async () => {
    try {
        const response = await apiRequest("/api/demo", {
            method: "POST",
        });
        await refreshDashboard();
        showToast(response.message);
    } catch (error) {
        showToast(error.message);
    }
});

refreshDashboard().catch((error) => {
    showToast(error.message);
});