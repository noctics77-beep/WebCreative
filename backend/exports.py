"""Spreadsheet & CSV export helpers for admin reports.

All functions return (bytes, content_type, filename) tuples ready for FastAPI Response.
"""
from __future__ import annotations

import csv
import io
from datetime import datetime
from typing import Iterable, List, Dict, Any, Optional

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter


# ---------- Column definitions ----------
ORDER_COLUMNS = [
    ("Tanggal", "created_at"),
    ("Order ID", "order_code"),
    ("Nama Pembeli", "buyer_name"),
    ("Nomor WA", "contact"),
    ("Produk", "product_name"),
    ("Jumlah", "qty"),
    ("Harga", "price"),
    ("Status", "status_label"),
    ("Metode Bayar", "payment_method"),
    ("Affiliate", "referral_affiliate_code"),
]

CUSTOMER_COLUMNS = [
    ("Nama", "name"),
    ("Nomor WA", "whatsapp"),
    ("Total Order", "total_orders"),
    ("Total Belanja", "total_spent"),
    ("Order Terakhir", "last_order_at"),
]

AFFILIATE_DETAIL_COLUMNS = [
    ("Tanggal Order", "created_at"),
    ("Order ID", "order_code"),
    ("Nama Pembeli", "buyer_name"),
    ("Produk", "product_name"),
    ("Harga", "price"),
    ("Komisi", "commission_amount"),
    ("Status", "status_label"),
]

STATUS_LABEL = {
    "pending": "Menunggu Pembayaran",
    "confirmed": "Lunas",
    "cancelled": "Dibatalkan",
    "expired": "Kadaluarsa",
}


def fmt_status(status: str) -> str:
    return STATUS_LABEL.get(status, status or "-")


def fmt_date(value: Optional[str]) -> str:
    if not value:
        return "-"
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d %H:%M")
    except Exception:
        return str(value)[:16]


def _norm_order_row(o: Dict[str, Any]) -> Dict[str, Any]:
    price = o.get("pakasir_total") or o.get("product_price") or 0
    return {
        "created_at": fmt_date(o.get("created_at")),
        "order_code": o.get("order_code", "-"),
        "buyer_name": o.get("buyer_name", "-"),
        "contact": o.get("contact", "-"),
        "product_name": o.get("product_name", "-"),
        "qty": 1,
        "price": float(price or 0),
        "status_label": fmt_status(o.get("status", "")),
        "payment_method": (o.get("payment_method") or "-").upper(),
        "referral_affiliate_code": o.get("referral_affiliate_code") or "-",
        "commission_amount": float(o.get("commission_amount") or 0),
    }


# ---------- CSV ----------
def orders_to_csv(orders: Iterable[Dict[str, Any]]) -> bytes:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([c[0] for c in ORDER_COLUMNS])
    for o in orders:
        row = _norm_order_row(o)
        w.writerow([row[k] for _, k in ORDER_COLUMNS])
    return buf.getvalue().encode("utf-8-sig")


def customers_to_csv(customers: Iterable[Dict[str, Any]]) -> bytes:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([c[0] for c in CUSTOMER_COLUMNS])
    for c in customers:
        w.writerow([
            c.get("name", "-"),
            c.get("whatsapp", "-"),
            c.get("total_orders", 0),
            float(c.get("total_spent") or 0),
            fmt_date(c.get("last_order_at")),
        ])
    return buf.getvalue().encode("utf-8-sig")


def affiliate_to_csv(summary: Dict[str, Any], orders: List[Dict[str, Any]]) -> bytes:
    buf = io.StringIO()
    w = csv.writer(buf)
    # Summary header block
    w.writerow(["RINGKASAN AFFILIATE"])
    w.writerow(["Nama Affiliate", summary.get("name", "-")])
    w.writerow(["Kode Referral", summary.get("affiliate_code", "-")])
    w.writerow(["Total Penjualan", summary.get("total_sales", 0)])
    w.writerow(["Total Komisi", float(summary.get("total_earned") or 0)])
    w.writerow(["Saldo Saat Ini", float(summary.get("balance") or 0)])
    w.writerow(["Total Sudah Dicairkan", float(summary.get("total_withdrawn") or 0)])
    w.writerow([])
    # Detail table
    w.writerow([c[0] for c in AFFILIATE_DETAIL_COLUMNS])
    for o in orders:
        row = _norm_order_row(o)
        w.writerow([row[k] for _, k in AFFILIATE_DETAIL_COLUMNS])
    return buf.getvalue().encode("utf-8-sig")


