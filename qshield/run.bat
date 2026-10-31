@echo off
rem Start the Q-Shield Atlas backend on http://127.0.0.1:8100/ (Windows, Anaconda Prompt). 8000 is AetherPool's.
cd /d "%~dp0"
call conda activate pqc & python -m atlas_web --port 8100 %*
