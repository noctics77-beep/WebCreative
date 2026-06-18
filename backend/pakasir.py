"""Pakasir automated QRIS payment integration.

Docs: https://pakasir.com/p/docs
- Create transaction: POST /api/transactioncreate/{method}
- Transaction detail (status verification): GET /api/transactiondetail
- Cancel transaction: POST /api/transactioncancel
The webhook payload is NOT signed; docs recommend re-verifying via transactiondetail.
"""
import os
import io
import base64
import logging
import httpx
import qrcode

logger = logging.getLogger(__name__)

PAKASIR_BASE = "https://app.pakasir.com/api"


def _api_key() -> str:
    return os.environ.get("PAKASIR_API_KEY", "")


def _project() -> str:
    return os.environ.get("PAKASIR_PROJECT_SLUG", "")


def is_configured() -> bool:
    return bool(_api_key() and _project())


def qr_to_data_uri(qr_string: str) -> str:
    """Render a QRIS payload string into a base64 PNG data URI."""
    img = qrcode.make(qr_string)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


async def create_qris(order_id: str, amount: int) -> dict:
    """Create a dynamic QRIS transaction. Returns the `payment` object."""
    url = f"{PAKASIR_BASE}/transactioncreate/qris"
    payload = {
        "project": _project(),
        "order_id": order_id,
        "amount": amount,
        "api_key": _api_key(),
    }
    async with httpx.AsyncClient(timeout=25.0) as cli:
        r = await cli.post(url, json=payload)
        r.raise_for_status()
        data = r.json()
    payment = data.get("payment")
    if not payment or not payment.get("payment_number"):
        raise ValueError(f"Pakasir create response invalid: {data}")
    return payment


async def get_transaction(order_id: str, amount: int) -> dict | None:
    """Fetch authoritative transaction status from Pakasir."""
    url = f"{PAKASIR_BASE}/transactiondetail"
    params = {
        "project": _project(),
        "amount": amount,
        "order_id": order_id,
        "api_key": _api_key(),
    }
    try:
        async with httpx.AsyncClient(timeout=20.0) as cli:
            r = await cli.get(url, params=params)
            if r.status_code != 200:
                logger.error(f"Pakasir transactiondetail {r.status_code}: {r.text}")
                return None
            return r.json().get("transaction")
    except Exception as e:
        logger.error(f"Pakasir transactiondetail error: {e}")
        return None


async def cancel_transaction(order_id: str, amount: int) -> None:
    """Best-effort cancel of an unpaid transaction."""
    url = f"{PAKASIR_BASE}/transactioncancel"
    payload = {
        "project": _project(),
        "order_id": order_id,
        "amount": amount,
        "api_key": _api_key(),
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as cli:
            await cli.post(url, json=payload)
    except Exception as e:
        logger.error(f"Pakasir cancel error: {e}")
