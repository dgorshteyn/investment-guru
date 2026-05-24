"""FastAPI entrypoint for the Investment Guru worker.

Endpoints (sprint 3+):
    POST /rebalance  → trade list to move current → target
    POST /backtest   → equity curve + metrics + regimes + factors
    POST /factors    → standalone factor regression (used by re-runs)
"""
from __future__ import annotations

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Investment Guru Worker", version="0.1.0")


class Health(BaseModel):
    status: str
    version: str


@app.get("/health", response_model=Health)
def health() -> Health:
    return Health(status="ok", version="0.1.0")


# Stubs — filled in starting Sprint 3 (rebalance) and Sprint 4 (backtest).
# Keep request/response models in sync with web/src/lib/worker-types.ts.