def all_affiliates_to_csv(items: List[Dict[str, Any]]) -> bytes:
    """Combined CSV with affiliate column prefix on each row."""
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(
        ["Affiliate", "Kode Referral"] + [c[0] for c in AFFILIATE_DETAIL_COLUMNS]
    )
    for entry in items:
        summary = entry["summary"]
        for o in entry["orders"]:
            row = _norm_order_row(o)
            w.writerow(
                [summary.get("name", "-"), summary.get("affiliate_code", "-")]
                + [row[k] for _, k in AFFILIATE_DETAIL_COLUMNS]
            )
    return buf.getvalue().encode("utf-8-sig")


# ---------- XLSX ----------
HEADER_FILL = PatternFill(start_color="1A1D27", end_color="1A1D27", fill_type="solid")
HEADER_FONT = Font(bold=True, color="F5A623")
SUMMARY_FONT = Font(bold=True, color="0F1117")
SUMMARY_FILL = PatternFill(start_color="F5A623", end_color="F5A623", fill_type="solid")


def _autosize(ws):
    for col_idx, col in enumerate(ws.columns, start=1):
        max_len = 10
        for cell in col:
            try:
                v = str(cell.value) if cell.value is not None else ""
                max_len = max(max_len, len(v) + 2)
            except Exception:
                pass
        ws.column_dimensions[get_column_letter(col_idx)].width = min(max_len, 50)


def _write_headers(ws, headers: List[str]):
    for i, h in enumerate(headers, start=1):
        c = ws.cell(row=1, column=i, value=h)
        c.font = HEADER_FONT
        c.fill = HEADER_FILL
        c.alignment = Alignment(horizontal="left", vertical="center")


def orders_to_xlsx(orders: Iterable[Dict[str, Any]], sheet_name: str = "Laporan") -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name[:30] or "Laporan"
    headers = [c[0] for c in ORDER_COLUMNS]
    _write_headers(ws, headers)
    for o in orders:
        row = _norm_order_row(o)
        ws.append([row[k] for _, k in ORDER_COLUMNS])
    _autosize(ws)
    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


