from __future__ import annotations

import csv
import io
import sqlite3
from datetime import date, datetime
from pathlib import Path
from typing import Any

from flask import Flask, Response, jsonify, render_template, request

BASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = BASE_DIR / "finance.db"

app = Flask(__name__)


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_database() -> None:
    with get_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                description TEXT NOT NULL,
                amount REAL NOT NULL CHECK (amount >= 0),
                type TEXT NOT NULL CHECK (type IN ('receita', 'despesa')),
                category TEXT NOT NULL,
                transaction_date TEXT NOT NULL,
                notes TEXT DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.commit()


def row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "description": row["description"],
        "amount": float(row["amount"]),
        "type": row["type"],
        "category": row["category"],
        "transaction_date": row["transaction_date"],
        "notes": row["notes"] or "",
        "created_at": row["created_at"],
    }


def validate_transaction(data: dict[str, Any]) -> tuple[bool, str]:
    required_fields = ["description", "amount", "type", "category", "transaction_date"]

    for field in required_fields:
        if field not in data or str(data[field]).strip() == "":
            return False, f"O campo '{field}' é obrigatório."

    try:
        amount = float(data["amount"])
        if amount < 0:
            return False, "O valor não pode ser negativo."
    except (TypeError, ValueError):
        return False, "Informe um valor numérico válido."

    if data["type"] not in {"receita", "despesa"}:
        return False, "Tipo de lançamento inválido."

    try:
        datetime.strptime(data["transaction_date"], "%Y-%m-%d")
    except ValueError:
        return False, "Data inválida. Use o formato AAAA-MM-DD."

    return True, ""


@app.route("/")
def index() -> str:
    return render_template("index.html")


@app.route("/api/transactions", methods=["GET"])
def list_transactions():
    month = request.args.get("month", "").strip()
    category = request.args.get("category", "").strip()
    transaction_type = request.args.get("type", "").strip()
    search = request.args.get("search", "").strip()

    query = "SELECT * FROM transactions WHERE 1=1"
    params: list[Any] = []

    if month:
        query += " AND substr(transaction_date, 1, 7) = ?"
        params.append(month)

    if category:
        query += " AND category = ?"
        params.append(category)

    if transaction_type in {"receita", "despesa"}:
        query += " AND type = ?"
        params.append(transaction_type)

    if search:
        query += " AND (description LIKE ? OR notes LIKE ?)"
        like_value = f"%{search}%"
        params.extend([like_value, like_value])

    query += " ORDER BY transaction_date DESC, id DESC"

    with get_connection() as connection:
        rows = connection.execute(query, params).fetchall()

    return jsonify([row_to_dict(row) for row in rows])


