from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Tag, User
from app.schemas import TagCreate, TagOut

router = APIRouter(prefix="/api/tags", tags=["tags"])


@router.get("", response_model=list[TagOut])
def list_tags(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return db.scalars(
        select(Tag).where(Tag.owner_id == user.id).order_by(Tag.name)
    ).all()


@router.post("", response_model=TagOut, status_code=status.HTTP_201_CREATED)
def create_tag(
    payload: TagCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    dup = db.scalar(
        select(Tag).where(Tag.owner_id == user.id, Tag.name == payload.name)
    )
    if dup:
        raise HTTPException(status_code=400, detail="Tag already exists")
    tag = Tag(name=payload.name, owner_id=user.id)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tag(
    tag_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tag = db.scalar(
        select(Tag).where(Tag.id == tag_id, Tag.owner_id == user.id)
    )
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    db.delete(tag)
    db.commit()
    return None