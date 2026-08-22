import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_root_endpoint(client: AsyncClient) -> None:
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "name" in data
    assert "version" in data
    assert data["health"] == "/api/v1/health"


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data
    assert "environment" in data
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_agent_info(client: AsyncClient) -> None:
    response = await client.get("/api/v1/agent/info")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "diamond_cx_agent"
    assert "model" in data


@pytest.mark.asyncio
async def test_agent_chat_endpoint(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/agent/chat",
        json={"message": "Hello, how can you help me?", "session_id": "test-session-123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data
    assert data["session_id"] == "test-session-123"
    assert data["agent_name"] == "diamond_cx_agent"


@pytest.mark.asyncio
async def test_agent_chat_validation_error(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/agent/chat",
        json={"message": ""},
    )
    assert response.status_code == 422
