from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from api.data_store import get_payload
from api.chatbot import chatbot


class ChatRequest(BaseModel):
    message: str

app = FastAPI(title="VegShift API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def _normalize_city(city: str, payload: dict) -> str:
    city_map = {c.lower(): c for c in payload.get("city_detail", {}).keys()}
    key = city.lower()
    if key not in city_map:
        raise HTTPException(status_code=404, detail=f"Unknown city: {city}")
    return city_map[key]


@app.get("/")
def root() -> dict:
    payload = get_payload()
    return {
        "service": "VegShift API",
        "version": app.version,
        "last_updated": payload.get("meta", {}).get("last_updated"),
    }


@app.get("/meta")
def meta() -> dict:
    payload = get_payload()
    return payload.get("meta", {})


@app.get("/summary")
def summary() -> list:
    payload = get_payload()
    return payload.get("summary", [])


@app.get("/city/{city}")
def city(city: str) -> dict:
    payload = get_payload()
    key = _normalize_city(city, payload)
    return payload.get("city_detail", {}).get(key, {})


@app.get("/advisory/{city}")
def advisory(city: str) -> dict:
    payload = get_payload()
    key = _normalize_city(city, payload)
    return payload["city_detail"][key]["advisory"]


@app.get("/irrigation/{city}")
def irrigation(city: str) -> dict:
    payload = get_payload()
    key = _normalize_city(city, payload)
    return payload["city_detail"][key]["irrigation"]


@app.get("/risk/{city}")
def risk(city: str) -> dict:
    payload = get_payload()
    key = _normalize_city(city, payload)
    summary_list = payload.get("summary", [])
    for item in summary_list:
        if item["city"] == key:
            return item
    raise HTTPException(status_code=404, detail=f"Risk data not found for {city}")


@app.get("/evidence/{city}")
def evidence(city: str) -> list:
    payload = get_payload()
    key = _normalize_city(city, payload)
    return payload["city_detail"][key]["evidence"]


@app.post("/chat")
def chat(request: ChatRequest) -> dict:
    """Chat endpoint for VegShift knowledge base"""
    try:
        response = chatbot.get_response(request.message)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


