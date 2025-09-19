from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import SessionLocal
from ..models import Project, ProjectGroup, ProjectGroupMembership
from ..schemas import (
    ProjectGroupCreate,
    ProjectGroupRead,
    ProjectGroupUpdate,
    ProjectGroupWithProjects,
    GroupAssignRequest,
    ProjectRead,
)
from ..settings import settings


def require_groups_enabled():
    if int(settings.groups_ui or 0) != 1:
        raise HTTPException(status_code=404, detail={"code": "NOT_ENABLED", "message": "Groups disabled"})


router = APIRouter(
    prefix="/project-groups",
    tags=["project-groups"],
    dependencies=[Depends(require_groups_enabled)],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("", response_model=List[ProjectGroupWithProjects])
def list_groups(db: Session = Depends(get_db)):
    groups = db.scalars(select(ProjectGroup).order_by(ProjectGroup.sort_order)).all()
    # Build group -> projects
    out: list[ProjectGroupWithProjects] = []
    for g in groups:
        # Fetch memberships for group in order
        mems = db.scalars(
            select(ProjectGroupMembership).where(ProjectGroupMembership.group_id == g.id).order_by(ProjectGroupMembership.sort_order)
        ).all()
        projects: list[ProjectRead] = []
        for m in mems:
            p = db.get(Project, m.project_id)
            if p:
                projects.append(ProjectRead.model_validate(p))
        out.append(
            ProjectGroupWithProjects(
                id=g.id, name=g.name, color=g.color, sort_order=g.sort_order, projects=projects
            )
        )
    return out


@router.post("", response_model=ProjectGroupRead, status_code=201)
def create_group(body: ProjectGroupCreate, db: Session = Depends(get_db)):
    # Determine sort_order if not provided: append to end
    max_order = db.scalar(select(ProjectGroup).order_by(ProjectGroup.sort_order.desc()))
    next_order = 0
    if max_order:
        next_order = (max_order.sort_order or 0) + 1
    g = ProjectGroup(name=body.name, color=body.color, sort_order=body.sort_order if body.sort_order is not None else next_order)
    db.add(g)
    db.commit()
    db.refresh(g)
    return g


@router.patch("/{group_id}", response_model=ProjectGroupRead)
def update_group(group_id: str, body: ProjectGroupUpdate, db: Session = Depends(get_db)):
    g = db.get(ProjectGroup, group_id)
    if not g:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND"})
    if body.name is not None:
        g.name = body.name
    if body.color is not None:
        g.color = body.color
    if body.sort_order is not None:
        g.sort_order = body.sort_order
    db.add(g)
    db.commit()
    db.refresh(g)
    return g


@router.delete("/{group_id}", status_code=204)
def delete_group(group_id: str, db: Session = Depends(get_db)):
    g = db.get(ProjectGroup, group_id)
    if not g:
        return
    # Delete memberships in this group
    db.query(ProjectGroupMembership).filter(ProjectGroupMembership.group_id == group_id).delete(synchronize_session=False)
    db.delete(g)
    db.commit()
    return


@router.post("/{group_id}/assign", status_code=204)
def assign_to_group(group_id: str, body: GroupAssignRequest, db: Session = Depends(get_db)):
    g = db.get(ProjectGroup, group_id)
    if not g:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Group not found"})
    p = db.get(Project, body.project_id)
    if not p:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Project not found"})
    # Remove existing membership for project (unique constraint ensures single group)
    existing = db.scalar(select(ProjectGroupMembership).where(ProjectGroupMembership.project_id == p.id))
    if existing:
        db.delete(existing)
        db.flush()
    # Determine position
    mems = db.scalars(
        select(ProjectGroupMembership).where(ProjectGroupMembership.group_id == group_id).order_by(ProjectGroupMembership.sort_order)
    ).all()
    if body.position is None or body.position < 0 or body.position > len(mems):
        position = len(mems)
    else:
        position = body.position
    # Shift sort_orders for mems at/after position
    for idx, m in enumerate(mems):
        if idx >= position:
            m.sort_order = (m.sort_order or idx) + 1
            db.add(m)
    # Insert new membership
    newm = ProjectGroupMembership(project_id=p.id, group_id=g.id, sort_order=position)
    db.add(newm)
    db.commit()
    return


@router.delete("/assign/{project_id}", status_code=204)
def unassign_project(project_id: str, db: Session = Depends(get_db)):
    m = db.scalar(select(ProjectGroupMembership).where(ProjectGroupMembership.project_id == project_id))
    if not m:
        return
    db.delete(m)
    db.commit()
    return