@app.route("/api/transactions", methods=["POST"])
def create_transaction():
    data = request.get_json(silent=True) or {}
    valid, message = validate_transaction(data)

    if not valid:
        return jsonify({"error": message}), 400

    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO transactions (
                description, amount, type, category, transaction_date, notes
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                str(data["description"]).strip(),
                float(data["amount"]),
                data["type"],
                str(data["category"]).strip(),
                data["transaction_date"],
                str(data.get("notes", "")).strip(),
            ),
        )
        connection.commit()
        row = connection.execute(
            "SELECT * FROM transactions WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()

    return jsonify(row_to_dict(row)), 201


@app.route("/api/transactions/<int:transaction_id>", methods=["PUT"])
def update_transaction(transaction_id: int):
    data = request.get_json(silent=True) or {}
    valid, message = validate_transaction(data)

    if not valid:
        return jsonify({"error": message}), 400

    with get_connection() as connection:
        existing = connection.execute(
            "SELECT id FROM transactions WHERE id = ?",
            (transaction_id,),
        ).fetchone()

        if existing is None:
            return jsonify({"error": "Lançamento não encontrado."}), 404

        connection.execute(
            """
            UPDATE transactions
            SET description = ?,
                amount = ?,
                type = ?,
                category = ?,
                transaction_date = ?,
                notes = ?
            WHERE id = ?
            """,
            (
                str(data["description"]).strip(),
                float(data["amount"]),
                data["type"],
                str(data["category"]).strip(),
                data["transaction_date"],
                str(data.get("notes", "")).strip(),
                transaction_id,
            ),
        )
        connection.commit()

        row = connection.execute(
            "SELECT * FROM transactions WHERE id = ?",
            (transaction_id,),
        ).fetchone()

    return jsonify(row_to_dict(row))


@app.route("/api/transactions/<int:transaction_id>", methods=["DELETE"])
def delete_transaction(transaction_id: int):
    with get_connection() as connection:
        cursor = connection.execute(
            "DELETE FROM transactions WHERE id = ?",
            (transaction_id,),
        )
        connection.commit()

    if cursor.rowcount == 0:
        return jsonify({"error": "Lançamento não encontrado."}), 404

    return jsonify({"message": "Lançamento excluído com sucesso."})


@app.route("/api/summary", methods=["GET"])
def summary():
    month = request.args.get("month", "").strip()

    where_clause = ""
    params: list[Any] = []

    if month:
        where_clause = "WHERE substr(transaction_date, 1, 7) = ?"
        params.append(month)

    with get_connection() as connection:
        totals = connection.execute(
            f"""
            SELECT
                COALESCE(SUM(CASE WHEN type = 'receita' THEN amount ELSE 0 END), 0) AS income,
                COALESCE(SUM(CASE WHEN type = 'despesa' THEN amount ELSE 0 END), 0) AS expenses
            FROM transactions
            {where_clause}
            """,
            params,
        ).fetchone()

        by_category = connection.execute(
            f"""
            SELECT category, SUM(amount) AS total
            FROM transactions
            {where_clause + (" AND " if where_clause else "WHERE ")}
                type = 'despesa'
            GROUP BY category
            ORDER BY total DESC
            """,
            params,
        ).fetchall()

        monthly = connection.execute(
            """
            SELECT
                substr(transaction_date, 1, 7) AS month,
                SUM(CASE WHEN type = 'receita' THEN amount ELSE 0 END) AS income,
                SUM(CASE WHEN type = 'despesa' THEN amount ELSE 0 END) AS expenses
            FROM transactions
            GROUP BY substr(transaction_date, 1, 7)
            ORDER BY month
            """
        ).fetchall()

    income = float(totals["income"])
    expenses = float(totals["expenses"])

    return jsonify(
        {
            "income": income,
            "expenses": expenses,
            "balance": income - expenses,
            "expenses_by_category": [
                {"category": row["category"], "total": float(row["total"])}
                for row in by_category
            ],
            "monthly": [
                {
                    "month": row["month"],
                    "income": float(row["income"] or 0),
                    "expenses": float(row["expenses"] or 0),
                }
                for row in monthly
            ],
        }
    )


@app.route("/api/categories", methods=["GET"])
def list_categories():
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT DISTINCT category FROM transactions ORDER BY category"
        ).fetchall()

    default_categories = {
        "Alimentação",
        "Assinaturas",
        "Casa",
        "Educação",
        "Lazer",
        "Outros",
        "Salário",
        "Saúde",
        "Transporte",
    }
    categories = sorted(default_categories | {row["category"] for row in rows})
    return jsonify(categories)


@app.route("/api/export", methods=["GET"])
def export_csv():
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT * FROM transactions ORDER BY transaction_date DESC, id DESC"
        ).fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        ["ID", "Descrição", "Valor", "Tipo", "Categoria", "Data", "Observações"]
    )

    for row in rows:
        writer.writerow(
            [
                row["id"],
                row["description"],
                row["amount"],
                row["type"],
                row["category"],
                row["transaction_date"],
                row["notes"] or "",
            ]
        )

    csv_content = "\ufeff" + output.getvalue()

    return Response(
        csv_content,
        mimetype="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": (
                f"attachment; filename=financas-{date.today().isoformat()}.csv"
            )
        },
    )


@app.route("/api/demo", methods=["POST"])
def load_demo_data():
    demo_transactions = [
        ("Salário", 5200.00, "receita", "Salário", "2026-07-05", "Receita mensal"),
        ("Freelance", 850.00, "receita", "Outros", "2026-07-18", "Projeto pontual"),
        ("Aluguel", 1700.00, "despesa", "Casa", "2026-07-08", ""),
        ("Mercado", 640.50, "despesa", "Alimentação", "2026-07-11", ""),
        ("Transporte", 280.00, "despesa", "Transporte", "2026-07-14", ""),
        ("Curso online", 129.90, "despesa", "Educação", "2026-07-20", ""),
        ("Cinema", 74.00, "despesa", "Lazer", "2026-07-23", ""),
        ("Salário", 5200.00, "receita", "Salário", "2026-08-05", "Receita mensal"),
        ("Aluguel", 1700.00, "despesa", "Casa", "2026-08-08", ""),
        ("Mercado", 310.75, "despesa", "Alimentação", "2026-08-09", ""),
        ("Internet", 119.90, "despesa", "Assinaturas", "2026-08-10", ""),
    ]

    with get_connection() as connection:
        count = connection.execute("SELECT COUNT(*) AS total FROM transactions").fetchone()
        if count["total"] > 0:
            return jsonify({"message": "A base já possui lançamentos."}), 409

        connection.executemany(
            """
            INSERT INTO transactions (
                description, amount, type, category, transaction_date, notes
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            demo_transactions,
        )
        connection.commit()

    return jsonify({"message": "Dados de demonstração adicionados."}), 201

init_database()

if __name__ == "__main__":
    init_database()
    app.run(debug=True)