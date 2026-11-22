from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Agent
from app.schemas import AgentRead

router = APIRouter(prefix="/api/agents", tags=["Agents"])

@router.get("", response_model=List[AgentRead])
def list_agents(db: Session = Depends(get_db)):
    """List all Arvo support agents."""
    return db.query(Agent).filter(Agent.is_active == True).all()

@router.get("/{agent_id}", response_model=AgentRead)
def get_agent(agent_id: int, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent

