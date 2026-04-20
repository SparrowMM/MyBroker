from fastapi import APIRouter

from schemas.record import ProjectDecisionRequest, ProjectDecisionResponse
from services.project_decision import ProjectDecisionEngine


router = APIRouter(prefix="/projects", tags=["projects"])
engine = ProjectDecisionEngine()


@router.post("/decision", response_model=ProjectDecisionResponse)
def decide_new_project(payload: ProjectDecisionRequest):
    should_create, confidence, suggested_name, reason = engine.evaluate(
        payload.task_description, payload.existing_projects
    )
    return ProjectDecisionResponse(
        should_create_project=should_create,
        confidence=round(confidence, 2),
        suggested_project_name=suggested_name,
        reason=reason,
    )