def customers_to_xlsx(customers: Iterable[Dict[str, Any]]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Pelanggan"
    _write_headers(ws, [c[0] for c in CUSTOMER_COLUMNS])
    for c in customers:
        ws.append([
            c.get("name", "-"),
            c.get("whatsapp", "-"),
            c.get("total_orders", 0),
            float(c.get("total_spent") or 0),
            fmt_date(c.get("last_order_at")),
        ])
    _autosize(ws)
    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


def _safe_sheet(name: str, used: set) -> str:
    base = "".join(ch for ch in (name or "Affiliate") if ch not in "[]:*?/\\")[:28] or "Affiliate"
    cand = base
    n = 1
    while cand in used:
        n += 1
        suffix = f" ({n})"
        cand = (base[: 28 - len(suffix)] + suffix)
    used.add(cand)
    return cand


def affiliate_to_xlsx(summary: Dict[str, Any], orders: List[Dict[str, Any]]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = _safe_sheet(summary.get("name", "Affiliate"), set())

    # Summary block
    sm = [
        ("Nama Affiliate", summary.get("name", "-")),
        ("Kode Referral", summary.get("affiliate_code", "-")),
        ("Total Penjualan", summary.get("total_sales", 0)),
        ("Total Komisi", float(summary.get("total_earned") or 0)),
        ("Saldo Saat Ini", float(summary.get("balance") or 0)),
        ("Total Sudah Dicairkan", float(summary.get("total_withdrawn") or 0)),
    ]
    for i, (k, v) in enumerate(sm, start=1):
        a = ws.cell(row=i, column=1, value=k)
        b = ws.cell(row=i, column=2, value=v)
        a.font = SUMMARY_FONT
        a.fill = SUMMARY_FILL

    start_row = len(sm) + 2
    # Headers
    headers = [c[0] for c in AFFILIATE_DETAIL_COLUMNS]
    for i, h in enumerate(headers, start=1):
        c = ws.cell(row=start_row, column=i, value=h)
        c.font = HEADER_FONT
        c.fill = HEADER_FILL

    # Detail rows
    for o in orders:
        row = _norm_order_row(o)
        ws.append([row[k] for _, k in AFFILIATE_DETAIL_COLUMNS])
    _autosize(ws)
    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


def all_affiliates_to_xlsx(items: List[Dict[str, Any]]) -> bytes:
    """One sheet per affiliate."""
    wb = Workbook()
    # Remove default sheet, we'll add per affiliate
    default_ws = wb.active
    wb.remove(default_ws)

    used_names = set()
    if not items:
        ws = wb.create_sheet("Kosong")
        ws["A1"] = "Belum ada affiliate"

    for entry in items:
        summary = entry["summary"]
        orders = entry["orders"]
        sheet_name = _safe_sheet(summary.get("name", "Affiliate"), used_names)
        ws = wb.create_sheet(sheet_name)
        sm = [
            ("Nama Affiliate", summary.get("name", "-")),
            ("Kode Referral", summary.get("affiliate_code", "-")),
            ("Total Penjualan", summary.get("total_sales", 0)),
            ("Total Komisi", float(summary.get("total_earned") or 0)),
            ("Saldo Saat Ini", float(summary.get("balance") or 0)),
            ("Total Sudah Dicairkan", float(summary.get("total_withdrawn") or 0)),
        ]
        for i, (k, v) in enumerate(sm, start=1):
            a = ws.cell(row=i, column=1, value=k)
            b = ws.cell(row=i, column=2, value=v)
            a.font = SUMMARY_FONT
            a.fill = SUMMARY_FILL
        start_row = len(sm) + 2
        for i, h in enumerate([c[0] for c in AFFILIATE_DETAIL_COLUMNS], start=1):
            c = ws.cell(row=start_row, column=i, value=h)
            c.font = HEADER_FONT
            c.fill = HEADER_FILL
        for o in orders:
            row = _norm_order_row(o)
            ws.append([row[k] for _, k in AFFILIATE_DETAIL_COLUMNS])
        _autosize(ws)

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


def media_type(fmt: str) -> str:
    return (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        if fmt == "xlsx"
        else "text/csv; charset=utf-8"
    )



# ---------- WAITLIST EXPORT ----------
from fastapi import Response

WAITLIST_COLUMNS = [
    ("Tanggal Daftar", "created_at"),
    ("Produk", "produk_nama"),
    ("Nama", "nama"),
    ("WA/Telegram", "whatsapp_telegram"),
    ("Email", "email"),
    ("Status Notif", "notified_label"),
    ("Via", "notified_via"),
]


def _norm_waitlist_row(w: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "created_at": fmt_date(w.get("created_at")),
        "produk_nama": w.get("produk_nama") or "-",
        "nama": w.get("nama") or "-",
        "whatsapp_telegram": w.get("whatsapp_telegram") or "-",
        "email": w.get("email") or "-",
        "notified_label": "Terkirim" if w.get("notified") else "Pending",
        "notified_via": w.get("notified_via") or "-",
    }


def waitlist_to_csv(items: Iterable[Dict[str, Any]]) -> bytes:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([c[0] for c in WAITLIST_COLUMNS])
    for it in items:
        row = _norm_waitlist_row(it)
        w.writerow([row[k] for _, k in WAITLIST_COLUMNS])
    return buf.getvalue().encode("utf-8-sig")


def waitlist_to_xlsx(items: Iterable[Dict[str, Any]]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Waitlist"
    _write_headers(ws, [c[0] for c in WAITLIST_COLUMNS])
    for it in items:
        row = _norm_waitlist_row(it)
        ws.append([row[k] for _, k in WAITLIST_COLUMNS])
    _autosize(ws)
    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


def export_waitlist(items: List[Dict[str, Any]], fmt: str):
    """FastAPI Response helper untuk export waitlist."""
    ts = datetime.now().strftime("%Y%m%d_%H%M")
    if fmt == "csv":
        data = waitlist_to_csv(items)
        filename = f"waitlist_{ts}.csv"
    else:
        data = waitlist_to_xlsx(items)
        filename = f"waitlist_{ts}.xlsx"
    return Response(
        content=data,
        media_type=media_type(fmt),
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
