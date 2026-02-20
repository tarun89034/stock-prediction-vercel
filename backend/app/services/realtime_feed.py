"""
Phase 2: Replace yfinance live calls with Finnhub.
Free tier: 60 API calls/min + WebSocket for US stocks.
Sign up at https://finnhub.io (free).
"""
import finnhub
from app.config import settings

class FinnhubFeed:
    def __init__(self):
        api_key = settings.finnhub_api_key
        if not api_key:
            raise ValueError("FINNHUB_API_KEY is not set in .env")
        self.client = finnhub.Client(api_key=api_key)

    def get_quote(self, ticker: str) -> dict:
        """Real-time quote (15-sec delay on free tier is fine)."""
        quote = self.client.quote(ticker)
        return {
            "current": quote["c"],
            "high": quote["h"],
            "low": quote["l"],
            "open": quote["o"],
            "previous_close": quote["pc"],
            "change_pct": round(((quote["c"] - quote["pc"]) / quote["pc"]) * 100, 2),
        }

    def get_insider_transactions(self, ticker: str) -> list[dict]:
        """SEC Form 4 insider transactions — FREE on Finnhub."""
        data = self.client.stock_insider_transactions(ticker)
        transactions = data.get("data", [])
        # Filter to last 90 days, sort by date
        return [
            {
                "name": t["name"],
                "share": t["share"],
                "change": t["change"],
                "transaction_type": t["transactionType"],
                "filing_date": t["filingDate"],
            }
            for t in transactions[:20]
        ]