FROM python:3.11-slim

RUN apt-get update -y \
    && apt-get install -y zsh bash git curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace/project
