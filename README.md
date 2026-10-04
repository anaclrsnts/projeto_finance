# Personal Finance Dashboard

Dashboard financeiro pessoal desenvolvido com **Python, Flask, SQLite, HTML, CSS e JavaScript**.

O projeto permite cadastrar receitas e despesas, acompanhar o saldo, filtrar lançamentos, visualizar gráficos e exportar os dados para CSV.

## Live Demo

🌐 https://personalfinance-1-i5w3.onrender.com/
## Funcionalidades

- Cadastro de receitas e despesas
- Edição e exclusão de lançamentos
- Categorias personalizadas
- Resumo de saldo, receitas e despesas
- Filtro por mês, tipo, categoria e texto
- Gráfico mensal de receitas e despesas
- Gráfico de despesas por categoria
- Exportação de lançamentos para CSV
- Dados de demonstração opcionais
- Persistência local com SQLite
- Layout responsivo

## Tecnologias

- Python
- Flask
- SQLite
- HTML5
- CSS3
- JavaScript
- Chart.js

## Como executar

### 1. Clone o repositório

```bash
git clone https://github.com/anaclrsnts/personalfinance.git
cd personal-finance-dashboard
```

### 2. Crie um ambiente virtual

No Windows:

```bash
python -m venv .venv
.venv\Scripts\activate
```

No macOS ou Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Instale as dependências

```bash
pip install -r requirements.txt
```

### 4. Execute o projeto

```bash
python app.py
```

Abra no navegador:

```text
http://127.0.0.1:5000
```

O arquivo `finance.db` será criado automaticamente na primeira execução.

## Estrutura

```text
├── app.py
├── requirements.txt
├── README.md
├── templates/
│   └── index.html
└── static/
    ├── css/
    │   └── styles.css
    └── js/
        └── app.js
```

## Como o projeto funciona

- O Flask entrega a página HTML e expõe as rotas da API.
- O SQLite armazena os lançamentos financeiros.
- O JavaScript consome a API e atualiza a interface.
- O Chart.js gera os gráficos do dashboard.

## Próximas melhorias

- Autenticação de usuários
- Orçamentos mensais por categoria
- Importação de CSV
- Relatórios em PDF
- Testes automatizados
- Deploy em plataforma de hospedagem

## Autora

Ana Clara dos Santos