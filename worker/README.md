# Investment Guru worker

FastAPI service for the heavy math: backtest engine, rebalance solver, factor regression.
Called from the Next.js app over HTTPS with a signed JWT.

## Local dev

```
cd worker
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8080
```

Health check: `curl http://localhost:8080/health`.

## Deploy to Fly.io

```
brew install flyctl   # one-time
fly auth login        # one-time
fly launch --no-deploy   # first time only, accept generated config
fly deploy
```

Scale-to-zero is enabled (`auto_stop_machines = "stop"`); cold start ~2-3s.
